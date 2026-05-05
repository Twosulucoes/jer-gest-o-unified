/**
 * Utilitários para determinar se uma etapa está vigente HOJE.
 *
 * Premissa (regra do organizador): nas PWAs operacionais, o seletor
 * de etapa só deve oferecer etapas cuja janela de datas inclui o dia
 * de hoje (`starts_at <= today <= ends_at`). Etapas futuras ou
 * encerradas seguem visíveis (com badge) mas não são selecionáveis,
 * para evitar lançamento de consumo na etapa errada.
 *
 * Painel administrativo NÃO usa este filtro — admin precisa enxergar
 * etapas passadas e futuras para gestão.
 */

interface StageDates {
  starts_at: string | null;
  ends_at: string | null;
  status?: string;
}

/** Retorna 'YYYY-MM-DD' do fuso local. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Etapa está aberta para operação HOJE se:
 * - status = 'active' (ou ausente — defensivo)
 * - starts_at <= hoje <= ends_at (ambos lados inclusivos)
 *
 * Datas null são tratadas como ilimitado naquela direção. Se ambas
 * forem null, retorna `true` (etapa sem janela definida — admin que
 * decide).
 */
export function isStageOpenToday(stage: StageDates): boolean {
  if (stage.status && stage.status !== "active") return false;
  const today = todayISO();
  if (stage.starts_at && today < stage.starts_at) return false;
  if (stage.ends_at && today > stage.ends_at) return false;
  return true;
}

export type StageWindowState = "open" | "future" | "closed" | "undated";

export function stageWindowState(stage: StageDates): StageWindowState {
  if (!stage.starts_at && !stage.ends_at) return "undated";
  const today = todayISO();
  if (stage.starts_at && today < stage.starts_at) return "future";
  if (stage.ends_at && today > stage.ends_at) return "closed";
  return "open";
}

/** Formato compacto pt-BR — 26/05 ou 26/05 a 01/06. */
export function stageWindowLabel(stage: StageDates): string {
  const fmt = (iso: string) => {
    // iso vem como YYYY-MM-DD
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}`;
  };
  if (stage.starts_at && stage.ends_at) {
    if (stage.starts_at === stage.ends_at) return fmt(stage.starts_at);
    return `${fmt(stage.starts_at)} – ${fmt(stage.ends_at)}`;
  }
  if (stage.starts_at) return `a partir de ${fmt(stage.starts_at)}`;
  if (stage.ends_at) return `até ${fmt(stage.ends_at)}`;
  return "sem janela definida";
}

export function stageWindowBadge(stage: StageDates): string | null {
  switch (stageWindowState(stage)) {
    case "future":
      return "futura";
    case "closed":
      return "encerrada";
    default:
      return null;
  }
}
