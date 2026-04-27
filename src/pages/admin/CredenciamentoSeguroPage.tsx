/**
 * Tela de credenciamento "seguro" — fluxo enxuto e validador.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCredencialamentoPreflight } from "@/hooks/useCredencialamentoPreflight";
import { useDocumentationStatus } from "@/hooks/useDocumentationStatus";
import { generateCredentialCode, generateSignedQrCodeValue } from "@/lib/credentialUtils";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Stethoscope,
  Database,
  CheckCircle as CheckCircleIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const searchSchema = z.string().min(3, "Mínimo de 3 caracteres para busca.");

function humanizeError(err: any) {
  const code = err?.code || (err as any)?.message;
  if (code === "23505") return { title: "Duplicidade", description: "Este participante já possui uma credencial ativa." };
  if (code === "P0001") return { title: "Regra de Negócio", description: err.message };
  return { title: "Erro na emissão", description: err.message || "Erro desconhecido" };
}

export default function CredenciamentoSeguroPage() {
  const activeEventId = useActiveEventId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rawSearch, setRawSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const preflight = useCredencialamentoPreflight();
  
  const { data: results = [], isLoading: isSearching } = useQuery({
    queryKey: ["credenciamento-seguro-search", activeEventId, searchTerm],
    queryFn: async () => {
      if (!searchTerm || !activeEventId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, status, participant_type, people(full_name, cpf), delegations(name)")
        .eq("event_id", activeEventId)
        .or(`people.full_name.ilike.%${searchTerm}%,people.cpf.ilike.%${searchTerm}%`)
        .limit(10);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!activeEventId && !!searchTerm,
  });

  const selected = results.find((r) => r.id === selectedId);
  const docCheck = useDocumentationStatus(selectedId || "");
  
  const { data: blockingData } = useQuery({
    queryKey: ["blocking-irregularities", selectedId, activeEventId],
    queryFn: async () => {
      if (!selectedId || !activeEventId) return { has_blocking: false, items: [] };
      const { data, error } = await supabase.rpc("get_blocking_irregularities", { 
        p_participant_id: selectedId,
        p_event_id: activeEventId
      });
      if (error) throw error;
      const items = (data || []) as any[];
      return { has_blocking: items.length > 0, items };
    },
    enabled: !!selectedId && !!activeEventId,
  });

  const activeCredQuery = useQuery({
    queryKey: ["active-cred", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, credential_code")
        .eq("participant_id", selectedId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedId,
  });

  const emitMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !activeEventId) return;
      const credentialCode = generateCredentialCode();
      const qrCodeValue = await generateSignedQrCodeValue(activeEventId, selected.id, credentialCode);
      const { error } = await (supabase as any).rpc("issue_participant_credential", {
        p_event_id: activeEventId,
        p_participant_id: selected.id,
        p_credential_code: credentialCode,
        p_qr_code_value: qrCodeValue,
        p_user_id: user?.id,
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
  const irregsOk = blockingData ? !blockingData.has_blocking : true;
  const allChecksLoading =
    preflight.isLoading || docCheck.isLoading || !blockingData;
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
              {results.map((p: any) => {
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
                            {(p.delegations as any)?.name ?? "Sem delegação"} ·{" "}
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
              loading={!blockingData}
              ok={irregsOk}
              detail={
                blockingData?.has_blocking
                  ? `${blockingData.items.length} bloqueante(s) aberta(s).`
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
          <CheckCircle2 className="h-5 w-5 text-green-600" />
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
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
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
      ? "text-green-600"
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
