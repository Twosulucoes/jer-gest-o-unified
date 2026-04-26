/**
 * Source of truth for match status values.
 *
 * The database column `competition_matches.status` stores English values:
 *   'scheduled' | 'in_progress' | 'finished' | 'cancelled'
 *
 * Earlier code used Portuguese values ('agendada', 'em_andamento',
 * 'finalizada', 'cancelada') which produced 0-row results and 400 errors
 * on filters. Always use the canonical English values when querying or
 * updating the column.
 *
 * Use the helpers below for UI labels and tone classes.
 */

export const MATCH_STATUS = {
  scheduled: "scheduled",
  in_progress: "in_progress",
  finished: "finished",
  cancelled: "cancelled",
} as const;

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

/** Map any legacy/foreign value to the canonical English status. */
export function normalizeMatchStatus(s: string | null | undefined): string {
  if (!s) return "";
  const map: Record<string, string> = {
    agendada: "scheduled",
    em_andamento: "in_progress",
    finalizada: "finished",
    cancelada: "cancelled",
  };
  return map[s] ?? s;
}

export function matchStatusLabel(s: string | null | undefined): string {
  const v = normalizeMatchStatus(s);
  switch (v) {
    case "scheduled":
      return "Próximo";
    case "in_progress":
      return "Em curso";
    case "finished":
      return "Concluído";
    case "cancelled":
      return "Cancelada";
    case "publicado":
      return "Publicado";
    default:
      return s ?? "";
  }
}

export function matchStatusTone(s: string | null | undefined): "live" | "ok" | "scheduled" | "neutral" {
  const v = normalizeMatchStatus(s);
  if (v === "in_progress") return "live";
  if (v === "finished" || v === "publicado") return "ok";
  if (v === "scheduled") return "scheduled";
  return "neutral";
}

export function isMatchFinished(s: string | null | undefined): boolean {
  const v = normalizeMatchStatus(s);
  return v === "finished" || v === "publicado";
}
