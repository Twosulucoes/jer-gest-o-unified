import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function useRegistros(sportEventId?: string) {
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["registros-matches", eventId, sportEventId],
    queryFn: async () => {
      if (!eventId) return [];
      let query = supabase
        .from("competition_matches")
        .select(`
          *,
          venue:venues(name),
          sport_event:sport_events(name, sport_id),
          entries:competition_match_entries(
            id,
            side,
            team:teams(id, name, delegation_id, delegation:delegations(school_name)),
            score:match_scores(id, score_final, outcome, score_detail)
          )
        `)
        .eq("event_id", eventId)
        .order("match_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (sportEventId) {
        query = query.eq("sport_event_id", sportEventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const createMatch = useMutation({
    mutationFn: async (values: any) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      // 1. Create match
      const { data: match, error: matchError } = await supabase
        .from("competition_matches")
        .insert({
          event_id: eventId,
          sport_event_id: values.sport_event_id,
          venue_id: values.venue_id,
          match_date: values.match_date,
          start_time: values.start_time,
          source: "simple",
          status: values.status || "scheduled"
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // 2. Create entries
      const entries = [];
      if (values.team_a_id) {
        entries.push({ match_id: match.id, team_id: values.team_a_id, side: "home", event_id: eventId });
      }
      if (values.team_b_id) {
        entries.push({ match_id: match.id, team_id: values.team_b_id, side: "away", event_id: eventId });
      }

      if (entries.length > 0) {
        const { data: createdEntries, error: entriesError } = await supabase
          .from("competition_match_entries")
          .insert(entries)
          .select();
        if (entriesError) throw entriesError;

        // 3. If scores provided, create scores
        if (values.score_a !== undefined || values.score_b !== undefined) {
          const scores = [];
          const results = [];
          
          if (values.team_a_id) {
            const entryA = createdEntries.find(e => e.team_id === values.team_a_id);
            scores.push({
              match_id: match.id,
              match_entry_id: entryA.id,
              score_final: values.score_a?.toString(),
              outcome: values.outcome_a
            });
            results.push({
              match_id: match.id,
              match_entry_id: entryA.id,
              score: values.score_a?.toString(),
              outcome: values.outcome_a,
              recorded_by: user.id,
              result_status: "resultado_lancado"
            });
          }

          if (values.team_b_id) {
            const entryB = createdEntries.find(e => e.team_id === values.team_b_id);
            scores.push({
              match_id: match.id,
              match_entry_id: entryB.id,
              score_final: values.score_b?.toString(),
              outcome: values.outcome_b
            });
            results.push({
              match_id: match.id,
              match_entry_id: entryB.id,
              score: values.score_b?.toString(),
              outcome: values.outcome_b,
              recorded_by: user.id,
              result_status: "resultado_lancado"
            });
          }

          if (scores.length > 0) {
            const { error: scoreErr } = await supabase.from("match_scores").insert(scores);
            if (scoreErr) throw scoreErr;
            
            const { error: resErr } = await supabase.from("competition_match_results").insert(results);
            if (resErr) throw resErr;

            // Update match status to finished if scores recorded
            await supabase.from("competition_matches").update({ status: "finished" }).eq("id", match.id);
          }
        }
      }

      // 4. Assign referees if provided
      if (values.referee_ids && values.referee_ids.length > 0) {
        const assignments = values.referee_ids.map((refId: string) => ({
          match_id: match.id,
          user_id: refId,
          role: "arbitro",
          event_id: eventId
        }));
        const { error: refError } = await supabase.from("match_user_assignments").insert(assignments);
        if (refError) throw refError;
      }

      return match;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registros-matches"] });
      toast.success("Partida registrada com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao registrar partida: " + error.message);
    }
  });

  return {
    matches,
    isLoading,
    createMatch
  };
}
