import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type VenueRow = Tables<"venues">;

export interface UseVenuesByStageOptions {
  /** Evento de escopo. Obrigatório para a query disparar. */
  eventId?: string | null;
  /** Etapa para filtrar via venue_event_stages (N:N). null/undefined => todas as etapas do evento. */
  stageId?: string | null;
  /** Se true, retorna apenas venues com is_active = true (default: true). */
  onlyActive?: boolean;
  /** Colunas a selecionar de venues (default: "*"). */
  select?: string;
  /** Habilitar query (default: true). */
  enabled?: boolean;
}

/**
 * Fonte única para listar venues escopados por evento e (opcionalmente) por etapa.
 *
 * Resolução por etapa: busca venue_ids em venue_event_stages e filtra venues por essa lista.
 * Sem stageId, retorna todos os venues do evento.
 *
 * Use em qualquer tela que exiba/escolha locais — evita queries duplicadas e
 * mantém a regra N:N consistente.
 */
export function useVenuesByStage<T = VenueRow>(opts: UseVenuesByStageOptions) {
  const { eventId, stageId, onlyActive = true, select = "*", enabled = true } = opts;

  return useQuery({
    queryKey: ["venues-by-stage", eventId ?? null, stageId ?? null, onlyActive, select],
    enabled: !!eventId && enabled,
    queryFn: async (): Promise<T[]> => {
      // 1) Resolve venue_ids da etapa (se houver)
      let stageVenueIds: string[] | null = null;
      if (stageId) {
        const { data: links, error: linkErr } = await (supabase as any)
          .from("venue_event_stages")
          .select("venue_id")
          .eq("event_stage_id", stageId);
        if (linkErr) throw linkErr;
        stageVenueIds = (links ?? []).map((l: any) => l.venue_id as string);
        if (stageVenueIds.length === 0) return [] as T[];
      }

      // 2) Busca venues do evento
      let q = supabase
        .from("venues")
        .select(select)
        .eq("event_id", eventId!)
        .order("name");
      if (onlyActive) q = q.eq("is_active", true);
      if (stageVenueIds) q = q.in("id", stageVenueIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

/**
 * Variante leve para dropdowns: id, name, address, city.
 */
export function useVenuesPicker(opts: UseVenuesByStageOptions) {
  return useVenuesByStage<{ id: string; name: string; address: string | null; city: string | null }>({
    ...opts,
    select: "id, name, address, city",
  });
}

/**
 * Helper imperativo (fora de React Query) para resolver os venue_ids de uma etapa.
 * Retorna null se stageId for falsy (sem filtro). Retorna [] se a etapa não tem venues.
 */
export async function fetchVenueIdsForStage(stageId: string | null | undefined): Promise<string[] | null> {
  if (!stageId) return null;
  const { data, error } = await (supabase as any)
    .from("venue_event_stages")
    .select("venue_id")
    .eq("event_stage_id", stageId);
  if (error) throw error;
  return (data ?? []).map((l: any) => l.venue_id as string);
}
