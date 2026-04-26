import { QueryClient } from "@tanstack/react-query";
import { clearPersistedFilters } from "@/hooks/usePersistedState";
import { logger } from "@/lib/logger";

/**
 * Standardizes the "context change" flow.
 * Should be called whenever the user switches between:
 * - Event
 * - Sport
 * - Stage
 * - Phase
 */
/**
 * Whitelist of query key prefixes that depend on the active context (Event, Sport, Stage, Phase).
 * Only these queries will be invalidated on context change to prevent unnecessary refetching
 * of global data like user profiles, system configurations, or public event lists.
 */
const CONTEXT_QUERY_WHITELIST = [
  "standings",
  "stage_dash",
  "event_stage_meta",
  "stage_participant_ids",
  "stage_match_ids",
  "knockout-bracket",
  "minhas-modalidades",
  "partidas-modalidade",
  "partida-detalhe",
  "arbitros-partida",
  "anexos-partida",
  "aovivo_",
  "stage_scoped_",
  "kpi-",
  "central-",
  "competition_",
  "match_",
  "delegation_",
  "participant_",
  "sport-event-rules",
  "event-edition-rules",
  "event-branding",
  "knockout-participants",
  "consolidated-sport-event-rules",
  "qualification-rules",
  "event-participation-rules",
  "group_standings",
  "agenda-matches",
  "bulletin-",
  "medal-table"
];

export const handleContextChange = (queryClient: QueryClient) => {
  logger.log("Context change detected. Clearing filters and invalidating whitelisted queries...");
  
  // 1. Clear all persisted UI filters/states
  clearPersistedFilters();
  
  // 2. Selectively invalidate queries from the whitelist
  // This ensures fresh data for the new context without refetching global data
  CONTEXT_QUERY_WHITELIST.forEach(queryKeyPrefix => {
    queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
  });
};
