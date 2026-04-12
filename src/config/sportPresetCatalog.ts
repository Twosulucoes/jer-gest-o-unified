import type { SportEventRulesV1 } from "@/types/sportEventRules";

export interface SportPreset {
  key: string;
  label: string;
  description: string;
  rules: SportEventRulesV1 & Record<string, unknown>;
}

export const SPORT_PRESET_CATALOG: SportPreset[] = [
  {
    key: "FUTSAL",
    label: "Futsal",
    description: "Placar (gols), fase de grupos, W.O. 5×0, penalidades no mata-mata",
    rules: {
      family: "score",
      format: "group_stage",
      participant_mode: "team",
      scoring: {
        score_type: "goals",
        walkover_policy: { home_goals: 5, away_goals: 0 },
      },
      scheduling: {},
      tie_breakers: ["head_to_head", "goal_average", "goals_for", "goals_against", "draw"],
      enrollment_limits: {},
      group_points: { win: 3, draw: 1, loss: 0, wo_win: 3, wo_loss: 0 },
      knockout_tie_resolution: { type: "penalties", initial_kicks: 5, mode: "alternating" },
      preset_key: "FUTSAL",
    },
  },
  {
    key: "FUTEBOL_DE_CAMPO",
    label: "Futebol de Campo",
    description: "Placar (gols), fase de grupos, W.O. 5×0, critérios com disciplina",
    rules: {
      family: "score",
      format: "group_stage",
      participant_mode: "team",
      scoring: {
        score_type: "goals",
        walkover_policy: { home_goals: 5, away_goals: 0 },
      },
      scheduling: {},
      tie_breakers: ["head_to_head", "goal_average", "goal_difference", "goals_for", "yellow_cards", "red_cards", "draw"],
      enrollment_limits: {},
      group_points: { win: 3, draw: 1, loss: 0, wo_win: 3, wo_loss: 0 },
      knockout_tie_resolution: { type: "penalties", initial_kicks: 5, mode: "alternating" },
      preset_key: "FUTEBOL_DE_CAMPO",
    },
  },
  {
    key: "HANDEBOL",
    label: "Handebol",
    description: "Placar (gols), fase de grupos, W.O. 5×0, prorrogação + tiro de 7m",
    rules: {
      family: "score",
      format: "group_stage",
      participant_mode: "team",
      scoring: {
        score_type: "goals",
        walkover_policy: { home_goals: 5, away_goals: 0 },
      },
      scheduling: {},
      tie_breakers: ["head_to_head", "wins", "goal_average", "goals_against", "goals_for", "goal_difference", "draw"],
      enrollment_limits: {},
      group_points: { win: 3, draw: 0, loss: 1, wo_win: 3, wo_loss: 0 },
      knockout_tie_resolution: {
        type: "overtime_plus_shootout",
        overtime_periods: 2,
        overtime_minutes: 5,
        shootout: { type: "7m", initial_kicks: 3, mode: "alternating" },
      },
      preset_key: "HANDEBOL",
    },
  },
  {
    key: "BASQUETE",
    label: "Basquete",
    description: "Placar (pontos), fase de grupos, W.O. 20×0, prorrogação até decisão",
    rules: {
      family: "score",
      format: "group_stage",
      participant_mode: "team",
      scoring: {
        score_type: "points",
        walkover_policy: { home_points: 20, away_points: 0 },
      },
      scheduling: {},
      tie_breakers: ["head_to_head", "wins", "points_average", "points_for", "points_against", "draw"],
      enrollment_limits: {},
      group_points: { win: 2, loss: 1, wo_win: 2, wo_loss: 0 },
      knockout_tie_resolution: { type: "overtime", overtime_minutes: 5, repeat_until_winner: true },
      preset_key: "BASQUETE",
    },
  },
  {
    key: "KARATE_KATA",
    label: "Karatê — Kata",
    description: "Ranking por nota de juízes, sem confronto direto, 2 terceiros",
    rules: {
      family: "ranking",
      format: "ranking",
      participant_mode: "individual",
      scoring: { score_type: "placement_points" },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      ranking_policy: { type: "judges", allow_ties: false, third_places: 2 },
      kata_rules: { no_repeat_each_round: true },
      preset_key: "KARATE_KATA",
    },
  },
  {
    key: "KARATE_KUMITE",
    label: "Karatê — Kumite",
    description: "Combate, chave eliminatória, 2 min, 2 terceiros, sem repescagem",
    rules: {
      family: "combat",
      format: "combat_bracket",
      participant_mode: "individual",
      scoring: { score_type: "combat_points" },
      scheduling: {},
      tie_breakers: [],
      enrollment_limits: {},
      combat_policy: { fight_minutes: 2, win_by_point_diff: 8, third_places: 2, repechage: false },
      preset_key: "KARATE_KUMITE",
    },
  },
];

export function getPresetByKey(key: string): SportPreset | undefined {
  return SPORT_PRESET_CATALOG.find((p) => p.key === key);
}
