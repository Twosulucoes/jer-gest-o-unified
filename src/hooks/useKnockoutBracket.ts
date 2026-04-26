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
      const { data, error } = await supabase.rpc("rpc_get_knockout_bracket", {
        p_phase_id: phaseId!,
      });
      if (error) throw error;
      return data as unknown as BracketData;
    },
    enabled: !!phaseId,
  });
}
