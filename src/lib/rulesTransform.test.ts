import { describe, it, expect } from "vitest";
import {
  parseAllowedGenders,
  buildNationalFlowStatus,
  buildNationalFlowLabel,
  buildNationalFlowDescription,
  buildInstitutionLimitSummary,
  buildTeamSizeSummary,
  buildSelectionMethodLabel,
  buildEligibilityReasonLabel,
  humanizeDisciplineType,
  buildRuleSportEventView,
} from "./rulesTransform";

describe("parseAllowedGenders", () => {
  it("returns empty array for null", () => {
    expect(parseAllowedGenders(null)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseAllowedGenders("")).toEqual([]);
  });

  it("parses a single gender", () => {
    expect(parseAllowedGenders("M")).toEqual(["M"]);
  });

  it("parses multiple genders separated by commas", () => {
    expect(parseAllowedGenders("M,F")).toEqual(["M", "F"]);
  });

  it("trims whitespace around entries", () => {
    expect(parseAllowedGenders("M, F , X")).toEqual(["M", "F", "X"]);
  });

  it("filters out empty entries from double commas", () => {
    expect(parseAllowedGenders("M,,F")).toEqual(["M", "F"]);
  });
});

describe("buildNationalFlowStatus", () => {
  it("returns manual_confirmation when reason code is set", () => {
    expect(buildNationalFlowStatus({ national_eligibility_reason_code: "REQUIRES_SPECIFIC_REGULATION_CONFIRMATION" })).toBe("manual_confirmation");
  });

  it("returns state_only when is_state_competition_only is true", () => {
    expect(buildNationalFlowStatus({ is_state_competition_only: true })).toBe("state_only");
  });

  it("returns state_selection_required for STATE_SELECTION_MIXED method", () => {
    expect(buildNationalFlowStatus({ selection_method: "STATE_SELECTION_MIXED" })).toBe("state_selection_required");
  });

  it("returns functional_classification_required for TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION", () => {
    expect(buildNationalFlowStatus({ selection_method: "TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION" })).toBe("functional_classification_required");
  });

  it("returns eligible when is_nationally_eligible_by_age is true", () => {
    expect(buildNationalFlowStatus({ is_nationally_eligible_by_age: true })).toBe("eligible");
  });

  it("returns not_eligible when is_nationally_eligible_by_age is false", () => {
    expect(buildNationalFlowStatus({ is_nationally_eligible_by_age: false })).toBe("not_eligible");
  });

  it("returns unknown when no condition matches", () => {
    expect(buildNationalFlowStatus({})).toBe("unknown");
  });

  it("manual_confirmation takes priority over state_only", () => {
    expect(buildNationalFlowStatus({
      national_eligibility_reason_code: "REQUIRES_SPECIFIC_REGULATION_CONFIRMATION",
      is_state_competition_only: true,
    })).toBe("manual_confirmation");
  });
});

describe("buildNationalFlowLabel", () => {
  it("returns the Portuguese label for each status", () => {
    expect(buildNationalFlowLabel("state_only")).toBe("Somente estadual");
    expect(buildNationalFlowLabel("eligible")).toBe("Elegível ao nacional");
    expect(buildNationalFlowLabel("not_eligible")).toBe("Não elegível ao nacional");
    expect(buildNationalFlowLabel("manual_confirmation")).toBe("Confirmação manual");
    expect(buildNationalFlowLabel("state_selection_required")).toBe("Seleção estadual");
    expect(buildNationalFlowLabel("functional_classification_required")).toBe("Índice técnico e classificação funcional");
    expect(buildNationalFlowLabel("unknown")).toBe("Não informado");
  });
});

describe("buildNationalFlowDescription", () => {
  it("returns a non-empty description for each status", () => {
    const statuses = ["state_only", "eligible", "not_eligible", "manual_confirmation", "state_selection_required", "functional_classification_required", "unknown"] as const;
    for (const s of statuses) {
      expect(buildNationalFlowDescription(s).length).toBeGreaterThan(0);
    }
  });

  it("returns distinct descriptions per status", () => {
    const descriptions = new Set([
      buildNationalFlowDescription("state_only"),
      buildNationalFlowDescription("eligible"),
      buildNationalFlowDescription("not_eligible"),
      buildNationalFlowDescription("manual_confirmation"),
      buildNationalFlowDescription("unknown"),
    ]);
    expect(descriptions.size).toBe(5);
  });
});

describe("buildInstitutionLimitSummary", () => {
  it("returns 'Sem limite definido' when both are null", () => {
    expect(buildInstitutionLimitSummary(null, null)).toBe("Sem limite definido");
  });

  it("returns '{n} por gênero' when both values are equal", () => {
    expect(buildInstitutionLimitSummary(3, 3)).toBe("3 por gênero");
  });

  it("shows only male when female is null", () => {
    expect(buildInstitutionLimitSummary(2, null)).toBe("2 masc.");
  });

  it("shows only female when male is null", () => {
    expect(buildInstitutionLimitSummary(null, 4)).toBe("4 fem.");
  });

  it("shows both when different", () => {
    expect(buildInstitutionLimitSummary(2, 4)).toBe("2 masc. / 4 fem.");
  });
});

describe("buildTeamSizeSummary", () => {
  it("returns N/A for null min and max", () => {
    expect(buildTeamSizeSummary(null, null)).toBe("N/A (individual)");
  });

  it("returns range when both are set", () => {
    expect(buildTeamSizeSummary(5, 11)).toBe("5–11 atletas");
  });

  it("returns min-only label when max is null", () => {
    expect(buildTeamSizeSummary(5, null)).toBe("Mín. 5");
  });

  it("returns max-only label when min is null", () => {
    expect(buildTeamSizeSummary(null, 11)).toBe("Máx. 11");
  });
});

describe("buildSelectionMethodLabel", () => {
  it("returns 'Não informado' for null", () => {
    expect(buildSelectionMethodLabel(null)).toBe("Não informado");
  });

  it("returns 'Não informado' for undefined", () => {
    expect(buildSelectionMethodLabel(undefined)).toBe("Não informado");
  });

  it("maps known methods to Portuguese labels", () => {
    expect(buildSelectionMethodLabel("STATE_SELECTION_MIXED")).toBe("Seleção estadual");
    expect(buildSelectionMethodLabel("DIRECT_CLASSIFICATION_SUBJECT_TO_NATIONAL_RULES")).toBe("Classificação direta sujeita à regra nacional");
    expect(buildSelectionMethodLabel("TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION")).toBe("Índice técnico e classificação funcional");
    expect(buildSelectionMethodLabel("NONE")).toBe("Sem seleção nacional");
  });

  it("returns the raw value for unknown methods", () => {
    expect(buildSelectionMethodLabel("UNKNOWN_METHOD")).toBe("UNKNOWN_METHOD");
  });
});

describe("buildEligibilityReasonLabel", () => {
  it("returns empty string for null", () => {
    expect(buildEligibilityReasonLabel(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(buildEligibilityReasonLabel(undefined)).toBe("");
  });

  it("maps known codes to Portuguese labels", () => {
    expect(buildEligibilityReasonLabel("REQUIRES_SPECIFIC_REGULATION_CONFIRMATION")).toBe("Requer confirmação de regulamento específico");
    expect(buildEligibilityReasonLabel("AGE_RANGE_NOT_ELIGIBLE")).toBe("Faixa etária não elegível");
    expect(buildEligibilityReasonLabel("NO_NATIONAL_EQUIVALENT")).toBe("Sem equivalente nacional");
  });

  it("returns the raw code for unknown codes", () => {
    expect(buildEligibilityReasonLabel("SOME_UNKNOWN_CODE")).toBe("SOME_UNKNOWN_CODE");
  });
});

describe("humanizeDisciplineType", () => {
  it("returns 'Não informado' for null", () => {
    expect(humanizeDisciplineType(null)).toBe("Não informado");
  });

  it("maps known types to Portuguese", () => {
    expect(humanizeDisciplineType("individual")).toBe("Individual");
    expect(humanizeDisciplineType("collective")).toBe("Coletiva");
    expect(humanizeDisciplineType("individual_paralympic")).toBe("Individual paralímpica");
  });

  it("returns raw value for unknown types", () => {
    expect(humanizeDisciplineType("unknown_type")).toBe("unknown_type");
  });
});

describe("buildRuleSportEventView", () => {
  const baseRule = {
    id: "rule-1",
    sport_event_id: "se-1",
    event_id: "evt-1",
    is_active: true,
    discipline_type: "individual",
    allowed_genders: "M,F",
    institution_max_male: 2,
    institution_max_female: 2,
    team_min_size: null,
    team_max_size: null,
    substitution_cap: 3,
    requires_cref_for_technician: false,
    allows_external_technician: true,
    requires_school_authorization_for_external_technician: false,
    change_category_hours_before_technical_meeting: 48,
    national_event_type: null,
    selection_method: "NONE",
    is_state_competition_only: false,
    is_nationally_eligible_by_age: true,
    national_eligibility_reason_code: null,
    national_eligibility_notes: null,
    national_eligibility_snapshot: null,
    national_eligibility_rule_json: null,
    selection_rule_json: null,
    is_official_for_national_selection: true,
    rules: { some: "rule" },
    notes: null,
    rules_version: 1,
  };

  const baseSportEvent = { slug: "atletismo-100m", name: "100m Rasos", event_id: "evt-1" };
  const baseSport = { id: "sport-1", slug: "atletismo", name: "Atletismo", is_collective: false, is_paralympic: false };
  const baseCategory = { id: "cat-1", slug: "sub-17", name: "Sub-17" };

  it("maps ids correctly", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.id).toBe("rule-1");
    expect(view.sport_id).toBe("sport-1");
    expect(view.category_id).toBe("cat-1");
  });

  it("computes allowed_genders_list", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.allowed_genders_list).toEqual(["M", "F"]);
  });

  it("computes institution_limit_summary for equal limits", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.institution_limit_summary).toBe("2 por gênero");
  });

  it("computes team_size_summary for null sizes (individual)", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.team_size_summary).toBe("N/A (individual)");
  });

  it("computes substitution_summary", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.substitution_summary).toBe("3 substituições");
  });

  it("sets is_individual true for individual discipline", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.is_individual).toBe(true);
  });

  it("sets is_individual true for individual_paralympic", () => {
    const view = buildRuleSportEventView({ ...baseRule, discipline_type: "individual_paralympic" }, baseSportEvent, baseSport, baseCategory);
    expect(view.is_individual).toBe(true);
  });

  it("sets is_individual false for collective", () => {
    const view = buildRuleSportEventView({ ...baseRule, discipline_type: "collective" }, baseSportEvent, baseSport, baseCategory);
    expect(view.is_individual).toBe(false);
  });

  it("computes national_flow_status as eligible", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.national_flow_status).toBe("eligible");
  });

  it("sets manual_confirmation_required when flow is manual_confirmation", () => {
    const view = buildRuleSportEventView(
      { ...baseRule, national_eligibility_reason_code: "REQUIRES_SPECIFIC_REGULATION_CONFIRMATION" },
      baseSportEvent, baseSport, baseCategory
    );
    expect(view.manual_confirmation_required).toBe(true);
  });

  it("uses null-safe fallback for national_eligibility_snapshot", () => {
    const view = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(view.national_eligibility_snapshot).toEqual({});
  });

  it("builds cref_summary correctly", () => {
    const withCref = buildRuleSportEventView({ ...baseRule, requires_cref_for_technician: true }, baseSportEvent, baseSport, baseCategory);
    expect(withCref.cref_summary).toBe("Exige CREF");

    const withoutCref = buildRuleSportEventView(baseRule, baseSportEvent, baseSport, baseCategory);
    expect(withoutCref.cref_summary).toBe("Não exige CREF");
  });

  it("builds external_technician_summary correctly", () => {
    const withAuth = buildRuleSportEventView(
      { ...baseRule, allows_external_technician: true, requires_school_authorization_for_external_technician: true },
      baseSportEvent, baseSport, baseCategory
    );
    expect(withAuth.external_technician_summary).toBe("Aceita (com autorização da escola)");

    const withoutAuth = buildRuleSportEventView(
      { ...baseRule, allows_external_technician: true, requires_school_authorization_for_external_technician: false },
      baseSportEvent, baseSport, baseCategory
    );
    expect(withoutAuth.external_technician_summary).toBe("Aceita técnico externo");

    const notAllowed = buildRuleSportEventView(
      { ...baseRule, allows_external_technician: false },
      baseSportEvent, baseSport, baseCategory
    );
    expect(notAllowed.external_technician_summary).toBe("Não aceita técnico externo");
  });
});
