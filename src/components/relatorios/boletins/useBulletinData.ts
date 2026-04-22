import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BulletinFamily = "score" | "sets" | "combat" | "time" | "mark" | "unknown";

export interface BulletinFilters {
  eventId: string | null | undefined;
  sportEventId: string | null;
  phaseId: string | null; // null = todas as fases
}

export interface RawMatch {
  id: string;
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  status: string;
  round_number: number | null;
  phase_id: string;
  group_id: string | null;
  notes: string | null;
}
export interface RawEntry {
  id: string;
  match_id: string;
  side: string;
  team_id: string | null;
  participant_sport_event_id: string | null;
  seed: number | null;
  display_name: string;
  delegation_name: string | null;
}
export interface RawResult {
  id: string;
  match_id: string;
  match_entry_id: string;
  score: string | null;
  position: number | null;
  outcome: string | null;
  result_status: string;
  result_text: string | null;
  result_type: string | null;
  time_ms: number | null;
  distance_cm: number | null;
  points: number | null;
  combat_detail: any;
}
export interface RawPhase { id: string; name: string; phase_type: string; sort_order: number; status: string; bracket_config: any; }
export interface RawGroup { id: string; phase_id: string; name: string; sort_order: number; }

export interface ValidationAlert {
  type: "warning" | "error";
  message: string;
  details?: string;
}

export interface BulletinDataset {
  family: BulletinFamily;
  rules: any | null;
  phases: RawPhase[];
  groups: RawGroup[];
  matches: RawMatch[];
  entries: RawEntry[];
  results: RawResult[];
  sportEventName: string | null;
  sportName: string | null;
  categoryName: string | null;
  genderScope: string | null;
  validationAlerts: ValidationAlert[];
}

export function useBulletinData(filters: BulletinFilters) {
  const { eventId, sportEventId, phaseId } = filters;
  return useQuery<BulletinDataset | null>({
    queryKey: ["bulletin-data", eventId, sportEventId, phaseId],
    enabled: !!eventId && !!sportEventId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!eventId || !sportEventId) return null;

      // 1) Sport event meta
      const { data: se, error: seErr } = await supabase
        .from("sport_events")
        .select("id, name, sport_id, category_id, sports(name), categories(name, gender_scope)")
        .eq("id", sportEventId)
        .maybeSingle();
      if (seErr) throw seErr;

      // 2) Active rules
      const { data: rulesRow } = await supabase
        .from("sport_event_rules")
        .select("rules, is_active")
        .eq("sport_event_id", sportEventId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rules = (rulesRow?.rules as any) ?? null;
      const family = (rules?.family ?? "unknown") as BulletinFamily;

      // 3) Phases
      const { data: phases = [] } = await supabase
        .from("competition_phases")
        .select("id, name, phase_type, sort_order, status, bracket_config")
        .eq("sport_event_id", sportEventId)
        .order("sort_order", { ascending: true });

      const phaseIds = (phases || []).map((p: any) => p.id);
      const filteredPhaseIds = phaseId ? [phaseId] : phaseIds;

      // 4) Groups (do conjunto filtrado)
      const { data: groups = [] } = filteredPhaseIds.length
        ? await supabase
            .from("competition_groups")
            .select("id, phase_id, name, sort_order")
            .in("phase_id", filteredPhaseIds)
            .order("sort_order", { ascending: true })
        : { data: [] as any[] } as any;

      // 5) Matches
      const { data: matchesRaw = [] } = filteredPhaseIds.length
        ? await supabase
            .from("competition_matches")
            .select("id, match_number, match_date, start_time, status, round_number, phase_id, group_id, notes")
            .eq("event_id", eventId)
            .eq("sport_event_id", sportEventId)
            .in("phase_id", filteredPhaseIds)
            .order("match_date", { ascending: true, nullsFirst: false })
            .order("start_time", { ascending: true, nullsFirst: false })
            .order("match_number", { ascending: true, nullsFirst: false })
        : { data: [] as any[] } as any;

      const matchIds = (matchesRaw || []).map((m: any) => m.id);

      // 6) Entries + display_name (via team / participant)
      let entries: RawEntry[] = [];
      let results: RawResult[] = [];
      if (matchIds.length) {
        const [{ data: ents = [] }, { data: ress = [] }] = await Promise.all([
          supabase
            .from("competition_match_entries")
            .select("id, match_id, side, team_id, participant_sport_event_id, seed, teams(name, delegations(school_name)), participant_sport_events(participants(full_name, delegations(school_name)))")
            .in("match_id", matchIds),
          supabase
            .from("competition_match_results")
            .select("id, match_id, match_entry_id, score, position, outcome, result_status, result_text, result_type, time_ms, distance_cm, points, combat_detail")
            .in("match_id", matchIds),
        ]);

        entries = (ents as any[]).map((e) => {
          const teamName = e.teams?.name ?? null;
          const teamDeleg = e.teams?.delegations?.school_name ?? null;
          const partName = e.participant_sport_events?.participants?.full_name ?? null;
          const partDeleg = e.participant_sport_events?.participants?.delegations?.school_name ?? null;
          const display_name = teamName ?? partName ?? "—";
          const delegation_name = teamDeleg ?? partDeleg ?? null;
          return {
            id: e.id,
            match_id: e.match_id,
            side: e.side,
            team_id: e.team_id,
            participant_sport_event_id: e.participant_sport_event_id,
            seed: e.seed,
            display_name,
            delegation_name,
          } as RawEntry;
        });
        results = ress as RawResult[];
      }

      // Garantir ordenação por data, hora e número (mesmo que venha do banco)
      const sortedMatches = [...(matchesRaw || [])].sort((a, b) => {
        const dateA = a.match_date || "9999-12-31";
        const dateB = b.match_date || "9999-12-31";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        
        const timeA = a.start_time || "99:99";
        const timeB = b.start_time || "99:99";
        if (timeA !== timeB) return timeA.localeCompare(timeB);
        
        return (a.match_number ?? 0) - (b.match_number ?? 0);
      });

      const matchIdToIndex = new Map<string, number>();
      sortedMatches.forEach((m, idx) => matchIdToIndex.set(m.id, idx));

      // Agrupar entries e results por partida seguindo a ordem da programação
      const sortedEntries = [...entries].sort((a, b) => {
        const idxA = matchIdToIndex.get(a.match_id) ?? Infinity;
        const idxB = matchIdToIndex.get(b.match_id) ?? Infinity;
        return idxA - idxB;
      });

      const sortedResults = [...results].sort((a, b) => {
        const idxA = matchIdToIndex.get(a.match_id) ?? Infinity;
        const idxB = matchIdToIndex.get(b.match_id) ?? Infinity;
        return idxA - idxB;
      });

      return {
        family,
        rules,
        phases: phases as RawPhase[],
        groups: groups as RawGroup[],
        matches: sortedMatches as RawMatch[],
        entries: sortedEntries,
        results: sortedResults,
        sportEventName: se?.name ?? null,
        sportName: (se as any)?.sports?.name ?? null,
        categoryName: (se as any)?.categories?.name ?? null,
        genderScope: (se as any)?.categories?.gender_scope ?? null,
      };
    },
  });
}

/** Lê group_points defensivamente (suporta objeto ou wrapper {ordem, criterio}). */
export function getGroupPoints(rules: any): { win: number; draw: number; loss: number; wo_win: number; wo_loss: number } {
  const def = { win: 3, draw: 1, loss: 0, wo_win: 3, wo_loss: 0 };
  const gp = rules?.group_points ?? rules?.group_stage_points ?? null;
  if (!gp || typeof gp !== "object") return def;
  // se vier no formato {ordem, criterio} (incompatível) → fallback
  if ("ordem" in gp && "criterio" in gp && !("win" in gp)) return def;
  return {
    win: Number(gp.win ?? def.win),
    draw: Number(gp.draw ?? def.draw),
    loss: Number(gp.loss ?? def.loss),
    wo_win: Number(gp.wo_win ?? gp.win ?? def.wo_win),
    wo_loss: Number(gp.wo_loss ?? def.wo_loss),
  };
}

export function statusBadgeLabel(status: string): { label: string; tone: "default" | "secondary" | "outline" | "destructive" } {
  switch (status) {
    case "publicado": return { label: "Publicado", tone: "default" };
    case "resultado_validado": return { label: "Validado", tone: "secondary" };
    case "resultado_lancado": return { label: "Lançado", tone: "outline" };
    case "scheduled": return { label: "Agendado", tone: "outline" };
    case "in_progress": return { label: "Em andamento", tone: "secondary" };
    case "completed": return { label: "Concluído", tone: "default" };
    default: return { label: status, tone: "outline" };
  }
}
