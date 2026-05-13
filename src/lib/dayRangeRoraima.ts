/**
 * Helper para filtros de "dia" em queries Supabase usando o fuso de Roraima.
 *
 * Por que existe: as PWAs operacionais (alimentação, transporte) filtram
 * registros "de hoje" em colunas `timestamp with time zone`. O padrão antigo
 * `today + "T00:00:00"` (sem offset) era interpretado pelo Postgres como UTC
 * — em Roraima (UTC-4, sem horário de verão) isso deslocava o início do
 * "hoje" em 4h para trás, fazendo vazar registros do fim da noite anterior.
 * Além disso, filtros sem limite superior incluíam dias futuros se o relógio
 * do dispositivo estivesse adiantado.
 *
 * Use `dayRangeRoraima("YYYY-MM-DD")` e aplique `.gte(col, startIso)` +
 * `.lt(col, endIsoExclusive)` para obter exatamente o dia local em Roraima.
 */

export const RORAIMA_TZ_OFFSET = "-04:00";

function addDaysISO(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  // Meio-dia UTC evita qualquer ambiguidade de DST/borda ao somar dias.
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function dayRangeRoraima(localDate: string): {
  startIso: string;
  endIsoExclusive: string;
} {
  const next = addDaysISO(localDate, 1);
  return {
    startIso: `${localDate}T00:00:00${RORAIMA_TZ_OFFSET}`,
    endIsoExclusive: `${next}T00:00:00${RORAIMA_TZ_OFFSET}`,
  };
}
