export type RulesFamily = "score" | "sets" | "time" | "mark" | "combat" | "ranking";
export type RulesFormat = "knockout" | "group_stage" | "round_robin" | "heats" | "heats_final" | "combat_bracket" | "ranking" | "swiss";
export type ParticipantMode = "individual" | "team" | "pair" | "relay";
export type ScoreType = "goals" | "points" | "rally_points" | "time_ms" | "distance_cm" | "combat_points" | "placement_points";

export interface SportEventRulesV1 {
  family: RulesFamily;
  format: RulesFormat;
  participant_mode: ParticipantMode;
  scoring: {
    score_type: ScoreType;
    best_of?: number | null;
    set_points?: number | null;
    walkover_policy?: Record<string, unknown> | null;
  };
  scheduling: {
    lanes_min?: number | null;
    lanes_max?: number | null;
    min_rest_minutes?: number | null;
  };
  tie_breakers: string[];
  enrollment_limits: Record<string, unknown>;
  notes?: string | null;
  preset_key?: string | null;
}

export interface SportEventRulesResponse {
  source: "db" | "default";
  rules: SportEventRulesV1;
}

export const FAMILIES: { value: RulesFamily; label: string }[] = [
  { value: "score", label: "Placar (gols/pontos)" },
  { value: "sets", label: "Sets (best-of)" },
  { value: "time", label: "Tempo (heats)" },
  { value: "mark", label: "Marca (campo)" },
  { value: "combat", label: "Combate (lutas)" },
  { value: "ranking", label: "Ranking (sem confronto)" },
];

export const FORMATS: { value: RulesFormat; label: string }[] = [
  { value: "knockout", label: "Eliminatória (knockout)" },
  { value: "group_stage", label: "Fase de grupos" },
  { value: "round_robin", label: "Todos contra todos" },
  { value: "heats", label: "Baterias/Séries" },
  { value: "heats_final", label: "Baterias + Final" },
  { value: "combat_bracket", label: "Chave de combate" },
  { value: "ranking", label: "Ranking direto" },
  { value: "swiss", label: "Suíço" },
];

export const PARTICIPANT_MODES: { value: ParticipantMode; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "team", label: "Equipe" },
  { value: "pair", label: "Dupla" },
  { value: "relay", label: "Revezamento" },
];

export const SCORE_TYPES: { value: ScoreType; label: string }[] = [
  { value: "goals", label: "Gols" },
  { value: "points", label: "Pontos" },
  { value: "rally_points", label: "Pontos (rally)" },
  { value: "time_ms", label: "Tempo (ms)" },
  { value: "distance_cm", label: "Distância (cm)" },
  { value: "combat_points", label: "Pontos (combate)" },
  { value: "placement_points", label: "Pontos (colocação)" },
];

export const VALID_FORMATS_BY_FAMILY: Record<RulesFamily, RulesFormat[]> = {
  score: ["group_stage", "round_robin", "knockout"],
  sets: ["group_stage", "round_robin", "knockout"],
  time: ["heats", "heats_final", "ranking"],
  mark: ["heats", "heats_final", "ranking"],
  combat: ["combat_bracket", "knockout"],
  ranking: ["ranking", "swiss"],
};

export const FAMILY_PRESETS: Record<string, { label: string; rules: SportEventRulesV1 }> = {
  score: {
    label: "Placar (gols/pontos)",
    rules: {
      family: "score",
      format: "group_stage",
      participant_mode: "team",
      scoring: { score_type: "goals" },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "score",
    },
  },
  sets: {
    label: "Sets (best-of)",
    rules: {
      family: "sets",
      format: "group_stage",
      participant_mode: "individual",
      scoring: { score_type: "rally_points", best_of: 3, set_points: 11 },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "sets",
    },
  },
  time: {
    label: "Tempo (heats)",
    rules: {
      family: "time",
      format: "heats",
      participant_mode: "individual",
      scoring: { score_type: "time_ms" },
      scheduling: { lanes_min: 6, lanes_max: 10 },
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "time",
    },
  },
  mark: {
    label: "Marca (campo)",
    rules: {
      family: "mark",
      format: "heats_final",
      participant_mode: "individual",
      scoring: { score_type: "distance_cm" },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "mark",
    },
  },
  combat: {
    label: "Combate (lutas)",
    rules: {
      family: "combat",
      format: "combat_bracket",
      participant_mode: "individual",
      scoring: { score_type: "combat_points" },
      scheduling: { min_rest_minutes: 10 },
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "combat",
    },
  },
  ranking: {
    label: "Ranking (sem confronto)",
    rules: {
      family: "ranking",
      format: "ranking",
      participant_mode: "individual",
      scoring: { score_type: "placement_points" },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      preset_key: "ranking",
    },
  },
};
