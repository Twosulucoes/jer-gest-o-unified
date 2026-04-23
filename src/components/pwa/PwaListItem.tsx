import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PwaStatusBadge, type PwaStatusTone } from "./PwaStatusBadge";

interface PwaListItemProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  status?: { label: string; tone?: PwaStatusTone };
  onClick?: () => void;
  className?: string;
}

/**
 * PwaListItem — linha de lista padrão (atletas, viagens, partidas, delegação...).
 * Densa, dark, mobile-first.
 */
export function PwaListItem({
  leading,
  title,
  subtitle,
  trailing,
  status,
  onClick,
  className,
}: PwaListItemProps) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "op-card flex items-center gap-3 px-3 py-3 transition-colors",
        interactive && "cursor-pointer hover:border-module active:scale-[0.99]",
        className,
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{title}</div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {status && (
        <PwaStatusBadge tone={status.tone}>{status.label}</PwaStatusBadge>
      )}
      {trailing}
      {interactive && !trailing && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}

/**
 * PwaListAvatar — avatar circular com iniciais, alinhado ao accent do módulo.
 */
export function PwaListAvatar({ initials, tone = "module" }: { initials: string; tone?: "module" | "neutral" }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold uppercase",
        tone === "module" ? "bg-module-soft text-module" : "bg-muted/50 text-muted-foreground",
      )}
    >
      {initials.slice(0, 2)}
    </div>
  );
}
