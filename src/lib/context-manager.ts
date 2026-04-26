import { QueryClient } from "@tanstack/react-query";
import { clearPersistedFilters } from "@/hooks/usePersistedState";

/**
 * Standardizes the "context change" flow.
 * Should be called whenever the user switches between:
 * - Event
 * - Sport
 * - Stage
 * - Phase
 */
export const handleContextChange = (queryClient: QueryClient) => {
  console.log("Context change detected. Clearing filters and invalidating queries...");
  
  // 1. Clear all persisted UI filters/states
  clearPersistedFilters();
  
  // 2. Invalidate all queries to ensure fresh data for the new context
  // This will force all active queries to refetch and clear the cache for inactive ones
  queryClient.invalidateQueries();
};
