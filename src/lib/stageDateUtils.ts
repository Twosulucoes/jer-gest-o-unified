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

/**
 * Retorna 'YYYY-MM-DD' do fuso local do dispositivo (mesma convenção de
 * useTodayString.ts/pwaScan.ts — o operador PWA está fisicamente em
 * Roraima, então o fuso do dispositivo é o que importa). `toISOString()`
 * usa UTC e fazia "hoje" virar o dia seguinte a partir de ~20h em Roraima
 * (UTC-4) — mesma classe de bug já corrigida em pwaScan.ts — o que podia
 * tirar a etapa vigente de `openStages` (StageContext) e do seletor de
 * etapa da Scan horas antes do fim real do dia local.
 */
function todayISO(): string {
  return new Date().toLocaleDateString("fr-CA");
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

/**
 * Verifica se uma janela de serviço está dentro da janela operacional ±graceMinutes.
 *
 * Regra: o operador pode registrar até `graceMinutes` antes do início e até
 * `graceMinutes` após o encerramento — evita bloqueio por chegadas antecipadas
 * ou atrasos de poucos minutos.
 *
 * Padrão: ±60 min (1 hora).
 */
export function isWindowNearNow(
  startTime: string,
  endTime: string,
  serviceDate: string,
  graceMinutes = 60,
): boolean {
  const now = new Date();
  const start = new Date(`${serviceDate}T${startTime}`);
  const end = new Date(`${serviceDate}T${endTime}`);
  const graceMs = graceMinutes * 60 * 1000;
  return now.getTime() >= start.getTime() - graceMs && now.getTime() <= end.getTime() + graceMs;
}
