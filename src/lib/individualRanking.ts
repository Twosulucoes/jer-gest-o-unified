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
