// Consolidated view type for sport event rules + sport + category
export type NationalFlowStatus =
  | "state_only"
  | "eligible"
  | "not_eligible"
  | "manual_confirmation"
  | "state_selection_required"
  | "functional_classification_required"
  | "unknown";

export type DisciplineType = "individual" | "collective" | "individual_paralympic";

export interface RuleSportEventView {
  id: string;
  sport_event_id: string;
  event_id: string;
  // Sport
  sport_id: string;
  sport_slug: string;
  sport_name: string;
  is_collective: boolean;
  is_paralympic: boolean;
  // Category
  category_id: string;
  category_slug: string;
  category_name: string;
  // Sport Event
  sport_event_slug: string;
  sport_event_name: string;
  is_active: boolean;
  // Rules fields
  discipline_type: DisciplineType | null;
  allowed_genders: string | null;
  allowed_genders_list: string[];
  institution_max_male: number | null;
  institution_max_female: number | null;
  institution_limit_summary: string;
  team_min_size: number | null;
  team_max_size: number | null;
  team_size_summary: string;
  substitution_cap: number | null;
  substitution_summary: string;
  requires_cref_for_technician: boolean | null;
  cref_summary: string;
  allows_external_technician: boolean | null;
  requires_school_authorization_for_external_technician: boolean | null;
  external_technician_summary: string;
  change_category_hours_before_technical_meeting: number | null;
  // National eligibility
  national_event_type: string | null;
  selection_method: string | null;
  selection_method_label: string;
  is_state_competition_only: boolean | null;
  is_nationally_eligible_by_age: boolean | null;
  national_eligibility_reason_code: string | null;
  national_eligibility_notes: string | null;
  national_eligibility_snapshot: Record<string, unknown>;
  national_eligibility_rule_json: Record<string, unknown> | null;
  selection_rule_json: Record<string, unknown> | null;
  is_official_for_national_selection: boolean | null;
  // Derived
  national_flow_status: NationalFlowStatus;
  national_flow_label: string;
  national_flow_description: string;
  manual_confirmation_required: boolean;
  is_individual: boolean;
  is_state_only: boolean;
  is_national_eligible: boolean;
  // Raw
  rules: Record<string, unknown>;
  notes: string | null;
  rules_version: number;
}

export interface QualificationRuleView {
  id: number;
  event_id: string;
  sport_event_id: string | null;
  phase_id: string | null;
  host_scope_code: string;
  base_slots: number | null;
  auto_qualify_if_registered_teams_eq: number | null;
  special_rule_json: Record<string, unknown> | null;
  reallocate_to_scope_code: string | null;
  priority_order: number | null;
  // Joined
  sport_event_name?: string;
  sport_event_slug?: string;
  sport_name?: string;
  phase_name?: string;
}

export interface RuleSummary {
  total: number;
  stateOnly: number;
  eligible: number;
  notEligible: number;
  manualConfirmation: number;
  individual: number;
  collective: number;
  paralympic: number;
  qualificationRules: number;
}
