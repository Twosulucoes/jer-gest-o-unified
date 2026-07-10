import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE = 30_000;

// Roraima usa o fuso America/Boa_Vista (UTC-4, sem horário de verão).
// "Hoje" precisa ser o dia-calendário local — usar UTC atribui as refeições
// servidas à noite (após ~20h local) ao dia seguinte.
const todayISO = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Boa_Vista",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// Limites do dia BRT expressos como instantes UTC (offset fixo -04:00).
const brtDayBounds = (isoDate: string) => {
  const start = new Date(`${isoDate}T00:00:00-04:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

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
          // Contagem no servidor (RPC) para não sofrer o teto de 1000 linhas
          // do PostgREST — antes o browser baixava as linhas e contava com
          // P.length, travando participantes em 1000 e subestimando os
          // credenciados (que eram derivados apenas desses 1000 IDs).
          const { data, error } = await supabase.rpc("get_stage_participation_counts", { p_stage_id: stageId! });
          if (error) {
            console.error("Error fetching participation counts for stage dashboard:", error);
            throw error;
          }
          const row = (Array.isArray(data) ? data[0] : data) as { participants: number; credentialed: number } | undefined;
          return {
            participantsCount: row?.participants ?? 0,
            credentialedCount: row?.credentialed ?? 0,
          };
        }, { participantsCount: 0, credentialedCount: 0 }),
      },
      {
        queryKey: ["stage_dash", "matches", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          // Use table name directly without cast as any if possible, or ensure correct schema
          const { data, error } = await supabase.from("competition_matches")
            .select("id, status, sport_event_id, start_time, match_date, sport_events(name, sports(name))")
            .eq("event_stage_id", stageId!);
          
          if (error) {
            console.error("Error fetching matches for stage dashboard:", error);
            throw error;
          }
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "lodging_units", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data, error } = await supabase.from("lodging_units" as any)
            .select("id, capacity")
            .eq("event_stage_id", stageId!)
            .eq("is_active", true);
          
          if (error) {
            console.error("Error fetching lodging units for stage dashboard:", error);
            throw error;
          }
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
          const { data, error } = await supabase.from("meal_windows" as any)
            .select("id, service_date")
            .eq("event_stage_id", stageId!);
          
          if (error) {
            console.error("Error fetching meal windows for stage dashboard:", error);
            throw error;
          }
          return (data ?? []) as any[];
        }, []),
      },
      {
        queryKey: ["stage_dash", "referee_indisponibilities", stageId],
        enabled,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { data, error } = await supabase.rpc("get_unhandled_referee_indisponibilities", { p_etapa_id: stageId });
          if (error) {
            console.error("Error fetching referee indisponibilities:", error);
            throw error;
          }
          return (data ?? []) as any[];
        }, []),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const refetchAll = async () => { await Promise.all(queries.map((q) => q.refetch())); };

  const [participantsResult, matches, lodgingUnits, lodgingOccupied, mealWindows, refereeIndisponibilities] =
    queries.map((q) => q.data) as [{ participantsCount: number; credentialedCount: number } | undefined, any[], any[], number, any[], any[]];

  const windowIds = (mealWindows ?? []).map(w => w.id);

  // Soma meal_consumptions (vinculado a participante) + meal_consumptions_unlinked
  // (QR/crachá escaneado sem participant_id resolvido) — mesma definição de
  // "consumo" já unificada em AlimentacaoDashboardPage.tsx/AlimentacaoConsumoPage.tsx;
  // antes só lia meal_consumptions e todo crachá avulso desaparecia do card
  // "Refeições" do Painel da Etapa.
  const consumptionQuery = useQueries({
    queries: [
      {
        queryKey: ["stage_dash", "consumptions_total", stageId, windowIds.join(",")],
        enabled: enabled && windowIds.length > 0,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const [linked, unlinked] = await Promise.all([
            supabase.from("meal_consumptions" as any)
              .select("id", { count: "exact", head: true })
              .in("meal_window_id", windowIds),
            supabase.from("meal_consumptions_unlinked" as any)
              .select("id", { count: "exact", head: true })
              .in("meal_window_id", windowIds),
          ]);
          if (linked.error) {
            console.error("Error fetching meal consumptions count:", linked.error);
            throw linked.error;
          }
          if (unlinked.error) {
            console.error("Error fetching unlinked meal consumptions count:", unlinked.error);
            throw unlinked.error;
          }
          return (linked.count ?? 0) + (unlinked.count ?? 0);
        }, 0),
      },
      {
        queryKey: ["stage_dash", "consumptions_today", stageId, windowIds.join(","), todayISO()],
        enabled: enabled && windowIds.length > 0,
        staleTime: STALE,
        queryFn: () => safe(async () => {
          const { startISO, endISO } = brtDayBounds(todayISO());
          const [linked, unlinked] = await Promise.all([
            supabase.from("meal_consumptions" as any)
              .select("id", { count: "exact", head: true })
              .in("meal_window_id", windowIds)
              .gte("consumed_at", startISO)
              .lt("consumed_at", endISO),
            supabase.from("meal_consumptions_unlinked" as any)
              .select("id", { count: "exact", head: true })
              .in("meal_window_id", windowIds)
              .gte("consumed_at", startISO)
              .lt("consumed_at", endISO),
          ]);
          if (linked.error) {
            console.error("Error fetching today meal consumptions count:", linked.error);
            throw linked.error;
          }
          if (unlinked.error) {
            console.error("Error fetching today unlinked meal consumptions count:", unlinked.error);
            throw unlinked.error;
          }
          return (linked.count ?? 0) + (unlinked.count ?? 0);
        }, 0),
      },
    ]
  });

  const mealsTotal = (consumptionQuery[0].data ?? 0) as number;
  const mealsTodayCount = (consumptionQuery[1].data ?? 0) as number;
  const isLoadingAll = isLoading || consumptionQuery.some((q) => q.isLoading);

  const participantsCount = participantsResult?.participantsCount ?? 0;
  const credentialed = participantsResult?.credentialedCount ?? 0;
  const MA = matches ?? [];
  const LU = lodgingUnits ?? [];
  const LO = lodgingOccupied ?? 0;
  const matchesDone = MA.filter(m => m.status === 'completed' || m.status === 'finished').length;

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

  const today = todayISO();
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
      participants: participantsCount,
      credentialed,
      matches_total: MA.length,
      matches_done: matchesDone,
      meals_total: mealsTotal,
      meals_today: mealsTodayCount,
      lodging_capacity: LU.reduce((acc, curr) => acc + (curr.capacity || 0), 0),
      lodging_occupied: LO,
      unhandled_indisponibilities: (refereeIndisponibilities ?? []).length
    },
    competicao: {
      by_sport: bySport,
      today: todayMatches
    }
  };

  // Horário real da última atualização dos dados (não do último render).
  const lastUpdatedMs = Math.max(
    0,
    ...queries.map((q) => q.dataUpdatedAt || 0),
    ...consumptionQuery.map((q) => q.dataUpdatedAt || 0),
  );
  const lastUpdated = lastUpdatedMs > 0 ? new Date(lastUpdatedMs) : null;

  return { data, isLoading: isLoadingAll, refetchAll, lastUpdated };
}
