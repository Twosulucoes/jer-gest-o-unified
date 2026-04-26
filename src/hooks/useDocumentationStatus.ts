/**
 * Estado agregado da documentação de um participante em um evento.
 *
 * Regras (escolha pragmática até existir flag formal por evento):
 *   - "no-docs"   : nenhum documento cadastrado     → considerado liberado
 *                   (eventos que não usam o módulo).
 *   - "rejected"  : pelo menos 1 documento status='rejected'.
 *   - "expired"   : pelo menos 1 documento aprovado mas com expires_at < hoje.
 *   - "pending"   : pelo menos 1 documento status != 'approved'.
 *   - "approved"  : todos os documentos status='approved' e não expirados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DocumentationStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "expired"
  | "no-docs"
  | "unknown";

export interface DocumentationCheck {
  status: DocumentationStatus;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
  isClear: boolean; // true se a regra permite credenciar
  message: string;
}

export function useDocumentationStatus(eventId?: string, participantId?: string) {
  return useQuery<DocumentationCheck>({
    queryKey: ["documentation-status", eventId, participantId],
    enabled: !!eventId && !!participantId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_documents")
        .select("status, expires_at")
        .eq("event_id", eventId!)
        .eq("participant_id", participantId!);

      if (error) {
        return {
          status: "unknown",
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          expired: 0,
          isClear: false,
          message: `Erro ao carregar documentos: ${error.message}`,
        };
      }

      const docs = data ?? [];
      const today = new Date();
      let approved = 0,
        pending = 0,
        rejected = 0,
        expired = 0;

      for (const d of docs) {
        if (d.status === "rejected") {
          rejected++;
          continue;
        }
        if (d.status === "approved") {
          if (d.expires_at && new Date(d.expires_at) < today) {
            expired++;
          } else {
            approved++;
          }
          continue;
        }
        pending++;
      }

      const total = docs.length;

      if (total === 0) {
        return {
          status: "no-docs",
          total,
          approved,
          pending,
          rejected,
          expired,
          isClear: true,
          message: "Sem documentos exigidos cadastrados — liberado.",
        };
      }
      if (rejected > 0) {
        return {
          status: "rejected",
          total,
          approved,
          pending,
          rejected,
          expired,
          isClear: false,
          message: `${rejected} documento(s) reprovado(s). Resolva antes de emitir.`,
        };
      }
      if (expired > 0) {
        return {
          status: "expired",
          total,
          approved,
          pending,
          rejected,
          expired,
          isClear: false,
          message: `${expired} documento(s) com validade vencida. Renove antes de emitir.`,
        };
      }
      if (pending > 0) {
        return {
          status: "pending",
          total,
          approved,
          pending,
          rejected,
          expired,
          isClear: false,
          message: `${pending} documento(s) pendente(s) de aprovação.`,
        };
      }
      return {
        status: "approved",
        total,
        approved,
        pending,
        rejected,
        expired,
        isClear: true,
        message: `Todos os ${approved} documento(s) aprovados.`,
      };
    },
  });
}
