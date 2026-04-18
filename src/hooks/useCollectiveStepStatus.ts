import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StepStatus = "completed" | "partial" | "blocked" | "available";

export interface StepStatusInfo {
  status: StepStatus;
  blockMessage?: string;
}

export type StepStatusMap = Record<string, StepStatusInfo>;

const BLOCK_MESSAGES: Record<string, string> = {
  structure: "Confirme as equipes no Passo 1 antes de criar a estrutura",
  matches: "Crie a estrutura de grupos no Passo 2 antes de gerar confrontos",
  agenda: "Gere as partidas no Passo 3 antes de agendar",
  standings: "Gere as partidas no Passo 3 antes de ver a classificação",
  results: "Gere as partidas no Passo 3 antes de lançar resultados",
};

export function useCollectiveStepStatus(
  eventId: string | null,
  sportEventId: string | null,
  isCollective: boolean,
  isTimeMark: boolean = false,
) {
  const isEnabled = isCollective || isTimeMark;
  // Active teams count
  const { data: activeTeamsCount = 0, isLoading: loadingTeams } = useQuery({
    queryKey: ["collective-step-teams", eventId, sportEventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!)
        .eq("status", "active");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId && !!sportEventId && isCollective,
    staleTime: 30_000,
  });

  // Individual athletes count (for time/mark)
  const { data: activeAthletesCount = 0, isLoading: loadingAthletes } = useQuery({
    queryKey: ["individual-step-athletes", eventId, sportEventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("participant_sport_events")
        .select("id", { count: "exact", head: true })
        .eq("sport_event_id", sportEventId!)
        .in("status", ["confirmed", "active", "inscrito"]);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId && !!sportEventId && isTimeMark && !isCollective,
    staleTime: 30_000,
  });

  // Phases count
  const { data: phasesCount = 0, isLoading: loadingPhases } = useQuery({
    queryKey: ["collective-step-phases", eventId, sportEventId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("competition_phases")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId && !!sportEventId && isEnabled,
    staleTime: 30_000,
  });

  // Draw lots count (equipes alocadas em grupos)
  const { data: drawLotsCount = 0, isLoading: loadingDrawLots } = useQuery({
    queryKey: ["collective-step-drawlots", eventId, sportEventId],
    queryFn: async () => {
      // Get phase ids for this sport_event, then check draw_lots
      const { data: phases, error: phErr } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!);
      if (phErr) throw phErr;
      if (!phases || phases.length === 0) return 0;

      const { data: groups, error: grErr } = await supabase
        .from("competition_groups")
        .select("id")
        .in("phase_id", phases.map((p) => p.id));
      if (grErr) throw grErr;
      if (!groups || groups.length === 0) return 0;

      const { count, error } = await supabase
        .from("group_draw_lots")
        .select("team_id", { count: "exact", head: true })
        .in("group_id", groups.map((g) => g.id));
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId && !!sportEventId && isCollective,
    staleTime: 30_000,
  });

  // Heat entries count (for individual time/mark)
  const { data: heatEntriesCount = 0, isLoading: loadingHeatEntries } = useQuery({
    queryKey: ["individual-step-heat-entries", eventId, sportEventId],
    queryFn: async () => {
      const { data: phases, error: phErr } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!)
        .eq("phase_type", "heats");
      if (phErr) throw phErr;
      if (!phases || phases.length === 0) return 0;
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id")
        .in("phase_id", phases.map((p) => p.id));
      if (!matches || matches.length === 0) return 0;
      const { count, error } = await supabase
        .from("competition_match_entries")
        .select("id", { count: "exact", head: true })
        .in("match_id", matches.map((m) => m.id));
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!eventId && !!sportEventId && isTimeMark && !isCollective,
    staleTime: 30_000,
  });

  // Matches stats
  const { data: matchStats, isLoading: loadingMatches } = useQuery({
    queryKey: ["collective-step-matches", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, venue_id, status")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!);
      if (error) throw error;
      const matches = data ?? [];
      const total = matches.length;
      const scheduled = matches.filter(
        (m) => m.match_date && m.start_time && m.venue_id
      ).length;
      const finished = matches.filter((m) => m.status === "finished").length;
      return { total, scheduled, finished };
    },
    enabled: !!eventId && !!sportEventId && isEnabled,
    staleTime: 30_000,
  });

  // Results stats
  const { data: resultStats, isLoading: loadingResults } = useQuery({
    queryKey: ["collective-step-results", eventId, sportEventId],
    queryFn: async () => {
      // Get match ids
      const { data: matches, error: mErr } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!);
      if (mErr) throw mErr;
      if (!matches || matches.length === 0) return { total: 0, launched: 0, published: 0 };

      const matchIds = matches.map((m) => m.id);
      const { data: results, error } = await supabase
        .from("competition_match_results")
        .select("id, result_status")
        .in("match_id", matchIds);
      if (error) throw error;
      const all = results ?? [];
      return {
        total: matches.length,
        launched: all.length,
        published: all.filter((r) => r.result_status === "publicado").length,
      };
    },
    enabled: !!eventId && !!sportEventId && isEnabled,
    staleTime: 30_000,
  });

  const isLoading = loadingTeams || loadingAthletes || loadingPhases || loadingDrawLots || loadingHeatEntries || loadingMatches || loadingResults;

  const stepStatus: StepStatusMap = useMemo(() => {
    if (!isEnabled) return {};

    const mt = matchStats ?? { total: 0, scheduled: 0, finished: 0 };
    const rs = resultStats ?? { total: 0, launched: 0, published: 0 };

    // Step 1 — Participants/Equipes/Atletas
    const step1Completed = isCollective ? activeTeamsCount > 0 : activeAthletesCount > 0;

    // Step 2 — Estrutura
    const step2Completed = isCollective
      ? phasesCount > 0 && drawLotsCount > 0
      : phasesCount > 0 && heatEntriesCount > 0;
    const step2Blocked = !step1Completed;

    // Step 3 — Confrontos/Baterias (for time/mark, heats ARE the matches)
    const step3Completed = mt.total > 0;
    const step3Blocked = !step2Completed;

    // Step 4 — Agenda
    const step4Completed = mt.total > 0 && mt.scheduled === mt.total;
    const step4Partial = mt.total > 0 && mt.scheduled > 0 && mt.scheduled < mt.total;
    const step4Blocked = !step3Completed;

    // Step 5 — Classificação
    const step5Completed = mt.finished > 0;
    const step5Blocked = !step3Completed;

    // Step 6 — Resultados
    const step6Completed = rs.total > 0 && rs.published > 0 && rs.published >= rs.launched && rs.launched >= rs.total;
    const step6Partial = rs.launched > 0 && !step6Completed;
    const step6Blocked = !step3Completed;

    const status = (completed: boolean, blocked: boolean, partial = false): StepStatus => {
      if (blocked) return "blocked";
      if (completed) return "completed";
      if (partial) return "partial";
      return "available";
    };

    return {
      participants: { status: step1Completed ? "completed" : "available" },
      structure: { status: status(step2Completed, step2Blocked), blockMessage: step2Blocked ? BLOCK_MESSAGES.structure : undefined },
      matches: { status: status(step3Completed, step3Blocked), blockMessage: step3Blocked ? BLOCK_MESSAGES.matches : undefined },
      agenda: { status: status(step4Completed, step4Blocked, step4Partial), blockMessage: step4Blocked ? BLOCK_MESSAGES.agenda : undefined },
      standings: { status: status(step5Completed, step5Blocked), blockMessage: step5Blocked ? BLOCK_MESSAGES.standings : undefined },
      results: { status: status(step6Completed, step6Blocked, step6Partial), blockMessage: step6Blocked ? BLOCK_MESSAGES.results : undefined },
      pending: { status: "available" },
    };
  }, [isEnabled, isCollective, activeTeamsCount, activeAthletesCount, phasesCount, drawLotsCount, heatEntriesCount, matchStats, resultStats]);

  const completedCount = useMemo(() => {
    return Object.values(stepStatus).filter((s) => s.status === "completed").length;
  }, [stepStatus]);

  return { stepStatus, isLoading, completedCount };
}
