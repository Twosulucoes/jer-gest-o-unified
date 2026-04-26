/**
 * Pre-flight de credenciamento.
 *
 * Verifica, antes da emissão, se a infraestrutura de banco está disponível:
 *   - RPC `public.issue_participant_credential` existe no schema cache.
 *   - Tabela `public.db_operation_logs` existe (apenas degrada o log).
 *
 * Estratégia (sem permissões extras / sem service_role):
 *   - Chamamos a RPC com payload propositalmente inválido (todos NULL).
 *     O PostgREST devolve `PGRST202` se a função não existe;
 *     se existe, a função levanta `22023` ("Parâmetros obrigatórios ausentes").
 *     Qualquer outro erro também conta como "presente" (assume-se que o probe
 *     chegou ao corpo da função e a regra de validação interna disparou).
 *   - Para a tabela: HEAD com `count=exact` e `limit=0`. 404+`PGRST205` → ausente.
 *
 * Cacheado por 60s para não saturar o backend.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProbeStatus = "ok" | "missing" | "unknown";

export interface CredencialamentoPreflight {
  rpcStatus: ProbeStatus;
  rpcDetail?: string;
  logTableStatus: ProbeStatus;
  logTableDetail?: string;
  /** True quando a RPC essencial está OK (independente da tabela de log). */
  canIssue: boolean;
  checkedAt: string;
}

async function probeIssueRpc(): Promise<{ status: ProbeStatus; detail?: string }> {
  // Probe com NULLs — RPC existe? validação interna dispara 22023; se não existe, 404+PGRST202.
  const { error } = await (supabase as any).rpc("issue_participant_credential", {
    p_event_id: null,
    p_participant_id: null,
    p_credential_code: null,
    p_qr_code_value: null,
    p_user_id: null,
  });

  if (!error) {
    // Cenário improvável (NULLs aceitos). Trata como ok defensivamente.
    return { status: "ok", detail: "RPC respondeu sem erro ao probe." };
  }

  const code = (error as any)?.code as string | undefined;

  if (code === "PGRST202") {
    return {
      status: "missing",
      detail: "Função issue_participant_credential não encontrada no schema cache.",
    };
  }

  // 22023 = parâmetros obrigatórios ausentes (regra interna da função) → função existe.
  if (code === "22023" || code === "P0001" || code === "P0002" || code === "23505") {
    return { status: "ok", detail: `RPC respondeu com código ${code} (presente).` };
  }

  // Outros erros (rede, RLS, etc.) — não dá pra afirmar.
  return { status: "unknown", detail: error.message ?? "Erro inesperado no probe." };
}

async function probeLogTable(): Promise<{ status: ProbeStatus; detail?: string }> {
  const { error } = await (supabase as any)
    .from("db_operation_logs")
    .select("id", { count: "exact", head: true })
    .limit(0);

  if (!error) return { status: "ok" };

  const code = (error as any)?.code as string | undefined;
  if (code === "PGRST205" || code === "42P01") {
    return {
      status: "missing",
      detail: "Tabela db_operation_logs não encontrada (telemetria desativada).",
    };
  }
  return { status: "unknown", detail: error.message };
}

export function useCredencialamentoPreflight() {
  return useQuery<CredencialamentoPreflight>({
    queryKey: ["credenciamento-preflight"],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [rpc, log] = await Promise.all([probeIssueRpc(), probeLogTable()]);
      return {
        rpcStatus: rpc.status,
        rpcDetail: rpc.detail,
        logTableStatus: log.status,
        logTableDetail: log.detail,
        canIssue: rpc.status === "ok" || rpc.status === "unknown",
        checkedAt: new Date().toISOString(),
      };
    },
  });
}
