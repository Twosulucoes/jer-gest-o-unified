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

  const { data: participantIds, isLoading, error: participantsError } = useQuery({
    queryKey: ["stage_participant_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", stageId);
      if (error) {
        // Modo ESTRITO: propaga o erro para a UI lidar (lançar tela de erro / bloquear listas).
        // Decisão de produto: nunca silenciar a falha do filtro de etapa, porque "vazar" dados
        // entre etapas é pior do que mostrar estado de erro explícito.
        console.error("[useStageScope] Falha ao carregar participantes da etapa.", error);
        throw error;
      }
      return new Set<string>((data ?? []).map((r: any) => r.participant_id as string));
    },
  });

  // Conjunto de partidas (competition_matches.id) cujos participantes/equipes pertencem à etapa.
  // Usado para filtrar listas de partidas/resultados sem precisar carregar tudo do evento.
  const { data: matchIds, error: matchesError } = useQuery({
    queryKey: ["stage_match_ids", stageId, participantIds ? Array.from(participantIds).sort().join(",") : null],
    enabled: !!stageId && !!participantIds,
    queryFn: async () => {
      const ids = Array.from(participantIds!);
      if (ids.length === 0) return new Set<string>();

      // 1) Inscrições individuais da etapa
      const { data: pse, error: pseErr } = await supabase
        .from("participant_sport_events")
        .select("id")
        .in("participant_id", ids);
      if (pseErr) throw pseErr;
      const pseIds = (pse ?? []).map((r: any) => r.id as string);

      // 2) Times com algum atleta da etapa
      const { data: tm, error: tmErr } = await supabase
        .from("team_members")
        .select("team_id")
        .in("participant_id", ids);
      if (tmErr) throw tmErr;
      const teamIds = Array.from(new Set((tm ?? []).map((r: any) => r.team_id as string)));

      // 3) Match entries que referenciem essas inscrições ou times
      const matchSet = new Set<string>();
      if (pseIds.length > 0) {
        const { data: e1, error: e1Err } = await supabase
          .from("competition_match_entries")
          .select("match_id")
          .in("participant_sport_event_id", pseIds);
        if (e1Err) throw e1Err;
        (e1 ?? []).forEach((r: any) => matchSet.add(r.match_id));
      }
      if (teamIds.length > 0) {
        const { data: e2, error: e2Err } = await supabase
          .from("competition_match_entries")
          .select("match_id")
          .in("team_id", teamIds);
        if (e2Err) throw e2Err;
        (e2 ?? []).forEach((r: any) => matchSet.add(r.match_id));
      }
      return matchSet;
    },
  });

  return {
    stageId,
    stage: stage ?? null,
    participantIds: participantIds ?? null,
    matchIds: matchIds ?? null,
    isStageScoped: !!stageId,
    isLoading,
    error: (participantsError ?? matchesError) as Error | null,
  };
}
