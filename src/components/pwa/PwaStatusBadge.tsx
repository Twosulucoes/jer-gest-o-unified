import { cn } from "@/lib/utils";

export type PwaStatusTone =
  | "ok"
  | "pending"
  | "live"
  | "scheduled"
  | "danger"
  | "neutral"
  | "module";

const TONE: Record<PwaStatusTone, string> = {
  ok: "bg-green-500/15 text-green-400 ring-1 ring-inset ring-green-500/30",
  pending: "bg-amber/15 text-amber ring-1 ring-inset ring-amber/30",
  live: "bg-red/15 text-red ring-1 ring-inset ring-red/40",
  scheduled: "bg-blue/15 text-blue ring-1 ring-inset ring-blue/30",
  danger: "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30",
  neutral: "bg-muted/40 text-muted-foreground ring-1 ring-inset ring-border/60",
  module: "bg-module-soft text-module ring-1 ring-inset border-module",
};

export function PwaStatusBadge({
  tone = "neutral",
  children,
  pulse,
  className,
}: {
  tone?: PwaStatusTone;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        TONE[tone],
        className,
      )}
    >
      {pulse && (
        <span className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
