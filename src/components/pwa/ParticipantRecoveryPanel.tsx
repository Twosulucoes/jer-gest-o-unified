import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, UserCheck, UserX, LinkIcon, X, User } from "lucide-react";
import { toast } from "sonner";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useAuth } from "@/hooks/useAuth";
import { extractCandidates } from "@/lib/resolveQrCredential";

export interface RecoveryResult {
  participant_id: string;
  full_name: string;
}

interface Props {
  /** Valor bruto do QR que não foi reconhecido */
  pendingCode: string;
  /** Estado do participante detectado antes de abrir o painel */
  detectedState: "nao_credenciado" | "nao_cadastrado" | "sem_cache";
  eventId: string | null;
  /** Rótulo da operação que será retomada após o vínculo (ex: "Registrar refeição") */
  operationLabel: string;
  /** Chamado após vincular com sucesso: pai pode retomar a operação */
  onLinked: (result: RecoveryResult) => void;
  onDismiss: () => void;
}

/**
 * Painel inline de recuperação para QR não reconhecido.
 *
 * Fluxo:
 *  1. Exibe o código escaneado + estado detectado
 *  2. Operador busca participante por nome/CPF
 *  3. Para "não credenciado": botão "Vincular e [operação]" → link_external_credential
 *  4. Para "não cadastrado": aviso para cadastrar no admin
 *  5. Após vínculo → chama onLinked para o módulo pai retomar a operação
 */
export function ParticipantRecoveryPanel({
  pendingCode,
  detectedState,
  eventId,
  operationLabel,
  onLinked,
  onDismiss,
}: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hits, setHits] = useState<ParticipantManualSearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null); // participant_id em linking

  // Extrai o código canônico do valor bruto para exibição
  const { values: candidates } = extractCandidates(pendingCode);
  const displayCode = candidates[0] ?? pendingCode;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!eventId || debouncedQuery.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    void searchParticipantsByNameOrCpf(debouncedQuery, eventId)
      .then((rows) => { if (!cancelled) setHits(rows); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, eventId]);

  const handleLink = async (participant: ParticipantManualSearchRow) => {
    if (!eventId || !user) return;
    setLinking(participant.participant_id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sessão expirada — faça login novamente.");

      // Verifica se já existe credencial externa ativa (para troca)
      const { data: existing } = await supabase
        .from("external_credentials")
        .select("id")
        .eq("participant_id", participant.participant_id)
        .eq("event_id", eventId)
        .eq("status", "active")
        .maybeSingle();

      const { error } = await (supabase as any).rpc("link_external_credential", {
        p_event_id: eventId,
        p_participant_id: participant.participant_id,
        p_credential_code: displayCode,
        p_user_id: session.user.id,
        p_replace_id: existing?.id ?? null,
        p_is_internal_mode: false,
      });

      if (error) {
        const raw = (error.message || "").toLowerCase();
        if (raw.includes("já vinculada a outro") || raw.includes("uq_external_credentials_event_code")) {
          throw new Error("Este código já está com outro participante. Cancele o vínculo atual no admin.");
        }
        if (raw.includes("uq_external_credentials_active_participant") || raw.includes("uq_participant_credentials_active")) {
          throw new Error("Este participante já possui credencial ativa. Use a opção de substituir no admin.");
        }
        throw error;
      }

      toast.success(`Credencial vinculada! ${participant.full_name} agora está credenciado.`);
      if (navigator.vibrate) navigator.vibrate(200);
      onLinked({ participant_id: participant.participant_id, full_name: participant.full_name });
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular credencial");
    } finally {
      setLinking(null);
    }
  };

  return (
    <Card className="border-amber-400/50 bg-amber-50/10 shadow-app-sm dark:bg-amber-950/10">
      <CardContent className="space-y-4 p-4">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {detectedState === "nao_credenciado"
                ? "Participante sem credencial vinculada"
                : "Participante não encontrado"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              Código: <span className="font-semibold text-foreground">{displayCode}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Instrução */}
        <p className="text-xs text-muted-foreground">
          {detectedState === "nao_credenciado"
            ? "Busque o participante para vincular este código à credencial dele."
            : "Busque o participante. Se não encontrar, ele precisa ser cadastrado no admin."}
        </p>

        {/* Campo de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Nome ou CPF…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 border-border/80 bg-card/90 pl-10"
          />
        </div>

        {/* Resultados */}
        {searching && (
          <div className="flex items-center justify-center gap-2 py-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Buscando…</span>
          </div>
        )}

        {!searching && debouncedQuery.length >= 2 && hits.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
            <UserX className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum participante encontrado.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastre-o no admin para prosseguir.
            </p>
          </div>
        )}

        {hits.length > 0 && (
          <div className="max-h-56 space-y-2 overflow-y-auto">
            {hits.map((row) => {
              const jaCredenciado = !!row.credentialed_at;
              const isLinking = linking === row.participant_id;

              return (
                <div
                  key={row.participant_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{row.full_name}</span>
                    </div>
                    {row.cpf && (
                      <p className="mt-0.5 text-xs text-muted-foreground">CPF: {row.cpf}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {jaCredenciado ? (
                      <Badge variant="outline" className="border-green-500/50 text-xs text-green-600 dark:text-green-400">
                        <UserCheck className="mr-1 h-3 w-3" />
                        Credenciado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="module"
                        className="h-7 gap-1 px-2 text-xs"
                        disabled={isLinking}
                        onClick={() => handleLink(row)}
                      >
                        {isLinking ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <LinkIcon className="h-3 w-3" />
                        )}
                        {isLinking ? "Vinculando…" : `Vincular e ${operationLabel}`}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
