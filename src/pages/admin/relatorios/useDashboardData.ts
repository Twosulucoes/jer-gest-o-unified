import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 30_000;
const todayISO = () => new Date().toISOString().slice(0, 10);

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export interface DelegationProgressRow {
  delegation_id: string;
  name: string;
  total: number;
  credentialed: number;
  pct: number;
}

export interface DailyPoint { date: string; count: number; }
export interface MealDailyPoint { date: string; [mealType: string]: number | string; }
export interface MealByDelegationRow { name: string; total: number; }
export interface SportProgressRow {
  sport_event_id: string;
  name: string;
  total: number;
  done: number;
  published: number;
  pct: number;
}
export interface TodayMatchRow {
  id: string;
  start_time: string | null;
  sport_name: string;
  status: string;
  teams: string;
}

export interface DashboardData {
  resumo: {
    participants_total: number;
    credentialed: number;
    credentials_active: number;
    credentials_today: number;
    matches_total: number;
    matches_done: number;
    matches_published: number;
    meals_total: number;
    meals_today: number;
    lodging_capacity: number;
    lodging_occupied: number;
    transport_trips: number;
    transport_passengers: number;
    transport_vehicles: number;
  };
  credenciamento: {
    daily: DailyPoint[];
    by_delegation: DelegationProgressRow[];
  };
  alimentacao: {
    daily: MealDailyPoint[];
    meal_types: string[];
    by_delegation: MealByDelegationRow[];
  };
  competicao: {
    by_sport: SportProgressRow[];
    today: TodayMatchRow[];
  };
}

export function useDashboardData(eventId?: string | null) {
  const enabled = true; // Sempre habilitado para permitir visão global

  // Initial dummy state when no eventId is provided to avoid crashes
  const dummyData: DashboardData = {
    resumo: {
      participants_total: 0, credentialed: 0, credentials_active: 0, credentials_today: 0,
      matches_total: 0, matches_done: 0, matches_published: 0,
      meals_total: 0, meals_today: 0,
      lodging_capacity: 0, lodging_occupied: 0,
      transport_trips: 0, transport_passengers: 0, transport_vehicles: 0
    },
    credenciamento: { daily: [], by_delegation: [] },
    alimentacao: { daily: [], meal_types: [], by_delegation: [] },
    competicao: { by_sport: [], today: [] },
  };

  const queries = useQueries({
    queries: [
      // 0: participants (id, credentialed_at, delegation_id)
      {
        queryKey: ["dash3", "participants", eventId],
        enabled,
        staleTime: 0,
        queryFn: () => safe(async () => {
          const query = supabase.from("participants")
            .select("id, credentialed_at, delegation_id", { count: "exact" })
            .limit(5000);
          if (eventId) query.eq("event_id", eventId);
          const { data, count, error } = await query;
          if (error) console.error("Error fetching participants:", error);
          // Return both data and the exact count from the header
          return { list: data ?? [], totalCount: count ?? (data?.length || 0) };
        }, { list: [], totalCount: 0 }),
      },
      // 1: credentials
      {
        queryKey: ["dash3", "credentials", eventId],
        enabled,
        staleTime: 0,
        queryFn: () => safe(async () => {
          const query = supabase.from("participant_credentials")
            .select("id, status, issued_at, created_at, participant_id", { count: "exact" })
            .limit(5000);
          if (eventId) query.eq("event_id", eventId);
          const { data, count, error } = await query;
          if (error) console.error("Error fetching credentials:", error);
          return { list: data ?? [], totalCount: count ?? (data?.length || 0) };
        }, { list: [], totalCount: 0 }),
      },
      // 2: delegations
      {
        queryKey: ["dash3", "delegations", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("delegations")
            .select("id, school_name");
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return data ?? [];
        }, [] as { id: string; school_name: string }[]),
      },
      // 3: meal_windows + meal_types
      {
        queryKey: ["dash3", "meal_windows", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("meal_windows")
            .select("id, service_date, meal_type_id, label");
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return data ?? [];
        }, [] as { id: string; service_date: string; meal_type_id: string; label: string | null }[]),
      },
      // 4: meal_types
      {
        queryKey: ["dash3", "meal_types", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("meal_types")
            .select("id, name");
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return data ?? [];
        }, [] as { id: string; name: string }[]),
      },
      // 5: lodging_units
      {
        queryKey: ["dash3", "lodging_units", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("lodging_units")
            .select("id, capacity, is_active")
            .eq("is_active", true);
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return data ?? [];
        }, [] as { id: string; capacity: number; is_active: boolean }[]),
      },
      // 6: lodging_occupancies (active)
      {
        queryKey: ["dash3", "lodging_occupancies", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("lodging_occupancies")
            .select("id", { count: "exact", head: true })
            .in("status", ["allocated", "checked_in"]);
          if (eventId) query.eq("event_id", eventId);
          const { count } = await query;
          return count ?? 0;
        }, 0),
      },
      // 7: transport_trips
      {
        queryKey: ["dash3", "transport_trips", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("transport_trips")
            .select("id");
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return data ?? [];
        }, [] as { id: string }[]),
      },
      // 8: transport_vehicles
      {
        queryKey: ["dash3", "transport_vehicles", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("transport_vehicles")
            .select("id", { count: "exact", head: true });
          if (eventId) query.eq("event_id", eventId);
          const { count } = await query;
          return count ?? 0;
        }, 0),
      },
      // 9: sport_events + sports
      {
        queryKey: ["dash3", "sport_events", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const query = supabase.from("sport_events")
            .select("id, name, sports(name)");
          if (eventId) query.eq("event_id", eventId);
          const { data } = await query;
          return (data ?? []) as Array<{ id: string; name: string | null; sports: { name: string } | null }>;
        }, []),
      },
      // 10: competition_matches
      {
        queryKey: ["dash3", "matches", eventId],
        enabled,
        staleTime: 0,
        queryFn: () => safe(async () => {
          const query = supabase.from("competition_matches")
            .select("id, status, sport_event_id, match_date, start_time");
          if (eventId) query.eq("event_id", eventId);
          const { data, error } = await query;
          if (error) console.error("Error fetching matches:", error);
          return data ?? [];
        }, [] as { id: string; status: string; sport_event_id: string | null; match_date: string | null; start_time: string | null }[]),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  
  const [participants, credentials, delegations, mealWindows, mealTypes, lodgingUnits, lodgingOccupied, trips, vehicles, sportEvents, matches] =
    queries.map((q) => q.data) as [
      { id: string; credentialed_at: string | null; delegation_id: string | null }[],
      { id: string; status: string; issued_at: string | null; created_at: string; participant_id: string | null }[],
      { id: string; school_name: string }[],
      { id: string; service_date: string; meal_type_id: string; label: string | null }[],
      { id: string; name: string }[],
      { id: string; capacity: number; is_active: boolean }[],
      number,
      { id: string }[],
      number,
      Array<{ id: string; name: string | null; sports: { name: string } | null }>,
      { id: string; status: string; sport_event_id: string | null; match_date: string | null; start_time: string | null }[],
    ];

  // Fallbacks defensivos
  const P = participants ?? [];
  const C = credentials ?? [];
  const D = delegations ?? [];
  const MW = mealWindows ?? [];
  const MT = mealTypes ?? [];
  const LU = lodgingUnits ?? [];
  const LO = lodgingOccupied ?? 0;
  const TR = trips ?? [];
  const VE = vehicles ?? 0;
  const SE = sportEvents ?? [];
  const MA = matches ?? [];

  // Resumo: passageiros e refeições exigem queries dependentes — feitas em useQueries adicional abaixo
  const tripIds = TR.map((t) => t.id);
  const windowIds = MW.map((w) => w.id);

  const dependent = useQueries({
    queries: [
      // 0: meal_consumptions (via window IN)
      {
        queryKey: ["dash3", "meal_consumptions", eventId, windowIds.join(",")],
        enabled: enabled && windowIds.length > 0,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data } = await supabase.from("meal_consumptions")
            .select("id, meal_window_id, consumed_at, participant_id")
            .in("meal_window_id", windowIds);
          return data ?? [];
        }, [] as { id: string; meal_window_id: string; consumed_at: string; participant_id: string }[]),
      },
      // 1: transport_passengers boarded
      {
        queryKey: ["dash3", "transport_passengers", eventId, tripIds.join(",")],
        enabled: enabled && tripIds.length > 0,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { count } = await supabase.from("transport_passengers")
            .select("id", { count: "exact", head: true })
            .in("trip_id", tripIds)
            .eq("status", "boarded");
          return count ?? 0;
        }, 0),
      },
      // 2: match results published / done
      {
        queryKey: ["dash3", "match_results", eventId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          if (MA.length === 0) return [] as { match_id: string; result_status: string }[];
          const { data } = await supabase.from("competition_match_results")
            .select("match_id, result_status")
            .in("match_id", MA.map((m) => m.id));
          return data ?? [];
        }, [] as { match_id: string; result_status: string }[]),
      },
    ],
  });

  const consumptions = (dependent[0].data ?? []) as { id: string; meal_window_id: string; consumed_at: string; participant_id: string }[];
  const passengers = (dependent[1].data ?? 0) as number;
  const results = (dependent[2].data ?? []) as { match_id: string; result_status: string }[];

  const isLoadingAll = isLoading || dependent.some((q) => q.isLoading);

  // ----- Cálculos -----
  const today = todayISO();

  // Credenciamento — fonte de verdade: distinct participant_id em participant_credentials.status='active'
  const activeCreds = C.filter((c) => c.status === "active");
  const credActiveDistinctParticipants = new Set(
    activeCreds.map((c) => c.participant_id).filter((x): x is string => !!x)
  ).size;
  const credentialedFromParticipants = P.filter((p) => p.credentialed_at).length;
  // KPI "Credenciados" = participantes únicos com credencial ativa (preferencial),
  // com fallback para flag credentialed_at se não houver credenciais ativas registradas.
  const credentialed = credActiveDistinctParticipants > 0
    ? credActiveDistinctParticipants
    : credentialedFromParticipants;
  const credActive = activeCreds.length; // total de credenciais ativas (pode incluir reemissões)
  const credToday = C.filter((c) => (c.issued_at ?? c.created_at)?.slice(0, 10) === today).length;

  // daily credenciamento (por credentialed_at)
  const credDailyMap = new Map<string, number>();
  for (const p of P) {
    if (!p.credentialed_at) continue;
    const d = p.credentialed_at.slice(0, 10);
    credDailyMap.set(d, (credDailyMap.get(d) ?? 0) + 1);
  }
  const credDaily: DailyPoint[] = [...credDailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // by delegation
  const delName = new Map(D.map((d) => [d.id, d.school_name] as const));
  const byDelTotal = new Map<string, { total: number; cred: number }>();
  for (const p of P) {
    const did = p.delegation_id ?? "__sem__";
    const cur = byDelTotal.get(did) ?? { total: 0, cred: 0 };
    cur.total += 1;
    if (p.credentialed_at) cur.cred += 1;
    byDelTotal.set(did, cur);
  }
  const byDelegation: DelegationProgressRow[] = [...byDelTotal.entries()]
    .map(([did, v]) => ({
      delegation_id: did,
      name: delName.get(did) ?? "Sem delegação",
      total: v.total,
      credentialed: v.cred,
      pct: v.total > 0 ? Math.round((v.cred / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Alimentação
  const mtName = new Map(MT.map((m) => [m.id, m.name] as const));
  const winById = new Map(MW.map((w) => [w.id, w] as const));
  const mealsToday = consumptions.filter((c) => c.consumed_at.slice(0, 10) === today).length;

  // daily empilhado por meal_type
  const dailyMap = new Map<string, Record<string, number>>();
  const usedTypes = new Set<string>();
  for (const c of consumptions) {
    const w = winById.get(c.meal_window_id);
    if (!w) continue;
    const date = w.service_date;
    const tname = mtName.get(w.meal_type_id) ?? "Outro";
    usedTypes.add(tname);
    const row = dailyMap.get(date) ?? {};
    row[tname] = (row[tname] ?? 0) + 1;
    dailyMap.set(date, row);
  }
  const mealTypesList = [...usedTypes];
  const mealsDaily: MealDailyPoint[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => {
      const out: MealDailyPoint = { date };
      for (const t of mealTypesList) out[t] = row[t] ?? 0;
      return out;
    });

  // meals by delegation
  const partDel = new Map(P.map((p) => [p.id, p.delegation_id] as const));
  const mealByDel = new Map<string, number>();
  for (const c of consumptions) {
    const did = partDel.get(c.participant_id) ?? "__sem__";
    mealByDel.set(did, (mealByDel.get(did) ?? 0) + 1);
  }
  const mealsByDelegation: MealByDelegationRow[] = [...mealByDel.entries()]
    .map(([did, total]) => ({ name: delName.get(did) ?? "Sem delegação", total }))
    .sort((a, b) => b.total - a.total);

  // Competição
  const seName = new Map(SE.map((s) => [s.id, s.sports?.name ? `${s.sports.name}${s.name ? " — " + s.name : ""}` : (s.name ?? "Modalidade")] as const));
  const matchesDone = MA.filter((m) => m.status === "completed" || m.status === "finished").length;
  const publishedMatchIds = new Set(results.filter((r) => r.result_status === "publicado").map((r) => r.match_id));
  const matchesPublished = publishedMatchIds.size;

  const sportAgg = new Map<string, { total: number; done: number; pub: number }>();
  for (const m of MA) {
    const sid = m.sport_event_id ?? "__sem__";
    const cur = sportAgg.get(sid) ?? { total: 0, done: 0, pub: 0 };
    cur.total += 1;
    if (m.status === "completed" || m.status === "finished") cur.done += 1;
    if (publishedMatchIds.has(m.id)) cur.pub += 1;
    sportAgg.set(sid, cur);
  }
  const bySport: SportProgressRow[] = [...sportAgg.entries()]
    .map(([sid, v]) => ({
      sport_event_id: sid,
      name: seName.get(sid) ?? "Modalidade",
      total: v.total,
      done: v.done,
      published: v.pub,
      pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const todayMatches: TodayMatchRow[] = MA
    .filter((m) => m.match_date === today)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .map((m) => ({
      id: m.id,
      start_time: m.start_time,
      sport_name: seName.get(m.sport_event_id ?? "") ?? "—",
      status: m.status,
      teams: "",
    }));

  const data: DashboardData = {
    resumo: {
      participants_total: P.length,
      credentialed,
      credentials_active: credActive,
      credentials_today: credToday,
      matches_total: MA.length,
      matches_done: matchesDone,
      matches_published: matchesPublished,
      meals_total: consumptions.length,
      meals_today: mealsToday,
      lodging_capacity: LU.reduce((s, u) => s + (u.capacity ?? 0), 0),
      lodging_occupied: LO,
      transport_trips: TR.length,
      transport_passengers: passengers,
      transport_vehicles: VE,
    },
    credenciamento: { daily: credDaily, by_delegation: byDelegation },
    alimentacao: { daily: mealsDaily, meal_types: mealTypesList, by_delegation: mealsByDelegation },
    competicao: { by_sport: bySport, today: todayMatches },
  };

  if (!isLoadingAll && eventId) {
    // eslint-disable-next-line no-console
    console.log("[KPI dashboard]", {
      eventId,
      participants_total: P.length,
      credentialed_kpi: credentialed,
      cred_active_distinct_participants: credActiveDistinctParticipants,
      cred_active_rows: credActive,
      credentialed_from_participants_flag: credentialedFromParticipants,
      credentials_today: credToday,
      matches_total: MA.length,
      meals_total: consumptions.length,
      lodging_occupied: LO,
      transport_trips: TR.length,
      transport_passengers: passengers,
    });
  }

  const refetchAll = async () => {
    await Promise.all([
      ...queries.map((q) => q.refetch()),
      ...dependent.map((q) => q.refetch())
    ]);
  };

  return { data, isLoading: isLoadingAll, refetchAll, lastUpdated: new Date() };
}
