import { type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AppKPIProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  sub?: string;
  alert?: boolean;
  loading?: boolean;
  className?: string;
}

export function AppKPI({ label, value, icon: Icon, sub, alert, loading, className }: AppKPIProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4 shadow-app-sm", className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 shadow-app-sm transition-shadow hover:shadow-app-md",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground tracking-wide">{label}</p>
          <p className={cn(
            "text-2xl font-bold mt-1 font-heading",
            alert ? "text-destructive" : "text-foreground"
          )}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          alert ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
