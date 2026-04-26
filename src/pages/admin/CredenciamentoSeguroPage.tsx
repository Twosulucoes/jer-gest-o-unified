/**
 * Tela de credenciamento "seguro" — fluxo enxuto e validador.
 *
 * Diferente da tela cheia (`CredenciamentoPage.tsx`), aqui o objetivo é
 * GARANTIR a precondição antes de chamar a RPC e MOSTRAR claramente por que
 * uma emissão pode falhar:
 *
 *   1) Pre-flight de infraestrutura (RPC + tabela de log) — bloqueante.
 *   2) Documentação aprovada (participant_documents) — bloqueante.
 *   3) Irregularidades bloqueantes abertas (RPC get_blocking_irregularities) — bloqueante.
 *   4) Credencial ativa duplicada (uq_participant_event_active) — informativo.
 *
 * Mensagens de erro são traduzidas a partir de códigos PostgREST/Postgres
 * (`PGRST202`, `PGRST205`, `P0001`, `23505`, `22023`) para algo acionável.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { useCredencialamentoPreflight } from "@/hooks/useCredencialamentoPreflight";
import { useDocumentationStatus } from "@/hooks/useDocumentationStatus";
import { generateCredentialCode, generateQrCodeValue } from "@/lib/credentialUtils";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Database,
  FileCheck2,
  Stethoscope,
} from "lucide-react";

// ----- validação -----
const searchSchema = z
  .string()
  .trim()
  .min(3, "Digite ao menos 3 caracteres.")
  .max(120, "Busca muito longa.");

interface ParticipantRow {
  id: string;
  status: string;
  participant_type: string;
  people: { full_name: string; cpf: string | null } | null;
  delegations: { name: string } | null;
}

// ----- mapeamento de erro -----
function humanizeError(err: any): { title: string; description: string } {
  const code = err?.code as string | undefined;
  const msg = (err?.message as string | undefined) ?? "";

  if (code === "PGRST202") {
    return {
      title: "Função de emissão indisponível no banco",
      description:
        "A RPC issue_participant_credential não está no schema cache. Avise o time técnico para reaplicar a migração 20260424000004_credential-atomic-rpcs.sql.",
    };
  }
  if (code === "PGRST205") {
    return {
      title: "Tabela de telemetria ausente",
      description:
        "A tabela db_operation_logs não existe no banco. A emissão pode prosseguir, mas o log será desativado.",
    };
  }
  if (code === "P0001" || msg.includes("Credenciamento bloqueado") || msg.includes("irregularidade")) {
    return {
      title: "Credenciamento bloqueado",
      description: "O atleta possui irregularidade aberta. Resolva em /admin/irregularidades antes de emitir.",
    };
  }
  if (code === "23505" || msg.includes("uq_participant_event_active")) {
    return {
      title: "Credencial ativa já existe",
      description: "Este participante já possui uma credencial ativa neste evento. Use reemissão para invalidar a anterior.",
    };
  }
  if (code === "22023") {
    return {
      title: "Parâmetros obrigatórios ausentes",
      description: "Verifique evento, participante e usuário autenticado.",
    };
  }
  return {
    title: "Falha ao emitir credencial",
    description: msg || "Erro desconhecido.",
  };
}

export default function CredenciamentoSeguroPage() {
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const preflight = useCredencialamentoPreflight();

  // ----- busca de participantes -----
  const { data: results = [], isFetching: isSearching } = useQuery<ParticipantRow[]>({
    queryKey: ["credenciamento-seguro-search", activeEventId, searchTerm],
    enabled: !!activeEventId && searchTerm.length >= 3,
    queryFn: async () => {
      const term = searchTerm.replace(/[%,]/g, "");
      const { data, error } = await supabase
        .from("participants")
        .select(
          "id, status, participant_type, people!inner(full_name, cpf), delegations(name)"
        )
        .eq("event_id", activeEventId!)
        .eq("is_active", true)
        .or(`full_name.ilike.%${term}%,cpf.ilike.%${term}%`, { foreignTable: "people" })
        .limit(15);
      if (error) throw error;
      return (data ?? []) as unknown as ParticipantRow[];
    },
  });

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId]
  );

  // ----- documentação do selecionado -----
  const docCheck = useDocumentationStatus(activeEventId ?? undefined, selected?.id);

  // ----- irregularidades bloqueantes -----
  const blockingQuery = useQuery({
    queryKey: ["blocking-irregs", activeEventId, selected?.id],
    enabled: !!activeEventId && !!selected?.id,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_blocking_irregularities", {
        p_event_id: activeEventId,
        p_participant_id: selected!.id,
      });
      if (error) throw error;
      return data as { has_blocking: boolean; items: Array<{ rule_code: string; message: string }> };
    },
  });

  // ----- credencial ativa atual -----
  const activeCredQuery = useQuery({
    queryKey: ["active-cred", activeEventId, selected?.id],
    enabled: !!activeEventId && !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, credential_code, issued_at")
        .eq("event_id", activeEventId!)
        .eq("participant_id", selected!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ----- mutation de emissão -----
  const emitMutation = useMutation({
    mutationFn: async () => {
      if (!activeEventId || !selected || !user?.id) {
        throw Object.assign(new Error("Contexto incompleto"), { code: "22023" });
      }
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(activeEventId, selected.id, credentialCode);
      const { error } = await (supabase as any).rpc("issue_participant_credential", {
        p_event_id: activeEventId,
        p_participant_id: selected.id,
        p_credential_code: credentialCode,
        p_qr_code_value: qrCodeValue,
        p_user_id: user.id,
        p_binding_source: "manual",
        p_revoke_id: activeCredQuery.data?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credencial emitida com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["active-cred"] });
      queryClient.invalidateQueries({ queryKey: ["credenciamento-seguro-search"] });
    },
    onError: (err: any) => {
      const { title, description } = humanizeError(err);
      toast.error(title, { description });
    },
  });

  // ----- gates -----
  const preflightOk = preflight.data?.canIssue === true;
  const docsOk = docCheck.data?.isClear === true;
  const irregsOk = blockingQuery.data ? !blockingQuery.data.has_blocking : true;
  const allChecksLoading =
    preflight.isLoading || docCheck.isLoading || blockingQuery.isLoading;
  const canEmit =
    !!selected && preflightOk && docsOk && irregsOk && !allChecksLoading;

  // ----- handlers -----
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = searchSchema.safeParse(rawSearch);
    if (!parsed.success) {
      setSearchError(parsed.error.issues[0]?.message ?? "Busca inválida.");
      return;
    }
    setSearchError(null);
    setSearchTerm(parsed.data);
    setSelectedId(null);
  };

  if (!activeEventId) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Selecione um evento</AlertTitle>
          <AlertDescription>
            Escolha um evento ativo para usar o credenciamento seguro.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Credenciamento Seguro
        </h1>
        <p className="text-sm text-muted-foreground">
          Fluxo guiado com pre-flight de infraestrutura, validação de documentação e
          checagem de irregularidades antes da emissão.
        </p>
        <p className="text-xs text-muted-foreground">
          Para o fluxo completo (lote, externo, etiquetas), use{" "}
          <Link to="/admin/credenciamento" className="underline">
            /admin/credenciamento
          </Link>
          .
        </p>
      </header>

      <PreflightCard preflight={preflight} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            1. Buscar participante
          </CardTitle>
          <CardDescription>Por nome ou CPF (mín. 3 caracteres).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="search" className="sr-only">
                Buscar
              </Label>
              <Input
                id="search"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                maxLength={120}
                placeholder="Nome ou CPF"
                aria-invalid={!!searchError}
              />
              {searchError && (
                <p className="text-xs text-destructive">{searchError}</p>
              )}
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </form>

          {searchTerm && !isSearching && results.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum participante encontrado para "{searchTerm}".
            </p>
          )}

          {results.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-md border">
              {results.map((p) => {
                const isSel = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full px-3 py-2 text-left transition-colors hover:bg-muted ${
                        isSel ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {p.people?.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.delegations?.name ?? "Sem delegação"} ·{" "}
                            {p.participant_type} · {p.people?.cpf ?? "sem CPF"}
                          </p>
                        </div>
                        <Badge variant={p.status === "confirmed" ? "default" : "outline"}>
                          {p.status}
                        </Badge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5" />
              2. Validações
            </CardTitle>
            <CardDescription>
              Tudo precisa estar verde para liberar a emissão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CheckRow
              label="Documentação"
              loading={docCheck.isLoading}
              ok={docsOk}
              detail={docCheck.data?.message}
            />
            <CheckRow
              label="Irregularidades bloqueantes"
              loading={blockingQuery.isLoading}
              ok={irregsOk}
              detail={
                blockingQuery.data?.has_blocking
                  ? `${blockingQuery.data.items.length} bloqueante(s) aberta(s).`
                  : "Nenhuma irregularidade bloqueante."
              }
            />
            <CheckRow
              label="Infraestrutura (RPC/log)"
              loading={preflight.isLoading}
              ok={preflightOk}
              detail={
                preflight.data?.rpcStatus === "missing"
                  ? "RPC de emissão ausente — emissão não funcionará."
                  : preflight.data?.logTableStatus === "missing"
                    ? "Telemetria desativada (db_operation_logs ausente). Emissão liberada."
                    : "Infra OK."
              }
            />
            {activeCredQuery.data && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Credencial ativa existente</AlertTitle>
                <AlertDescription>
                  Código <span className="font-mono">{activeCredQuery.data.credential_code}</span> —
                  uma nova emissão revogará a atual.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              3. Emitir credencial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              size="lg"
              onClick={() => emitMutation.mutate()}
              disabled={!canEmit || emitMutation.isPending}
              className="w-full sm:w-auto"
            >
              {emitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Emitindo…
                </>
              ) : activeCredQuery.data ? (
                "Reemitir (revoga atual)"
              ) : (
                "Emitir credencial"
              )}
            </Button>
            {!canEmit && !allChecksLoading && (
              <p className="text-xs text-muted-foreground">
                Resolva as validações acima para liberar o botão.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ----- subcomponentes -----
function CheckRow({
  label,
  loading,
  ok,
  detail,
}: {
  label: string;
  loading: boolean;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <div className="mt-0.5">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : ok ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

function PreflightCard({
  preflight,
}: {
  preflight: ReturnType<typeof useCredencialamentoPreflight>;
}) {
  const data = preflight.data;
  const hasIssue = data && (data.rpcStatus === "missing" || data.logTableStatus === "missing");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5" /> Pre-flight de infraestrutura
        </CardTitle>
        <CardDescription>
          Verificação automática de RPC e tabela de telemetria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {preflight.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        )}
        {data && (
          <>
            <PreflightLine
              label="RPC issue_participant_credential"
              status={data.rpcStatus}
              detail={data.rpcDetail}
            />
            <Separator />
            <PreflightLine
              label="Tabela db_operation_logs (telemetria)"
              status={data.logTableStatus}
              detail={data.logTableDetail}
            />
            {data.rpcStatus === "missing" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Emissão indisponível</AlertTitle>
                <AlertDescription>
                  Reaplique a migração{" "}
                  <code>20260424000004_credential-atomic-rpcs.sql</code> e peça reload do
                  schema cache (<code>NOTIFY pgrst, 'reload schema'</code>).
                </AlertDescription>
              </Alert>
            )}
            {!hasIssue && data.canIssue && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Tudo certo</AlertTitle>
                <AlertDescription>
                  Infraestrutura disponível. Verificação válida por 60s.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => preflight.refetch()}
          disabled={preflight.isFetching}
        >
          {preflight.isFetching ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : null}
          Reexecutar pre-flight
        </Button>
      </CardContent>
    </Card>
  );
}

function PreflightLine({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ok" | "missing" | "unknown";
  detail?: string;
}) {
  const Icon = status === "ok" ? CheckCircle2 : status === "missing" ? XCircle : Database;
  const color =
    status === "ok"
      ? "text-success"
      : status === "missing"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="flex items-start gap-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {status === "ok" ? "Disponível" : status === "missing" ? "Ausente" : "Indeterminado"}
          {detail ? ` — ${detail}` : ""}
        </p>
      </div>
    </div>
  );
}
