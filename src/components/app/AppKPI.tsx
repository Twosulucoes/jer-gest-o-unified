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
      <div className={cn("rounded-2xl border border-border/50 bg-card p-5 shadow-sm", className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1",
      className
    )}>
      {/* Decorative background element */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={cn(
            "text-3xl font-extrabold font-heading tabular-nums leading-none tracking-tight",
            alert ? "text-destructive" : "text-foreground"
          )}>
            {value}
          </p>
          {sub && <p className="text-[11px] font-medium text-muted-foreground line-clamp-1">{sub}</p>}
        </div>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 shadow-sm",
          alert 
            ? "bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-white" 
            : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
