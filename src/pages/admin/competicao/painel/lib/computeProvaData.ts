// Pure data transformation for the Painel da Competição.
// Extracted from CompeticaoPainelPage so it is unit-testable.

export type ProvaStatus =
  | "bloqueada"
  | "nao_iniciada"
  | "em_andamento"
  | "com_pendencia"
  | "concluida";

export interface StepStatus {
  key: string;
  label: string;
  state: "done" | "active" | "pending" | "error";
}

export interface ProvaRow {
  id: string;
  name: string;
  sport_name: string;
  sport_id: string;
  category_name: string;
  is_collective: boolean;
  released_at: string | null;
  enrolled_count: number;
  team_count: number;
  phase_count: number;
  group_count: number;
  match_count: number;
  matches_with_result: number;
  matches_with_schedule: number;
  results_validated: number;
  results_published: number;
  status: ProvaStatus;
  steps: StepStatus[];
  progress: number;
  firstIncompleteStep: string;
  family?: string | null;
  category_count?: number;
  is_grouped_combat?: boolean;
  is_grouped_time_mark?: boolean;
}

export function computeProvaData(row: any, family?: string | null): ProvaRow {
  const isCollective = !!row.is_collective;
  const releasedAt = row.released_at ?? null;

  const enrolled = Number(row.enrolled_count || 0);
  const teams = Number(row.team_count || 0);
  const phases = Number(row.phase_count || 0);
  const matchCount = Number(row.match_count || 0);
  const withResult = Number(row.matches_with_result || 0);
  const withSchedule = Number(row.matches_with_schedule || 0);
  const validated = Number(row.results_validated || 0);
  const published = Number(row.results_published || 0);

  let steps: StepStatus[] = [];
  
  if (family === "combat") {
    steps = [
      { key: "athletes", label: "Atletas", state: enrolled > 0 ? "done" : "pending" },
      { key: "weighing", label: "Pesagem", state: "pending" }, // TODO: Implement weighing status in query
      { key: "bracket", label: "Chave", state: phases > 0 ? "done" : "pending" },
      { key: "matches", label: "Lutas", state: matchCount > 0 ? "done" : "pending" },
      {
        key: "results",
        label: "Resultados",
        state:
          matchCount > 0 && withResult === matchCount
            ? "done"
            : withResult > 0
            ? "active"
            : "pending",
      },
    ];
  } else if (family === "time" || family === "mark") {
    steps = [
      { key: "athletes", label: "Inscritos", state: enrolled > 0 ? "done" : "pending" },
      { key: "structure", label: "Séries", state: phases > 0 ? "done" : "pending" },
      { key: "agenda", label: "Agenda", state: withSchedule > 0 ? "done" : "pending" },
      { key: "results", label: "Resultados", state: withResult > 0 ? (withResult === matchCount ? "done" : "active") : "pending" },
      { key: "published", label: "Homologado", state: validated > 0 ? (validated === matchCount ? "done" : "active") : "pending" },
    ];
  } else if (family === "ranking") {
    steps = [
      { key: "athletes", label: "Inscritos", state: enrolled > 0 ? "done" : "pending" },
      { key: "agenda", label: "Agenda", state: withSchedule > 0 ? "done" : "pending" },
      { key: "results", label: "Resultados", state: withResult > 0 ? (validated === matchCount ? "done" : "active") : "pending" },
      { key: "published", label: "Homologado", state: validated > 0 ? (validated === matchCount ? "done" : "active") : "pending" },
    ];
  } else if (isCollective) {
    steps = [
      { key: "teams", label: "Equipes", state: teams > 0 ? "done" : "pending" },
      { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
      { key: "matches", label: "Partidas", state: matchCount > 0 ? "done" : "pending" },
      {
        key: "agenda",
        label: "Agenda",
        state:
          matchCount > 0 && withSchedule === matchCount
            ? "done"
            : withSchedule > 0
            ? "active"
            : "pending",
      },
      {
        key: "results",
        label: "Resultados",
        state:
          matchCount > 0 && withResult === matchCount
            ? "done"
            : withResult > 0
            ? "active"
            : "pending",
      },
      {
        key: "published",
        label: "Publicado",
        state:
          matchCount > 0 && published === matchCount
            ? "done"
            : published > 0
            ? "active"
            : "pending",
      },
    ];
  } else {
    steps = [
      { key: "athletes", label: "Atletas", state: enrolled > 0 ? "done" : "pending" },
      { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
      {
        key: "results",
        label: "Resultados",
        state:
          matchCount > 0 && withResult === matchCount
            ? "done"
            : withResult > 0
            ? "active"
            : "pending",
      },
      {
        key: "published",
        label: "Publicado",
        state:
          matchCount > 0 && published === matchCount
            ? "done"
            : published > 0
            ? "active"
            : "pending",
      },
    ];
  }

  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const firstIncomplete =
    steps.find((s) => s.state !== "done")?.key ?? steps[steps.length - 1].key;

  let status: ProvaStatus;
  if (!releasedAt) {
    status = "bloqueada";
  } else if (doneCount === steps.length) {
    status = "concluida";
  } else if (withResult > 0 && validated < withResult) {
    status = "com_pendencia";
  } else if (doneCount === 0) {
    status = "nao_iniciada";
  } else {
    status = "em_andamento";
  }

  return {
    id: row.sport_event_id,
    name: row.name,
    sport_name: row.sport_name,
    sport_id: row.sport_id,
    category_name: row.category_name,
    is_collective: isCollective,
    released_at: releasedAt,
    enrolled_count: enrolled,
    team_count: teams,
    phase_count: phases,
    group_count: Number(row.group_count || 0),
    match_count: matchCount,
    matches_with_result: withResult,
    matches_with_schedule: withSchedule,
    results_validated: validated,
    results_published: published,
    status,
    steps,
    progress,
    firstIncompleteStep: firstIncomplete,
  };
}

export function mapStepToWizard(step: string): string {
  const map: Record<string, string> = {
    teams: "participants",
    athletes: "participants",
    structure: "structure",
    matches: "matches",
    agenda: "agenda",
    results: "results",
    published: "results",
  };
  return map[step] ?? "participants";
}
