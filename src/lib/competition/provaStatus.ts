/**
 * Máquina de estados única da PROVA (sport_event) na Central da Competição.
 *
 * Estados são DERIVADOS dos dados (não persistidos em coluna), garantindo que
 * checklist, wizard e painel de governança consumam a mesma verdade.
 *
 * Fluxo:
 *  draft → enrolled → built → scheduled → officiated → in_progress
 *      → finished → validated → publishable → published
 */

export const PROVA_STATUS = {
  DRAFT: "draft",
  ENROLLED: "enrolled",
  BUILT: "built",
  SCHEDULED: "scheduled",
  OFFICIATED: "officiated",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
  VALIDATED: "validated",
  PUBLISHABLE: "publishable",
  PUBLISHED: "published",
} as const;

export type ProvaStatus = (typeof PROVA_STATUS)[keyof typeof PROVA_STATUS];

/** Ordem canônica usada para comparações `>=` (atingiu pelo menos X). */
export const PROVA_STATUS_ORDER: ProvaStatus[] = [
  PROVA_STATUS.DRAFT,
  PROVA_STATUS.ENROLLED,
  PROVA_STATUS.BUILT,
  PROVA_STATUS.SCHEDULED,
  PROVA_STATUS.OFFICIATED,
  PROVA_STATUS.IN_PROGRESS,
  PROVA_STATUS.FINISHED,
  PROVA_STATUS.VALIDATED,
  PROVA_STATUS.PUBLISHABLE,
  PROVA_STATUS.PUBLISHED,
];

export const PROVA_STATUS_LABEL: Record<ProvaStatus, string> = {
  draft: "Sem inscritos",
  enrolled: "Inscritos confirmados",
  built: "Disputas montadas",
  scheduled: "Agenda completa",
  officiated: "Arbitragem escalada",
  in_progress: "Em andamento",
  finished: "Resultados lançados",
  validated: "Resultados validados",
  publishable: "Pronta para publicar",
  published: "Publicada no portal",
};

export interface ProvaSignals {
  enrolled: number;
  matchesCount: number;
  scheduled: number; // partidas com data + hora + local
  finished: number; // status === 'finished'
  inProgress: number; // status === 'in_progress'
  officialsCount: number; // total de match_user_assignments
  matchesWithOfficials: number; // partidas distintas com pelo menos 1 oficial
  resultsLaunched: number;
  resultsValidated: number;
  resultsPublished: number;
  hasPublishedBulletin: boolean;
}

/**
 * Deriva o status da prova a partir dos sinais agregados.
 * Esta é a ÚNICA função que decide o estado — todos os consumidores chamam aqui.
 */
export function deriveProvaStatus(s: ProvaSignals): ProvaStatus {
  if (s.matchesCount === 0) {
    return s.enrolled > 0 ? PROVA_STATUS.ENROLLED : PROVA_STATUS.DRAFT;
  }

  // Já publicado? Estado terminal.
  if (s.resultsPublished > 0 && s.resultsPublished >= s.finished) {
    return PROVA_STATUS.PUBLISHED;
  }

  // Pronta para publicar: tem boletim publicado + todos resultados validados.
  if (
    s.hasPublishedBulletin &&
    s.resultsValidated > 0 &&
    s.finished > 0 &&
    s.resultsValidated >= s.finished &&
    s.resultsLaunched === 0
  ) {
    return PROVA_STATUS.PUBLISHABLE;
  }

  // Validados: alguns resultados foram validados pela coordenação.
  if (s.resultsValidated > 0 && s.resultsLaunched === 0 && s.finished > 0 && s.finished === s.matchesCount) {
    return PROVA_STATUS.VALIDATED;
  }

  // Finalizada: todas partidas concluídas.
  if (s.finished === s.matchesCount && s.matchesCount > 0) {
    return PROVA_STATUS.FINISHED;
  }

  if (s.inProgress > 0 || s.finished > 0) {
    return PROVA_STATUS.IN_PROGRESS;
  }

  if (s.matchesWithOfficials >= s.matchesCount && s.matchesCount > 0) {
    return PROVA_STATUS.OFFICIATED;
  }

  if (s.scheduled === s.matchesCount && s.matchesCount > 0) {
    return PROVA_STATUS.SCHEDULED;
  }

  return PROVA_STATUS.BUILT;
}

/** True se o status já alcançou (ou ultrapassou) o alvo. */
export function isAtLeast(current: ProvaStatus, target: ProvaStatus): boolean {
  return PROVA_STATUS_ORDER.indexOf(current) >= PROVA_STATUS_ORDER.indexOf(target);
}

/**
 * Guarda de transição: indica se o usuário pode disparar uma ação que
 * exige um status mínimo (ex.: publicar exige >= publishable).
 */
export const TRANSITION_REQUIREMENTS: Record<string, ProvaStatus> = {
  validate: PROVA_STATUS.FINISHED,
  publish: PROVA_STATUS.PUBLISHABLE,
  unpublish: PROVA_STATUS.PUBLISHED,
};

export function canTransition(current: ProvaStatus, action: keyof typeof TRANSITION_REQUIREMENTS): boolean {
  const required = TRANSITION_REQUIREMENTS[action];
  if (!required) return false;
  if (action === "unpublish") return current === PROVA_STATUS.PUBLISHED;
  return isAtLeast(current, required);
}

/** Mapeia status da prova → estado do step do wizard. */
export function stepStateFor(stepKey: string, status: ProvaStatus): "completed" | "available" | "blocked" {
  const minimums: Record<string, ProvaStatus> = {
    participants: PROVA_STATUS.ENROLLED,
    builder: PROVA_STATUS.BUILT,
    agenda: PROVA_STATUS.SCHEDULED,
    arbitragem: PROVA_STATUS.OFFICIATED,
    matches: PROVA_STATUS.IN_PROGRESS,
    results: PROVA_STATUS.FINISHED,
    publish: PROVA_STATUS.PUBLISHED,
  };
  const min = minimums[stepKey];
  if (!min) return "available";
  return isAtLeast(status, min) ? "completed" : "available";
}
