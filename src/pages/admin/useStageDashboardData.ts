import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 30_000;
const todayISO = () => new Date().toISOString().slice(0, 10);

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export interface SportProgressRow {
  sport_event_id: string;
  name: string;
  total: number;
  done: number;
  pct: number;
}

export interface TodayMatchRow {
  id: string;
  start_time: string | null;
  sport_name: string;
  status: string;
}

export interface StageDashboardData {
  resumo: {
    participants: number;
    credentialed: number;
    matches_total: number;
    matches_done: number;
    meals_total: number;
    meals_today: number;
    lodging_capacity: number;
    lodging_occupied: number;
    unhandled_indisponibilities: number;
  };
  competicao: {
    by_sport: SportProgressRow[];
    today: TodayMatchRow[];
  };
}

export function useStageDashboardData(stageId?: string | null) {
  const enabled = !!stageId;

  const queries = useQueries({
    queries: [
      {
        queryKey: ["stage_dash", "participants", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("participant_event_stages" as any)
            .select("participant_id, participants(credentialed_at)")
            .eq("event_stage_id", stageId!);
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "matches", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("competition_matches" as any)
            .select("id, status, sport_event_id, start_time, match_date, sport_events(name, sports(name))")
            .eq("event_stage_id", stageId!);
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "lodging_units", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("lodging_units" as any)
            .select("id, capacity")
            .eq("event_stage_id", stageId!)
            .eq("is_active", true);
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "lodging_occupancies", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { count } = await supabase.from("lodging_occupancies" as any)
            .select("id", { count: "exact", head: true })
            .eq("event_stage_id", stageId!)
            .in("status", ["allocated", "checked_in"]);
          return count ?? 0;
        }, 0),
      },
      {
        queryKey: ["stage_dash", "meal_windows", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("meal_windows" as any)
            .select("id, service_date")
            .eq("event_stage_id", stageId!);
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "referee_indisponibilities", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.rpc("get_unhandled_referee_indisponibilities", { p_etapa_id: stageId });
          return (data ?? []) as any[];
        }, []),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const refetchAll = async () => { await Promise.all(queries.map((q) => q.refetch())); };

  const [participants, matches, lodgingUnits, lodgingOccupied, mealWindows, refereeIndisponibilities] =
    queries.map((q) => q.data) as [any[], any[], any[], number, any[], any[]];

  const windowIds = (mealWindows ?? []).map(w => w.id);

  const consumptionQuery = useQueries({
    queries: [
      {
        queryKey: ["stage_dash", "consumptions", stageId, windowIds.join(",")],
        enabled: enabled && windowIds.length > 0,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("meal_consumptions" as any)
            .select("id, consumed_at, meal_window_id")
            .in("meal_window_id", windowIds);
          return (data ?? []) as any[];
        }, []),
      }
    ]
  });

  const consumptions = consumptionQuery[0].data ?? [];
  const isLoadingAll = isLoading || consumptionQuery[0].isLoading;

  const today = todayISO();
  const P = participants ?? [];
  const MA = matches ?? [];
  const LU = lodgingUnits ?? [];
  const LO = lodgingOccupied ?? 0;
  const C = consumptions ?? [];

  const credentialed = P.filter(p => p.participants?.credentialed_at).length;
  const matchesDone = MA.filter(m => m.status === 'completed' || m.status === 'finished').length;
  const mealsToday = C.filter(c => c.consumed_at?.slice(0, 10) === today).length;

  const sportAgg = new Map<string, { name: string; total: number; done: number }>();
  MA.forEach(m => {
    const sid = m.sport_event_id || "sem_id";
    const name = m.sport_events?.sports?.name 
      ? `${m.sport_events.sports.name}${m.sport_events.name ? ' — ' + m.sport_events.name : ''}`
      : "Modalidade";
    const cur = sportAgg.get(sid) ?? { name, total: 0, done: 0 };
    cur.total += 1;
    if (m.status === 'completed' || m.status === 'finished') cur.done += 1;
    sportAgg.set(sid, cur);
  });

  const bySport: SportProgressRow[] = Array.from(sportAgg.entries()).map(([sid, v]) => ({
    sport_event_id: sid,
    name: v.name,
    total: v.total,
    done: v.done,
    pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0
  })).sort((a, b) => b.pct - a.pct);

  const todayMatches: TodayMatchRow[] = MA
    .filter(m => m.match_date === today)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      start_time: m.start_time,
      sport_name: m.sport_events?.sports?.name || "—",
      status: m.status
    }));

  const data: StageDashboardData = {
    resumo: {
      participants: P.length,
      credentialed,
      matches_total: MA.length,
      matches_done: matchesDone,
      meals_total: C.length,
      meals_today: mealsToday,
      lodging_capacity: LU.reduce((acc, curr) => acc + (curr.capacity || 0), 0),
      lodging_occupied: LO,
      unhandled_indisponibilities: (refereeIndisponibilities ?? []).length
    },
    competicao: {
      by_sport: bySport,
      today: todayMatches
    }
  };

  return { data, isLoading: isLoadingAll, refetchAll, lastUpdated: new Date() };
}
