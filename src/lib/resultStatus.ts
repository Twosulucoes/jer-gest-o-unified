/**
 * Canonical result status strings — single source of truth.
 * Must match the values used in RPCs and RLS policies.
 */
export const RESULT_STATUS = {
  LAUNCHED: "resultado_lancado",
  VALIDATED: "resultado_validado",
  PUBLISHED: "publicado",
} as const;

export type ResultStatusValue = (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS];

export const RESULT_STATUS_LABEL: Record<string, string> = {
  [RESULT_STATUS.LAUNCHED]: "Lançado",
  [RESULT_STATUS.VALIDATED]: "Validado",
  [RESULT_STATUS.PUBLISHED]: "Publicado",
};

export const RESULT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  [RESULT_STATUS.LAUNCHED]: "outline",
  [RESULT_STATUS.VALIDATED]: "default",
  [RESULT_STATUS.PUBLISHED]: "secondary",
};

export const isLaunched = (s: string) => s === RESULT_STATUS.LAUNCHED;
export const isValidated = (s: string) => s === RESULT_STATUS.VALIDATED;
export const isPublished = (s: string) => s === RESULT_STATUS.PUBLISHED;
