import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EventEditionRulesRow {
  id: string;
  event_id: string;
  version: number;
  status: "draft" | "published";
  sections: EventRulesSections;
  notes: string | null;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CategoryRule {
  id: string;
  name: string;
  min_birth_year: number | null;
  max_birth_year: number | null;
  gender_scope: string;
  notes?: string;
}

export interface SportVariation {
  id: string;
  sport_name: string;
  category_name: string;
  gender_scope: string;
  participant_mode: "individual" | "team" | "pair" | "relay";
  is_jerpa: boolean;
  functional_class?: string;
  min_athletes?: number;
  max_athletes?: number;
  notes?: string;
}

export interface ParticipationLimit {
  max_collective_teams_per_athlete: number;
  max_individual_sports_per_athlete: number;
  max_events_per_individual_sport: number;
  min_athletes_per_team?: Record<string, number>;
  max_athletes_per_team?: Record<string, number>;
  special_rules?: string;
}

export interface ClassificationRule {
  stage_name: string;
  host_city?: string;
  slots_per_host?: number;
  total_qualified?: number;
  advancement_criteria?: string;
  notes?: string;
}

export interface OperationalRule {
  key: string;
  label: string;
  value: string;
  category: "geral" | "ausencia" | "protesto" | "prazo";
}

export interface ScoringRule {
  position: number;
  points: number;
}

export interface ChampionshipScoring {
  scoring_table: ScoringRule[];
  tiebreakers: string[];
  collective_rules?: string;
  individual_rules?: string;
  conversion_notes?: string;
}

export interface EventRulesSections {
  edition?: {
    year?: number;
    event_type?: string;
    edition_name?: string;
    notes?: string;
  };
  categories?: CategoryRule[];
  sports?: SportVariation[];
  participation_limits?: ParticipationLimit;
  classification?: ClassificationRule[];
  operational?: OperationalRule[];
  championship_scoring?: ChampionshipScoring;
}

export type PermLevel = "full" | "edit" | "view" | "none";

export function usePermLevel(): PermLevel {
  const { hasRole } = useAuth();
  if (hasRole("admin")) return "full";
  if (hasRole("coordenacao_tecnica" as any)) return "edit";
  if (hasRole("secretaria" as any)) return "edit";
  return "none";
}

export function useEventEditionRules(eventId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["event-edition-rules", eventId],
    queryFn: async (): Promise<EventEditionRulesRow | null> => {
      // Get the latest version for this event
      const { data, error } = await supabase
        .from("event_edition_rules")
        .select("*")
        .eq("event_id", eventId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        status: data.status as "draft" | "published",
        sections: (data.sections as unknown as EventRulesSections) ?? {},
      };
    },
    enabled: !!eventId,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      sections,
      notes,
    }: {
      sections: EventRulesSections;
      notes?: string;
    }) => {
      const existing = query.data;
      if (existing) {
        const { error } = await supabase
          .from("event_edition_rules")
          .update({
            sections: sections as any,
            notes: notes ?? existing.notes,
            updated_by: user?.id ?? null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_edition_rules")
          .insert({
            event_id: eventId!,
            version: 1,
            status: "draft",
            sections: sections as any,
            notes: notes ?? null,
            created_by: user?.id ?? null,
            updated_by: user?.id ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-edition-rules", eventId] });
      toast.success("Regras salvas com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const existing = query.data;
      if (!existing) throw new Error("Nenhum rascunho para publicar");
      const { error } = await supabase
        .from("event_edition_rules")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .eq("id", existing.id);
      if (error) throw error;

      // Log audit
      await supabase.from("event_rules_audit_log").insert({
        event_id: eventId!,
        edition_rules_id: existing.id,
        section: "publicacao",
        action: "publish",
        changes_summary: `Versão ${existing.version} publicada`,
        performed_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-edition-rules", eventId] });
      toast.success("Regras publicadas com sucesso");
    },
    onError: (err: Error) => {
      toast.error("Erro ao publicar: " + err.message);
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: async () => {
      const existing = query.data;
      const newVersion = existing ? existing.version + 1 : 1;
      const { error } = await supabase
        .from("event_edition_rules")
        .insert([{
          event_id: eventId!,
          version: newVersion,
          status: "draft",
          sections: (existing?.sections ?? {}) as any,
          notes: null,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-edition-rules", eventId] });
      toast.success("Nova versão criada (rascunho)");
    },
    onError: (err: Error) => {
      toast.error("Erro: " + err.message);
    },
  });

  const logAudit = async (section: string, action: string, summary: string, oldValue?: any, newValue?: any) => {
    await supabase.from("event_rules_audit_log").insert({
      event_id: eventId!,
      edition_rules_id: query.data?.id ?? null,
      section,
      action,
      changes_summary: summary,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
      performed_by: user?.id ?? null,
    });
  };

  return {
    data: query.data,
    sections: query.data?.sections ?? {},
    status: query.data?.status ?? null,
    version: query.data?.version ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    save: upsertMutation.mutate,
    isSaving: upsertMutation.isPending,
    publish: publishMutation.mutate,
    isPublishing: publishMutation.isPending,
    createNewVersion: newVersionMutation.mutate,
    logAudit,
  };
}

export function useEventRulesAuditLog(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-rules-audit", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rules_audit_log")
        .select("*")
        .eq("event_id", eventId!)
        .order("performed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}

export function useEventEditionVersions(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-edition-versions", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_edition_rules")
        .select("id, version, status, published_at, created_at, updated_at, notes")
        .eq("event_id", eventId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}
