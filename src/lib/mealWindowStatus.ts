/**
 * Status de janela de refeição (futura/ativa/encerrada) a partir de
 * service_date + start_time/end_time — lógica que estava duplicada em
 * AlimentacaoScanPage.tsx (statusForWindow), no PWA AlimentacaoJanelasPage.tsx
 * (getStatus), na Lista de Consumos (activeWindowId) e nas checagens de
 * "janela já encerrada" de DelegacaoAlimentacaoPage/AlimentacaoDivergenciasPage.
 */
import { RORAIMA_TZ_OFFSET } from "@/lib/dayRangeRoraima";

export type MealWindowStatus = "futura" | "ativa" | "encerrada";

// service_date/start_time/end_time são sempre horário local de Roraima
// (America/Boa_Vista, UTC-04:00 fixo). Sem o offset explícito, `new Date`
// interpretava a string no fuso do navegador que renderiza a página —
// um admin/dirigente acessando de outro fuso (ex.: São Paulo, UTC-03:00)
// via status "encerrada" até 1h antes do horário real de encerramento em
// Roraima. Mesma classe de bug já corrigida para vouchers em
// 20260708231000_alimentacao_voucher_timezone_boa_vista_fix.sql.
export function mealWindowDateTime(serviceDate: string, time: string): Date {
  return new Date(`${serviceDate}T${time}${RORAIMA_TZ_OFFSET}`);
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
