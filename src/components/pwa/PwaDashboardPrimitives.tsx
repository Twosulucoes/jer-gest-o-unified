import { cn } from "@/lib/utils";

export type PwaStatTone = "default" | "purple" | "green" | "amber" | "blue" | "red";

const toneClass: Record<PwaStatTone, string> = {
  default: "text-foreground",
  purple: "text-purple dark:text-purple-300",
  green: "text-green-600 dark:text-green-400",
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-blue-600 dark:text-blue-400",
  red: "text-red-600 dark:text-red-400",
};

export interface PwaStatItem {
  label: string;
  value: number | string;
  tone?: PwaStatTone;
}

export function PwaStatTriplet({ items, loading }: { items: PwaStatItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-app-sm">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-app-sm">
      <div className="grid grid-cols-3 divide-x divide-border/70">
        {items.map((item, i) => (
          <div key={i} className="px-2 text-center first:pl-0 last:pr-0">
            <p className={cn("text-2xl font-bold tabular-nums font-heading", toneClass[item.tone ?? "default"])}>
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PwaSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

export function occupancyTone(pct: number): PwaStatTone {
  if (pct >= 85) return "red";
  if (pct >= 65) return "amber";
  return "green";
}

export function occupancyBarClass(pct: number): string {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 65) return "bg-amber-500";
  return "bg-green-500";
}
