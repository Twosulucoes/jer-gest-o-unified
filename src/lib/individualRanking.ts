import type { IndividualConfig } from "@/components/admin/IndividualConfigEditor";

export interface RankedEntry {
  entryId: string;
  label: string;
  position: number | null;
  rankValue: number | null;
  rankField: "time_ms" | "distance_cm" | "points" | "position" | "score" | null;
  source: "result" | "attempt" | "manual_position" | null;
  resultStatus: string | null;
  outcome: string | null;
  excluded: boolean; // dsq, dns, dnf, wo_loss, cancelled
}

const EXCLUDED_OUTCOMES = new Set(["dsq", "dns", "dnf", "wo_loss", "cancelled"]);

/**
 * Determine the primary ranking field from individual_config.
 * Priority: time > distance > points > score > position (manual).
 */
export function getPrimaryRankField(config: IndividualConfig | null): RankedEntry["rankField"] {
  if (!config) return null;
  const rf = config.result_fields ?? {};
  const hasAny = Object.values(rf).some(Boolean);
  if (!hasAny) return null;
  if (rf.time) return "time_ms";
  if (rf.distance) return "distance_cm";
  if (rf.points) return "points";
  if (rf.score) return "score";
  if (rf.position) return "position";
  return null;
}

/**
 * Get the best attempt value for an entry.
 * For time: lowest valid value. For distance/points: highest valid value.
 */
function bestAttemptValue(
  attempts: any[],
  entryId: string,
  field: "time_ms" | "distance_cm" | "points"
): number | null {
  const key = field === "time_ms" ? "value_ms" : field === "distance_cm" ? "value_cm" : "value_points";
  const vals = attempts
    .filter((a) => a.match_entry_id === entryId && a.is_valid && a[key] != null)
    .map((a) => Number(a[key]));
  if (vals.length === 0) return null;
  return field === "time_ms" ? Math.min(...vals) : Math.max(...vals);
}

/**
 * Compute ranking for a single individual match/heat.
 */
export function computeIndividualRanking(
  entries: any[],
  results: any[],
  attempts: any[],
  config: IndividualConfig | null,
  getEntryLabel: (entry: any) => string
): RankedEntry[] {
  const field = getPrimaryRankField(config);
  const resultsMap = new Map(results.map((r) => [r.match_entry_id, r]));

  const items: RankedEntry[] = entries.map((entry) => {
    const result = resultsMap.get(entry.id);
    const outcome = result?.outcome ?? null;
    const excluded = outcome ? EXCLUDED_OUTCOMES.has(outcome) : false;

    // Manual position ranking
    if (field === "position") {
      return {
        entryId: entry.id,
        label: getEntryLabel(entry),
        position: result?.position ?? null,
        rankValue: result?.position ?? null,
        rankField: "position",
        source: result?.position != null ? "manual_position" : null,
        resultStatus: result?.result_status ?? null,
        outcome,
        excluded,
      };
    }

    // Score-based (string) — not sortable numerically, just show position from result
    if (field === "score") {
      return {
        entryId: entry.id,
        label: getEntryLabel(entry),
        position: result?.position ?? null,
        rankValue: null,
        rankField: "score",
        source: result ? "result" : null,
        resultStatus: result?.result_status ?? null,
        outcome,
        excluded,
      };
    }

    // Numeric fields: time_ms, distance_cm, points
    if (field === "time_ms" || field === "distance_cm" || field === "points") {
      let value: number | null = result?.[field] != null ? Number(result[field]) : null;
      let source: RankedEntry["source"] = value != null ? "result" : null;

      // If attempts are enabled and we have a better attempt value, prefer it
      if (config?.allows_attempts && attempts.length > 0) {
        const bestAttempt = bestAttemptValue(attempts, entry.id, field);
        if (bestAttempt != null) {
          // Use attempt if no result, or if attempt is better
          if (value == null) {
            value = bestAttempt;
            source = "attempt";
          } else {
            const isBetter =
              field === "time_ms" ? bestAttempt < value : bestAttempt > value;
            if (isBetter) {
              value = bestAttempt;
              source = "attempt";
            }
          }
        }
      }

      return {
        entryId: entry.id,
        label: getEntryLabel(entry),
        position: null, // computed below
        rankValue: value,
        rankField: field,
        source,
        resultStatus: result?.result_status ?? null,
        outcome,
        excluded,
      };
    }

    // No ranking field configured
    return {
      entryId: entry.id,
      label: getEntryLabel(entry),
      position: result?.position ?? null,
      rankValue: null,
      rankField: null,
      source: null,
      resultStatus: result?.result_status ?? null,
      outcome,
      excluded,
    };
  });

  // Sort & assign positions for numeric fields
  if (field === "time_ms" || field === "distance_cm" || field === "points") {
    const sortable = items.filter((i) => !i.excluded && i.rankValue != null);
    const unsortable = items.filter((i) => i.excluded || i.rankValue == null);

    sortable.sort((a, b) => {
      if (field === "time_ms") return (a.rankValue ?? Infinity) - (b.rankValue ?? Infinity);
      return (b.rankValue ?? -Infinity) - (a.rankValue ?? -Infinity);
    });

    sortable.forEach((item, idx) => {
      item.position = idx + 1;
    });

    return [...sortable, ...unsortable];
  }

  // For position-based, sort by position
  if (field === "position") {
    const withPos = items.filter((i) => !i.excluded && i.position != null);
    const without = items.filter((i) => i.excluded || i.position == null);
    withPos.sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
    return [...withPos, ...without];
  }

  return items;
}

export const formatTimeMs = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
  return `${secs}.${millis.toString().padStart(3, "0")}s`;
};

export const formatDistanceCm = (cm: number): string => {
  if (cm >= 100) return `${(cm / 100).toFixed(2)}m`;
  return `${cm}cm`;
};

export function formatRankValue(value: number | null, field: RankedEntry["rankField"]): string {
  if (value == null) return "—";
  if (field === "time_ms") return formatTimeMs(value);
  if (field === "distance_cm") return formatDistanceCm(value);
  if (field === "points") return `${value} pts`;
  if (field === "position") return `${value}º`;
  return String(value);
}

/* ──────────────────────────────────────────────────────────
   Cross-heat ranking: consolidate results across heats
   ────────────────────────────────────────────────────────── */

export interface CrossHeatEntry {
  entryId: string;
  matchId: string;
  heatName: string;
  label: string;
  delegationName: string;
  position: number | null;
  rankValue: number | null;
  rankField: RankedEntry["rankField"];
  source: RankedEntry["source"];
  resultStatus: string | null;
  outcome: string | null;
  excluded: boolean;
  isCurrentMatch: boolean;
}

const OUTCOME_SORT: Record<string, number> = {
  dsq: 1, dns: 2, dnf: 3, wo_loss: 4, cancelled: 5,
};

/**
 * Consolidate ranking across multiple heats for a sport_event.
 * @param heats – array of { matchId, heatName, entries, results, attempts }
 * @param family – "time" | "mark"
 * @param config – IndividualConfig for result_fields
 * @param getEntryLabel – label resolver
 * @param getDelegationName – delegation resolver
 * @param currentMatchId – highlight entries from this match
 */
export function computeCrossHeatRanking(
  heats: Array<{
    matchId: string;
    heatName: string;
    entries: any[];
    results: any[];
    attempts: any[];
  }>,
  family: "time" | "mark",
  config: IndividualConfig | null,
  getEntryLabel: (entry: any) => string,
  getDelegationName: (entry: any) => string,
  currentMatchId?: string
): CrossHeatEntry[] {
  const field = getPrimaryRankField(config);
  const items: CrossHeatEntry[] = [];

  for (const heat of heats) {
    const resultsMap = new Map(heat.results.map((r) => [r.match_entry_id, r]));

    for (const entry of heat.entries) {
      const result = resultsMap.get(entry.id);
      const outcome = result?.outcome ?? null;
      const excluded = outcome ? EXCLUDED_OUTCOMES.has(outcome) : false;

      let value: number | null = null;
      let source: RankedEntry["source"] = null;

      if (field === "time_ms" || field === "distance_cm" || field === "points") {
        value = result?.[field] != null ? Number(result[field]) : null;
        source = value != null ? "result" : null;

        if (config?.allows_attempts && heat.attempts.length > 0) {
          const best = bestAttemptValue(heat.attempts, entry.id, field);
          if (best != null) {
            if (value == null) {
              value = best;
              source = "attempt";
            } else {
              const isBetter = field === "time_ms" ? best < value : best > value;
              if (isBetter) { value = best; source = "attempt"; }
            }
          }
        }
      }

      items.push({
        entryId: entry.id,
        matchId: heat.matchId,
        heatName: heat.heatName,
        label: getEntryLabel(entry),
        delegationName: getDelegationName(entry),
        position: null,
        rankValue: value,
        rankField: field,
        source,
        resultStatus: result?.result_status ?? null,
        outcome,
        excluded,
        isCurrentMatch: heat.matchId === currentMatchId,
      });
    }
  }

  // Sort: valid entries first, then excluded by outcome category
  const valid = items.filter((i) => !i.excluded && i.rankValue != null);
  const noValue = items.filter((i) => !i.excluded && i.rankValue == null);
  const excludedItems = items.filter((i) => i.excluded);

  // Sort valid entries
  valid.sort((a, b) => {
    if (family === "time") return (a.rankValue ?? Infinity) - (b.rankValue ?? Infinity);
    return (b.rankValue ?? -Infinity) - (a.rankValue ?? -Infinity);
  });

  // Assign positions with ties
  let pos = 1;
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i].rankValue !== valid[i - 1].rankValue) {
      pos = i + 1;
    }
    valid[i].position = pos;
  }

  // Sort excluded by outcome category
  excludedItems.sort((a, b) => (OUTCOME_SORT[a.outcome ?? ""] ?? 99) - (OUTCOME_SORT[b.outcome ?? ""] ?? 99));

  return [...valid, ...noValue, ...excludedItems];
}
