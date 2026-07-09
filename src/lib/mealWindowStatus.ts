/**
 * Status de janela de refeição (futura/ativa/encerrada) a partir de
 * service_date + start_time/end_time — lógica que estava duplicada em
 * AlimentacaoScanPage.tsx (statusForWindow), no PWA AlimentacaoJanelasPage.tsx
 * (getStatus), na Lista de Consumos (activeWindowId) e nas checagens de
 * "janela já encerrada" de DelegacaoAlimentacaoPage/AlimentacaoDivergenciasPage.
 */
export type MealWindowStatus = "futura" | "ativa" | "encerrada";

export function mealWindowDateTime(serviceDate: string, time: string): Date {
  return new Date(`${serviceDate}T${time}`);
}

export function mealWindowStatus(
  serviceDate: string,
  startTime: string,
  endTime: string,
  now: Date = new Date(),
): MealWindowStatus {
  const start = mealWindowDateTime(serviceDate, startTime);
  const end = mealWindowDateTime(serviceDate, endTime);
  if (now < start) return "futura";
  if (now > end) return "encerrada";
  return "ativa";
}

export function isMealWindowClosed(
  serviceDate: string,
  endTime: string,
  now: Date = new Date(),
): boolean {
  return now > mealWindowDateTime(serviceDate, endTime);
}
