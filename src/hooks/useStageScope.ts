import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";

/**
 * Hook unificado de escopo por etapa.
 *
 * Prioridade de detecção:
 *  1. `useParams().stageId` — quando a página está dentro de `/admin/etapa/:stageId/...` (StageLayout)
 *  2. `?stage=` na URL — fallback para compatibilidade com links legados/banner
 *
 * Retorna o `Set<string>` de `participant_id` vinculados à etapa via
 * `participant_event_stages`. Use para filtrar listas de participantes,
 * credenciamento, partidas, etc.
 */
export function useStageScope() {
  const eventId = useActiveEventId();
  const params = useParams<{ stageId?: string }>();
  const [searchParams] = useSearchParams();
  const stageId = params.stageId ?? searchParams.get("stage") ?? null;

  const { data: stage } = useQuery({
    queryKey: ["event_stage_meta", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("id,name,slug,kind,status")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        slug: string;
        kind: string;
        status: string;
      } | null;
    },
  });

  const { data: participantIds, isLoading } = useQuery({
    queryKey: ["stage_participant_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", stageId);
      if (error) {
        // RLS pode bloquear esta tabela para alguns perfis (ex.: coordenador_modalidade).
        // Em vez de retornar Set vazio (que esconde TODOS os participantes da etapa),
        // retornamos null para desabilitar o filtro de etapa e evitar estado falso de "vazio".
        console.warn("[useStageScope] Falha ao carregar participantes da etapa (RLS?). Filtro de etapa desabilitado.", error);
        return null as Set<string> | null;
      }
      return new Set<string>((data ?? []).map((r: any) => r.participant_id as string));
    },
  });

  return {
    stageId,
    stage: stage ?? null,
    participantIds: participantIds ?? null,
    isStageScoped: !!stageId,
    isLoading,
  };
}
