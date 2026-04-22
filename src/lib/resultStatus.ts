/**
 * Canonical status strings — single source of truth.
 * Must match the values used in Enums, RPCs and RLS policies.
 */

/**
 * Status para Resultados de Partidas/Competições
 */
export const RESULT_STATUS = {
  LAUNCHED: "resultado_lancado",
  VALIDATED: "resultado_validado",
  PUBLISHED: "publicado",
} as const;

export type ResultStatusValue = (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS];

/**
 * Status para Boletins Oficiais
 */
export const BULLETIN_STATUS = {
  RASCUNHO: "rascunho",
  PUBLICADO: "publicado",
  CANCELADO: "cancelado",
} as const;

export type BulletinStatusValue = (typeof BULLETIN_STATUS)[keyof typeof BULLETIN_STATUS];

/**
 * Labels para exibição no frontend
 */
export const RESULT_STATUS_LABEL: Record<string, string> = {
  [RESULT_STATUS.LAUNCHED]: "Lançado",
  [RESULT_STATUS.VALIDATED]: "Validado",
  [RESULT_STATUS.PUBLISHED]: "Publicado Oficialmente",
};

export const BULLETIN_STATUS_LABEL: Record<string, string> = {
  [BULLETIN_STATUS.RASCUNHO]: "Rascunho",
  [BULLETIN_STATUS.PUBLICADO]: "Publicado",
  [BULLETIN_STATUS.CANCELADO]: "Cancelado",
};

/**
 * Variantes de UI (Badge)
 */
export const RESULT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  [RESULT_STATUS.LAUNCHED]: "outline",
  [RESULT_STATUS.VALIDATED]: "default",
  [RESULT_STATUS.PUBLISHED]: "secondary",
};

export const BULLETIN_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [BULLETIN_STATUS.RASCUNHO]: "outline",
  [BULLETIN_STATUS.PUBLICADO]: "secondary",
  [BULLETIN_STATUS.CANCELADO]: "destructive",
};

export const isLaunched = (s: string) => s === RESULT_STATUS.LAUNCHED;
export const isValidated = (s: string) => s === RESULT_STATUS.VALIDATED;
export const isPublished = (s: string) => s === RESULT_STATUS.PUBLISHED;
