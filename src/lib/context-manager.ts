import { QueryClient } from "@tanstack/react-query";
import { clearPersistedFilters } from "@/hooks/usePersistedState";
import { logger } from "@/lib/logger";

/**
... keep existing code
 */
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
