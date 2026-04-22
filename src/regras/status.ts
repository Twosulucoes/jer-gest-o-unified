
/**
 * Padronização de Status do Sistema (Boletim Informativo e Resultados)
 * Reflete os Enums do Banco de Dados
 */

/**
 * Status para Boletins Oficiais
 */
export const BULLETIN_STATUS = {
  RASCUNHO: 'rascunho',
  PUBLICADO: 'publicado',
  CANCELADO: 'cancelado',
} as const;

export type BulletinStatus = typeof BULLETIN_STATUS[keyof typeof BULLETIN_STATUS];

/**
 * Status para Resultados de Partidas/Competições
 */
export const RESULT_STATUS = {
  LANCADO: 'resultado_lancado',
  VALIDADO: 'resultado_validado',
  PUBLICADO: 'publicado',
} as const;

export type ResultStatus = typeof RESULT_STATUS[keyof typeof RESULT_STATUS];

/**
 * Labels para exibição no frontend
 */
export const BULLETIN_STATUS_LABELS: Record<BulletinStatus, string> = {
  [BULLETIN_STATUS.RASCUNHO]: 'Rascunho',
  [BULLETIN_STATUS.PUBLICADO]: 'Publicado',
  [BULLETIN_STATUS.CANCELADO]: 'Cancelado',
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  [RESULT_STATUS.LANCADO]: 'Lançado',
  [RESULT_STATUS.VALIDADO]: 'Validado',
  [RESULT_STATUS.PUBLICADO]: 'Publicado Oficialmente',
};
