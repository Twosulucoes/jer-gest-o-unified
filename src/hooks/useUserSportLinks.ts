import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";

/**
 * Returns the sport_ids the current user is linked to via user_sport_links.
 * Only relevant for coordenador_modalidade — others get null (meaning "no filter").
 */
export function useUserSportLinks() {
  const { user, hasRole } = useAuth();
  const eventId = useActiveEventId();
  const isCoordModalidade = hasRole("coordenador_modalidade");
  const shouldFilter = isCoordModalidade && !hasRole("admin") && !hasRole("secretaria") && !hasRole("coordenacao_tecnica");

  const { data: sportIds, isLoading } = useQuery({
    queryKey: ["my-sport-links", user?.id, eventId],
    queryFn: async () => {
      if (!user?.id || !eventId) return [];
      const { data } = await supabase
        .from("user_sport_links")
        .select("sport_id")
        .eq("user_id", user.id)
        .eq("event_id", eventId);
      return (data ?? []).map((r) => r.sport_id);
    },
    enabled: shouldFilter && !!user?.id && !!eventId,
  });

  return {
    /** null = no filtering needed (admin/coord_tecnica/etc), [] = coord with no links, string[] = linked sport_ids */
    sportIds: shouldFilter ? (sportIds ?? []) : null,
    isCoordModalidade: shouldFilter,
    isLoading: shouldFilter ? isLoading : false,
  };
}
