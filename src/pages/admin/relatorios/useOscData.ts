import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OscDelegationStat {
  delegationId: string;
  schoolName: string;
  network: string | null;
  totalParticipants: number;
  credentialed: number;
  meals: number;
  trips: number;
  medalsGold: number;
  medalsSilver: number;
  medalsBronze: number;
}

export interface OscData {
  event: { name: string; startDate: string | null; endDate: string | null } | null;
  resumo: {
    totalParticipants: number;
    totalAthletes: number;
    totalCredentialed: number;
    totalDelegations: number;
    totalSports: number;
    totalMatches: number;
    totalMatchesPublished: number;
    totalMeals: number;
    totalLodgingOccupied: number;
    totalLodgingCapacity: number;
    totalTrips: number;
    totalPassengers: number;
    totalMedalsGold: number;
    totalMedalsSilver: number;
    totalMedalsBronze: number;
    foodDonationKg: number;
  };
  delegations: OscDelegationStat[];
  sports: Array<{ id: string; name: string; matches: number; published: number }>;
}

const EMPTY: OscData = {
  event: null,
  resumo: {
    totalParticipants: 0, totalAthletes: 0, totalCredentialed: 0, totalDelegations: 0,
    totalSports: 0, totalMatches: 0, totalMatchesPublished: 0, totalMeals: 0,
    totalLodgingOccupied: 0, totalLodgingCapacity: 0, totalTrips: 0, totalPassengers: 0,
    totalMedalsGold: 0, totalMedalsSilver: 0, totalMedalsBronze: 0, foodDonationKg: 0,
  },
  delegations: [],
  sports: [],
};

export function useOscData(eventId: string | null | undefined) {
  return useQuery<OscData>({
    queryKey: ["osc-data", eventId],
    enabled: !!eventId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!eventId) return EMPTY;

      // 1. Evento
      const { data: ev } = await supabase
        .from("events").select("name, start_date, end_date").eq("id", eventId).maybeSingle();

      // 2. Delegações + escola
      const { data: dels } = await supabase
        .from("delegations")
        .select("id, school_name, school_network_type")
        .eq("event_id", eventId);
      const delegations = (dels || []) as Array<{ id: string; school_name: string; school_network_type: string | null }>;

      // 3. Participantes
      const { data: parts } = await supabase
        .from("participants")
        .select("id, delegation_id, participant_type, status")
        .eq("event_id", eventId)
        .limit(5000);
      const participants = (parts || []) as Array<{ id: string; delegation_id: string | null; participant_type: string; status: string }>;
      const partById = new Map(participants.map((p) => [p.id, p]));
      const partIds = participants.map((p) => p.id);

      // 4. Credenciais ativas
      const { data: creds } = partIds.length
        ? await supabase.from("participant_credentials").select("participant_id, status").in("participant_id", partIds)
        : { data: [] as Array<{ participant_id: string; status: string }> };
      const credSet = new Set(((creds || []) as Array<{ participant_id: string; status: string }>)
        .filter((c) => c.status === "ativa" || c.status === "active" || c.status === "issued").map((c) => c.participant_id));

      // 5. Refeições — via meal_windows do evento
      const { data: windows } = await supabase
        .from("meal_windows").select("id").eq("event_id", eventId);
      const windowIds = ((windows || []) as Array<{ id: string }>).map((w) => w.id);

      const { count: mealsCount } = windowIds.length
        ? await supabase.from("meal_consumptions").select("id", { count: "exact", head: true }).in("meal_window_id", windowIds)
        : { count: 0 };

      const { data: mealsByPart } = windowIds.length
        ? await supabase.from("meal_consumptions").select("participant_id").in("meal_window_id", windowIds).limit(50000)
        : { data: [] as Array<{ participant_id: string }> };
      const mealsByDelegation = new Map<string, number>();
      for (const m of (mealsByPart || []) as Array<{ participant_id: string }>) {
        const p = partById.get(m.participant_id);
        if (p?.delegation_id) mealsByDelegation.set(p.delegation_id, (mealsByDelegation.get(p.delegation_id) || 0) + 1);
      }

      // 6. Alojamento
      const { data: lod } = await supabase
        .from("lodging_occupancies")
        .select("id, status, unit_id")
        .eq("event_id", eventId);
      const occupied = ((lod || []) as Array<{ status: string }>).filter((o) => o.status === "active" || o.status === "ocupada").length;

      const { data: units } = await supabase
        .from("lodging_units")
        .select("id, capacity")
        .eq("event_id", eventId);
      const capacity = ((units || []) as Array<{ capacity: number | null }>).reduce((a, u) => a + (u.capacity || 0), 0);

      // 7. Transporte
      const { data: trips } = await supabase
        .from("transport_trips")
        .select("id, status")
        .eq("event_id", eventId);
      const tripsList = (trips || []) as Array<{ id: string; status: string | null }>;
      const tripsDone = tripsList.filter((t) => t.status === "completed" || t.status === "concluida").length;

      const { count: passCount } = await supabase
        .from("transport_passengers")
        .select("id", { count: "exact", head: true })
        .in("trip_id", tripsList.map((t) => t.id).length ? tripsList.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"]);

      // 8. Competição
      const { data: ses } = await supabase
        .from("sport_events")
        .select("id, sports(id, name)")
        .eq("event_id", eventId);
      const sportEvents = (ses || []) as Array<{ id: string; sports: { id: string; name: string } | null }>;

      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id, status, sport_event_id")
        .eq("event_id", eventId)
        .limit(5000);
      const matchesList = (matches || []) as Array<{ id: string; status: string; sport_event_id: string | null }>;

      const { data: results } = await supabase
        .from("competition_match_results")
        .select("match_id, position, result_status, match_entry_id")
        .eq("result_status", "publicado")
        .in("match_id", matchesList.map((m) => m.id).length ? matchesList.map((m) => m.id) : ["00000000-0000-0000-0000-000000000000"]);
      const publishedMatches = new Set(((results || []) as Array<{ match_id: string }>).map((r) => r.match_id));

      // Sports breakdown
      const sportsMap = new Map<string, { name: string; matches: number; published: number }>();
      for (const se of sportEvents) {
        if (se.sports) sportsMap.set(se.sports.id, { name: se.sports.name, matches: 0, published: 0 });
      }
      const seToSport = new Map<string, string>();
      for (const se of sportEvents) if (se.sports) seToSport.set(se.id, se.sports.id);
      for (const m of matchesList) {
        const sid = m.sport_event_id ? seToSport.get(m.sport_event_id) : null;
        if (sid && sportsMap.has(sid)) {
          const s = sportsMap.get(sid)!;
          s.matches++;
          if (publishedMatches.has(m.id)) s.published++;
        }
      }
      const sports = [...sportsMap.entries()]
        .map(([id, v]) => ({ id, name: v.name, ...v }))
        .sort((a, b) => b.matches - a.matches);

      // Medalhas por delegação
      const medalsByDel = new Map<string, { g: number; s: number; b: number }>();
      let totG = 0, totS = 0, totB = 0;

      if ((results || []).length > 0) {
        const matchEntryIds = (results || [])
          .filter((r: any) => r.position && r.position >= 1 && r.position <= 3)
          .map((r: any) => r.match_entry_id);

        if (matchEntryIds.length > 0) {
          const { data: entries } = await supabase
            .from("competition_match_entries")
            .select("id, team_id, participant_sport_event_id")
            .in("id", matchEntryIds);
          const entryMap = new Map(((entries || []) as any[]).map((e) => [e.id, e]));

          const teamIds = [...new Set(((entries || []) as any[]).map((e) => e.team_id).filter(Boolean))];
          const { data: teams } = teamIds.length
            ? await supabase.from("teams").select("id, delegation_id").in("id", teamIds)
            : { data: [] as any[] };
          const teamToDel = new Map(((teams || []) as any[]).map((t) => [t.id, t.delegation_id]));

          const pseIds = [...new Set(((entries || []) as any[]).map((e) => e.participant_sport_event_id).filter(Boolean))];
          const { data: pses } = pseIds.length
            ? await supabase.from("participant_sport_events").select("id, participant_id").in("id", pseIds)
            : { data: [] as any[] };
          const pseToPart = new Map(((pses || []) as any[]).map((x) => [x.id, x.participant_id]));

          for (const r of results as any[]) {
            if (!r.position || r.position < 1 || r.position > 3) continue;
            const e = entryMap.get(r.match_entry_id);
            if (!e) continue;
            let delId: string | null = null;
            if (e.team_id) delId = teamToDel.get(e.team_id) || null;
            else if (e.participant_sport_event_id) {
              const pid = pseToPart.get(e.participant_sport_event_id);
              if (pid) delId = partById.get(pid)?.delegation_id || null;
            }
            if (!delId) continue;
            if (!medalsByDel.has(delId)) medalsByDel.set(delId, { g: 0, s: 0, b: 0 });
            const m = medalsByDel.get(delId)!;
            if (r.position === 1) { m.g++; totG++; }
            else if (r.position === 2) { m.s++; totS++; }
            else { m.b++; totB++; }
          }
        }
      }

      // Credenciados por delegação
      const credByDel = new Map<string, number>();
      for (const p of participants) {
        if (credSet.has(p.id) && p.delegation_id) {
          credByDel.set(p.delegation_id, (credByDel.get(p.delegation_id) || 0) + 1);
        }
      }
      const partsByDel = new Map<string, number>();
      for (const p of participants) {
        if (p.delegation_id) partsByDel.set(p.delegation_id, (partsByDel.get(p.delegation_id) || 0) + 1);
      }

      // Doação de alimentos
      const { data: rules } = await supabase
        .from("event_participation_rules")
        .select("food_donation_kg")
        .eq("event_id", eventId)
        .maybeSingle();
      const foodDonationPerDel = (rules?.food_donation_kg as number) || 0;

      const delegationsStats: OscDelegationStat[] = delegations.map((d) => {
        const m = medalsByDel.get(d.id) || { g: 0, s: 0, b: 0 };
        return {
          delegationId: d.id,
          schoolName: d.school_name,
          network: d.school_network_type,
          totalParticipants: partsByDel.get(d.id) || 0,
          credentialed: credByDel.get(d.id) || 0,
          meals: mealsByDelegation.get(d.id) || 0,
          trips: 0,
          medalsGold: m.g,
          medalsSilver: m.s,
          medalsBronze: m.b,
        };
      }).sort((a, b) => b.totalParticipants - a.totalParticipants);

      const totalAthletes = participants.filter((p) => p.participant_type === "atleta").length;

      return {
        event: ev ? { name: ev.name, startDate: ev.start_date, endDate: ev.end_date } : null,
        resumo: {
          totalParticipants: participants.length,
          totalAthletes,
          totalCredentialed: credSet.size,
          totalDelegations: delegations.length,
          totalSports: sportsMap.size,
          totalMatches: matchesList.length,
          totalMatchesPublished: publishedMatches.size,
          totalMeals: mealsCount || 0,
          totalLodgingOccupied: occupied,
          totalLodgingCapacity: capacity,
          totalTrips: tripsDone,
          totalPassengers: passCount || 0,
          totalMedalsGold: totG,
          totalMedalsSilver: totS,
          totalMedalsBronze: totB,
          foodDonationKg: foodDonationPerDel * delegations.length,
        },
        delegations: delegationsStats,
        sports,
      };
    },
  });
}
