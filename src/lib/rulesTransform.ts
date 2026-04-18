import type { NationalFlowStatus, DisciplineType, RuleSportEventView } from "@/types/rulesSportEvent";

export function parseAllowedGenders(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((g) => g.trim()).filter(Boolean);
}

export function buildNationalFlowStatus(rule: {
  is_state_competition_only?: boolean | null;
  is_nationally_eligible_by_age?: boolean | null;
  national_eligibility_reason_code?: string | null;
  selection_method?: string | null;
}): NationalFlowStatus {
  if (rule.national_eligibility_reason_code === "REQUIRES_SPECIFIC_REGULATION_CONFIRMATION") return "manual_confirmation";
  if (rule.is_state_competition_only) return "state_only";
  if (rule.selection_method === "STATE_SELECTION_MIXED") return "state_selection_required";
  if (rule.selection_method === "TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION") return "functional_classification_required";
  if (rule.is_nationally_eligible_by_age === true) return "eligible";
  if (rule.is_nationally_eligible_by_age === false) return "not_eligible";
  return "unknown";
}

export function buildNationalFlowLabel(status: NationalFlowStatus): string {
  const map: Record<NationalFlowStatus, string> = {
    state_only: "Somente estadual",
    eligible: "Elegível ao nacional",
    not_eligible: "Não elegível ao nacional",
    manual_confirmation: "Confirmação manual",
    state_selection_required: "Seleção estadual",
    functional_classification_required: "Índice técnico e classificação funcional",
    unknown: "Não informado",
  };
  return map[status];
}

export function buildNationalFlowDescription(status: NationalFlowStatus): string {
  const map: Record<NationalFlowStatus, string> = {
    state_only: "Esta disputa é válida no âmbito estadual e não possui encaminhamento nacional automático.",
    eligible: "Esta modalidade/categoria é elegível para encaminhamento ao nível nacional.",
    not_eligible: "Esta modalidade/categoria não é elegível para o nível nacional na faixa etária configurada.",
    manual_confirmation: "A elegibilidade nacional depende de regulamento específico da modalidade e/ou norma nacional aplicável.",
    state_selection_required: "A ida ao nacional depende da composição da seleção estadual conforme regulamento.",
    functional_classification_required: "A classificação depende de índice técnico e classificação funcional.",
    unknown: "Informação de elegibilidade nacional não disponível.",
  };
  return map[status];
}

export function buildInstitutionLimitSummary(male: number | null, female: number | null): string {
  if (male == null && female == null) return "Sem limite definido";
  if (male === female) return `${male} por gênero`;
  const parts: string[] = [];
  if (male != null) parts.push(`${male} masc.`);
  if (female != null) parts.push(`${female} fem.`);
  return parts.join(" / ");
}

export function buildTeamSizeSummary(min: number | null, max: number | null): string {
  if (min == null && max == null) return "N/A (individual)";
  if (min != null && max != null) return `${min}–${max} atletas`;
  if (min != null) return `Mín. ${min}`;
  return `Máx. ${max}`;
}

export function buildSelectionMethodLabel(method: string | null | undefined): string {
  if (!method) return "Não informado";
  const map: Record<string, string> = {
    STATE_SELECTION_MIXED: "Seleção estadual",
    DIRECT_CLASSIFICATION_SUBJECT_TO_NATIONAL_RULES: "Classificação direta sujeita à regra nacional",
    TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION: "Índice técnico e classificação funcional",
    NONE: "Sem seleção nacional",
  };
  return map[method] ?? method;
}

export function buildEligibilityReasonLabel(code: string | null | undefined): string {
  if (!code) return "";
  const map: Record<string, string> = {
    REQUIRES_SPECIFIC_REGULATION_CONFIRMATION: "Requer confirmação de regulamento específico",
    AGE_RANGE_NOT_ELIGIBLE: "Faixa etária não elegível",
    NO_NATIONAL_EQUIVALENT: "Sem equivalente nacional",
  };
  return map[code] ?? code;
}

export function humanizeDisciplineType(dt: DisciplineType | string | null): string {
  if (!dt) return "Não informado";
  const map: Record<string, string> = {
    individual: "Individual",
    collective: "Coletiva",
    individual_paralympic: "Individual paralímpica",
  };
  return map[dt] ?? dt;
}

/**
 * Transform raw DB rows into the consolidated RuleSportEventView
 */
export function buildRuleSportEventView(
  rule: Record<string, any>,
  sportEvent: Record<string, any>,
  sport: Record<string, any>,
  category: Record<string, any>,
): RuleSportEventView {
  const genders = parseAllowedGenders(rule.allowed_genders);
  const flowStatus = buildNationalFlowStatus(rule);
  
  return {
    id: rule.id,
    sport_event_id: rule.sport_event_id,
    event_id: rule.event_id ?? sportEvent.event_id,
    sport_id: sport.id,
    sport_slug: sport.slug,
    sport_name: sport.name,
    is_collective: sport.is_collective,
    is_paralympic: sport.is_paralympic,
    category_id: category.id,
    category_slug: category.slug,
    category_name: category.name,
    sport_event_slug: sportEvent.slug,
    sport_event_name: sportEvent.name,
    is_active: rule.is_active,
    discipline_type: rule.discipline_type as DisciplineType | null,
    allowed_genders: rule.allowed_genders,
    allowed_genders_list: genders,
    institution_max_male: rule.institution_max_male,
    institution_max_female: rule.institution_max_female,
    institution_limit_summary: buildInstitutionLimitSummary(rule.institution_max_male, rule.institution_max_female),
    team_min_size: rule.team_min_size,
    team_max_size: rule.team_max_size,
    team_size_summary: buildTeamSizeSummary(rule.team_min_size, rule.team_max_size),
    substitution_cap: rule.substitution_cap,
    substitution_summary: rule.substitution_cap != null ? `${rule.substitution_cap} substituições` : "Sem limite",
    requires_cref_for_technician: rule.requires_cref_for_technician,
    cref_summary: rule.requires_cref_for_technician ? "Exige CREF" : "Não exige CREF",
    allows_external_technician: rule.allows_external_technician,
    requires_school_authorization_for_external_technician: rule.requires_school_authorization_for_external_technician,
    external_technician_summary: rule.allows_external_technician
      ? rule.requires_school_authorization_for_external_technician
        ? "Aceita (com autorização da escola)"
        : "Aceita técnico externo"
      : "Não aceita técnico externo",
    change_category_hours_before_technical_meeting: rule.change_category_hours_before_technical_meeting,
    national_event_type: rule.national_event_type,
    selection_method: rule.selection_method,
    selection_method_label: buildSelectionMethodLabel(rule.selection_method),
    is_state_competition_only: rule.is_state_competition_only,
    is_nationally_eligible_by_age: rule.is_nationally_eligible_by_age,
    national_eligibility_reason_code: rule.national_eligibility_reason_code,
    national_eligibility_notes: rule.national_eligibility_notes,
    national_eligibility_snapshot: rule.national_eligibility_snapshot ?? {},
    national_eligibility_rule_json: rule.national_eligibility_rule_json,
    selection_rule_json: rule.selection_rule_json,
    is_official_for_national_selection: rule.is_official_for_national_selection,
    national_flow_status: flowStatus,
    national_flow_label: buildNationalFlowLabel(flowStatus),
    national_flow_description: buildNationalFlowDescription(flowStatus),
    manual_confirmation_required: flowStatus === "manual_confirmation",
    is_individual: rule.discipline_type === "individual" || rule.discipline_type === "individual_paralympic",
    is_state_only: rule.is_state_competition_only === true,
    is_national_eligible: rule.is_nationally_eligible_by_age === true,
    rules: rule.rules ?? {},
    notes: rule.notes,
    rules_version: rule.rules_version,
  };
}
