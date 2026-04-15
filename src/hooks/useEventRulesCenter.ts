import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildRuleSportEventView } from "@/lib/rulesTransform";
import type { RuleSportEventView, QualificationRuleView, RuleSummary } from "@/types/rulesSportEvent";

// Resolve event ID from slug
export function useEventBySlug(slug: string) {
  return useQuery({
    queryKey: ["event-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
}

export function useConsolidatedSportEventRules(eventId: string | undefined) {
  return useQuery({
    queryKey: ["consolidated-sport-event-rules", eventId],
    queryFn: async (): Promise<RuleSportEventView[]> => {
      // Fetch all sport_event_rules for this event
      const { data: rules, error: rulesErr } = await supabase
        .from("sport_event_rules")
        .select("*")
        .eq("event_id", eventId!)
        .eq("is_active", true);
      if (rulesErr) throw rulesErr;
      if (!rules?.length) return [];

      // Get sport_event_ids
      const seIds = [...new Set(rules.map((r) => r.sport_event_id))];
      const { data: sportEvents, error: seErr } = await supabase
        .from("sport_events")
        .select("*")
        .in("id", seIds);
      if (seErr) throw seErr;

      const seMap = new Map((sportEvents ?? []).map((se) => [se.id, se]));

      // Get sport IDs and category IDs
      const sportIds = [...new Set((sportEvents ?? []).map((se) => se.sport_id))];
      const catIds = [...new Set((sportEvents ?? []).map((se) => se.category_id))];

      const [sportsRes, catsRes] = await Promise.all([
        supabase.from("sports").select("*").in("id", sportIds),
        supabase.from("categories").select("*").in("id", catIds),
      ]);
      if (sportsRes.error) throw sportsRes.error;
      if (catsRes.error) throw catsRes.error;

      const sportMap = new Map((sportsRes.data ?? []).map((s) => [s.id, s]));
      const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c]));

      return rules.map((rule) => {
        const se = seMap.get(rule.sport_event_id) ?? { slug: "", name: "", event_id: eventId, sport_id: "", category_id: "" };
        const sport = sportMap.get(se.sport_id) ?? { id: "", slug: "", name: "—", is_collective: false, is_paralympic: false };
        const cat = catMap.get(se.category_id) ?? { id: "", slug: "", name: "—" };
        return buildRuleSportEventView(rule as Record<string, any>, se, sport, cat);
      }).sort((a, b) => a.sport_name.localeCompare(b.sport_name) || a.category_name.localeCompare(b.category_name));
    },
    enabled: !!eventId,
  });
}

export function useQualificationRules(eventId: string | undefined) {
  return useQuery({
    queryKey: ["qualification-rules", eventId],
    queryFn: async (): Promise<QualificationRuleView[]> => {
      const { data, error } = await supabase
        .from("phase_qualification_rules")
        .select("*")
        .eq("event_id", eventId!)
        .order("priority_order");
      if (error) throw error;
      if (!data?.length) return [];

      // Get related sport events and phases
      const seIds = [...new Set(data.filter((d) => d.sport_event_id).map((d) => d.sport_event_id!))];
      const phaseIds = [...new Set(data.filter((d) => d.phase_id).map((d) => d.phase_id!))];

      const [seRes, phRes] = await Promise.all([
        seIds.length ? supabase.from("sport_events").select("id, name, slug, sport_id").in("id", seIds) : { data: [], error: null },
        phaseIds.length ? supabase.from("competition_phases").select("id, name").in("id", phaseIds) : { data: [], error: null },
      ]);

      const seMap = new Map((seRes.data ?? []).map((s) => [s.id, s]));
      const phMap = new Map((phRes.data ?? []).map((p) => [p.id, p]));

      // Get sport names
      const sportIds = [...new Set((seRes.data ?? []).map((s) => s.sport_id))];
      const sportsRes = sportIds.length ? await supabase.from("sports").select("id, name").in("id", sportIds) : { data: [] };
      const sportMap = new Map((sportsRes.data ?? []).map((s) => [s.id, s]));

      return data.map((d) => {
        const se = seMap.get(d.sport_event_id ?? "");
        const sport = se ? sportMap.get(se.sport_id) : null;
        return {
          ...d,
          special_rule_json: d.special_rule_json as Record<string, unknown> | null,
          sport_event_name: se?.name,
          sport_event_slug: se?.slug,
          sport_name: sport?.name,
          phase_name: phMap.get(d.phase_id ?? "")?.name,
        } as QualificationRuleView;
      });
    },
    enabled: !!eventId,
  });
}

export function useRuleSummary(rules: RuleSportEventView[], qualCount: number): RuleSummary {
  return {
    total: rules.length,
    stateOnly: rules.filter((r) => r.is_state_only).length,
    eligible: rules.filter((r) => r.is_national_eligible).length,
    notEligible: rules.filter((r) => r.national_flow_status === "not_eligible").length,
    manualConfirmation: rules.filter((r) => r.manual_confirmation_required).length,
    individual: rules.filter((r) => r.is_individual).length,
    collective: rules.filter((r) => r.is_collective).length,
    paralympic: rules.filter((r) => r.is_paralympic).length,
    qualificationRules: qualCount,
  };
}

export function useEventParticipationRules(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-participation-rules", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participation_rules")
        .select("*")
        .eq("event_id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}
