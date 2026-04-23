import { cn } from "@/lib/utils";

export type PwaStatTone = "default" | "module" | "purple" | "green" | "amber" | "blue" | "red";

const toneClass: Record<PwaStatTone, string> = {
  default: "text-foreground",
  module: "text-module",
  purple: "text-purple",
  green: "text-green-400",
  amber: "text-amber",
  blue: "text-blue",
  red: "text-red",
};

export interface PwaStatItem {
  label: string;
  value: number | string;
  tone?: PwaStatTone;
}

/**
 * PwaStatTriplet — bloco compacto com 3 KPIs lado a lado, dark e operacional.
 * Padrão visual das telas mostradas nas referências.
 */
export function PwaStatTriplet({ items, loading }: { items: PwaStatItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="op-card p-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="op-card p-4">
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {items.map((item, i) => (
          <div key={i} className="px-2 text-center first:pl-0 last:pr-0">
            <p className={cn("op-stat", toneClass[item.tone ?? "default"])}>
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PwaSectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="op-label">{children}</p>;
}

export function occupancyTone(pct: number): PwaStatTone {
  if (pct >= 85) return "red";
  if (pct >= 65) return "amber";
  return "green";
}

export function occupancyBarClass(pct: number): string {
  if (pct >= 85) return "bg-red";
  if (pct >= 65) return "bg-amber";
  return "bg-green-500";
}
