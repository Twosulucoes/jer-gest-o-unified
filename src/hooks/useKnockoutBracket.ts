import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BracketEntry {
  entry_id: string;
  side: string;
  seed: number | null;
  team_id: string | null;
  team_name: string | null;
  participant_sport_event_id: string | null;
  participant_name: string | null;
  outcome?: string | null;
  is_winner?: boolean;
}

export interface BracketMatch {
  match_id: string;
  match_number: number;
  round_number: number;
  status: string;
  match_date: string | null;
  start_time: string | null;
  venue_id: string | null;
  venue_name: string | null;
  entries: BracketEntry[] | null;
}

export interface BracketRound {
  round_num: number;
  matches: BracketMatch[];
}

export interface BracketConfig {
  format?: string;
  participants_source?: string;
  seeding_mode?: string;
  generated_at?: string;
  generated_by?: string;
  total_participants?: number;
  bracket_size?: number;
  rounds?: number;
  byes?: number;
  seeds?: any[];
}

export interface BracketData {
  phase_id: string;
  bracket_config: BracketConfig;
  rounds: BracketRound[] | null;
}

export function useKnockoutBracket(phaseId: string | null) {
  return useQuery({
    queryKey: ["knockout-bracket", phaseId],
    queryFn: async () => {
      if (!phaseId) return null;

      const { data: phase, error } = await supabase
        .from("competition_phases")
        .select(`
          id,
          bracket_config,
          matches:competition_matches(
            id,
            match_number,
            round_number,
            status,
            match_date,
            start_time,
            venue:venues(name),
            entries:competition_match_entries(
              id,
              side,
              seed,
              team_id,
              team_name:teams(name),
              participant:participant_sport_events(
                participant:participants(
                  persons(name)
                )
              ),
              results:competition_match_results(outcome)
            )
          )
        ` as any)
        .eq("id", phaseId)
        .single();

      if (error) throw error;
      if (!phase) return null;

      const matches = (phase as any).matches || [];
      const roundsMap: Record<number, BracketMatch[]> = {};

      matches.forEach((m: any) => {
        const roundNum = m.round_number || 1;
        if (!roundsMap[roundNum]) roundsMap[roundNum] = [];

        const entries = (m.entries || []).map((e: any) => ({
          entry_id: e.id,
          side: e.side,
          seed: e.seed,
          team_id: e.team_id,
          team_name: e.team_name?.name,
          participant_sport_event_id: e.participant_sport_event_id,
          participant_name: e.participant?.participant?.persons?.name,
          outcome: e.results?.[0]?.outcome,
          is_winner: e.results?.[0]?.outcome === 'win' || e.results?.[0]?.outcome === 'wo_win'
        }));

        roundsMap[roundNum].push({
          match_id: m.id,
          match_number: m.match_number,
          round_number: roundNum,
          status: m.status,
          match_date: m.match_date,
          start_time: m.start_time,
          venue_id: m.venue_id,
          venue_name: m.venue?.name,
          entries
        });
      });

      const rounds = Object.keys(roundsMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((round_num) => ({
          round_num,
          matches: roundsMap[round_num].sort((a, b) => a.match_number - b.match_number),
        }));

      return {
        phase_id: phase.id,
        bracket_config: phase.bracket_config,
        rounds,
      } as BracketData;
    },
    enabled: !!phaseId,
  });
}
