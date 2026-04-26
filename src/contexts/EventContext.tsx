import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { clearPersistedFilters } from "@/hooks/usePersistedState";

const STORAGE_KEY = "jer_active_event_id";

interface EventContextValue {
  events: Tables<"events">[];
  eventsLoading: boolean;
  activeEventId: string | null;
  activeEvent: Tables<"events"> | null;
  setActiveEventId: (id: string) => void;
  clearActiveEvent: () => void;
}

const EventContext = createContext<EventContextValue | undefined>(undefined);

export function EventProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [activeEventId, setActiveEventIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const { data: events = [], isLoading: isEventsLoading } = useQuery({
    queryKey: ["events", user?.id ?? "anonymous"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !authLoading && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const eventsLoading = authLoading || (!!user && isEventsLoading);

  // Validate stored event_id still exists
  useEffect(() => {
    if (activeEventId && events.length > 0) {
      const exists = events.some((e) => e.id === activeEventId);
      if (!exists) {
        setActiveEventIdState(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      }
    }
  }, [activeEventId, events]);

  useEffect(() => {
    if (eventsLoading || activeEventId || events.length === 0) return;

    const preferredEvent = [...events].sort((a, b) => {
      const activeStatus = a.status === "active" ? 1 : 0;
      const nextActiveStatus = b.status === "active" ? 1 : 0;
      if (activeStatus !== nextActiveStatus) return nextActiveStatus - activeStatus;
      return b.year - a.year;
    })[0];

    if (!preferredEvent) return;

    setActiveEventIdState(preferredEvent.id);
    try { localStorage.setItem(STORAGE_KEY, preferredEvent.id); } catch {}
  }, [activeEventId, events, eventsLoading]);

  useEffect(() => {
    if (authLoading || user) return;

    setActiveEventIdState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    clearPersistedFilters(); // Clear filters on logout/session expiry
  }, [authLoading, user]);

  const setActiveEventId = useCallback(
    (id: string) => {
      // If we are changing to a different event, clear previous filters
      if (id !== activeEventId) {
        clearPersistedFilters();
      }
      
      setActiveEventIdState(id);
      try { localStorage.setItem(STORAGE_KEY, id); } catch {}
      // Invalidate all event-scoped queries
      queryClient.invalidateQueries();
    },
    [queryClient, activeEventId],
  );

  const clearActiveEvent = useCallback(() => {
    setActiveEventIdState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;

  return (
    <EventContext.Provider
      value={{ events, eventsLoading, activeEventId, activeEvent, setActiveEventId, clearActiveEvent }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEventContext must be used within EventProvider");
  return ctx;
}

/** Shortcut: returns activeEventId, throws-safe for pages behind RequireActiveEvent */
export function useActiveEventId(): string {
  const { activeEventId } = useEventContext();
  return activeEventId!;
}
