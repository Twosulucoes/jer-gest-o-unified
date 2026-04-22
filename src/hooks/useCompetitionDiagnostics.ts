import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAllCatalogTables, getAllCatalogRpcs, competitionFeatureCatalog } from "@/config/competitionFeatureCatalog";

export interface DiagnosticKpis {
  sport_events: number | null;
  participants: number | null;
  enrollments: number | null;
  teams: number | null;
  matches_total: number | null;
  matches_scheduled: number | null;
  matches_finished: number | null;
  matches_no_result: number | null;
  results_total: number | null;
  bulletins_total: number | null;
  bulletins_published: number | null;
  irregularities_open: number | null;
  isGlobal: boolean;
}

export interface DiagnosticResult {
  generated_at: string;
  event_id: string | null;
  routes: { key: string; label: string; route: string }[];
  features: typeof competitionFeatureCatalog;
  supabase: {
    tables: string[];
    rpcs: string[];
    storageBuckets: string[];
  };
  diagnostics: {
    kpis: DiagnosticKpis;
    found: { tables: string[]; rpcs: string[] };
    missing: { tables: string[]; rpcs: string[]; routes: string[] };
    notes: string[];
  };
}

async function safeCount(table: string, eventId: string | null): Promise<number | null> {
  try {
    let query = supabase.from(table as any).select("id", { count: "exact", head: true });
    if (eventId) {
      query = query.eq("event_id", eventId);
    }
    const { count, error } = await query;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

async function runDiagnostics(eventId: string | null): Promise<DiagnosticResult> {
  const notes: string[] = [];
  const foundTables: string[] = [];
  const missingTables: string[] = [];

  // Test which tables exist by doing a head query
  const allTables = getAllCatalogTables();
  for (const table of allTables) {
    try {
      const { error } = await supabase.from(table as any).select("id", { count: "exact", head: true }).limit(0);
      if (error && (error.message.includes("does not exist") || error.code === "42P01")) {
        missingTables.push(table);
      } else {
        foundTables.push(table);
      }
    } catch {
      missingTables.push(table);
    }
  }

  const isGlobal = !eventId;
  if (isGlobal) {
    notes.push("Nenhum evento selecionado; contagens globais (sem filtro por evento).");
  }

  // KPIs
  const [
    sport_events, participants, enrollments, teams,
    matches_total, results_total, bulletins_total, irregularities_open,
  ] = await Promise.all([
    safeCount("sport_events", eventId),
    safeCount("participants", eventId),
    safeCount("participant_sport_events", null), // no event_id column
    safeCount("teams", eventId),
    safeCount("competition_matches", eventId),
    safeCount("competition_match_results", null), // no event_id column directly
    safeCount("official_bulletins", eventId),
    eventId
      ? (async () => {
          const { count } = await supabase
            .from("participation_irregularities")
            .select("id", { count: "exact", head: true })
            .eq("event_id", eventId)
            .eq("status", "open");
          return count ?? 0;
        })()
      : safeCount("participation_irregularities", null),
  ]);

  // Match status breakdown
  let matches_scheduled: number | null = null;
  let matches_finished: number | null = null;
  let matches_no_result: number | null = null;
  try {
    let q = supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "scheduled");
    if (eventId) q = q.eq("event_id", eventId);
    const { count: sc } = await q;
    matches_scheduled = sc ?? 0;

    let q2 = supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("status", "finished");
    if (eventId) q2 = q2.eq("event_id", eventId);
    const { count: fc } = await q2;
    matches_finished = fc ?? 0;
  } catch { /* ignore */ }

  // Matches without results — use existing RPC if event selected
  if (eventId) {
    try {
      const { data } = await supabase.rpc("rpc_kpi_partidas_sem_resultado", { p_event_id: eventId });
      if (Array.isArray(data)) {
        matches_no_result = data.length;
      }
    } catch { /* ignore */ }
  }

  // Bulletins published
  let bulletins_published: number | null = null;
  try {
    let q = supabase.from("official_bulletins").select("id", { count: "exact", head: true }).eq("status", "publicado");
    if (eventId) q = q.eq("event_id", eventId);
    const { count } = await q;
    bulletins_published = count ?? 0;
  } catch { /* ignore */ }

  const routes = competitionFeatureCatalog.map((f) => ({ key: f.key, label: f.label, route: f.route }));

  return {
    generated_at: new Date().toISOString(),
    event_id: eventId,
    routes,
    features: competitionFeatureCatalog,
    supabase: {
      tables: getAllCatalogTables(),
      rpcs: getAllCatalogRpcs(),
      storageBuckets: [],
    },
    diagnostics: {
      kpis: {
        sport_events, participants, enrollments, teams,
        matches_total, matches_scheduled, matches_finished, matches_no_result,
        results_total, bulletins_total, bulletins_published, irregularities_open,
        isGlobal,
      },
      found: { tables: foundTables, rpcs: [] },
      missing: { tables: missingTables, rpcs: [], routes: [] },
      notes,
    },
  };
}

export function useCompetitionDiagnostics(eventId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["competition-diagnostics", eventId],
    queryFn: () => runDiagnostics(eventId),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
