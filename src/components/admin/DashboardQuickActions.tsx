import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DashboardAction {
  label: string;
  to: string;
  icon: React.ReactNode;
  group: string;
}

interface DashboardQuickActionsProps {
  actions: DashboardAction[];
}

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-1">
        Acesso Rápido
      </h2>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-center transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-1 active:scale-[0.96]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm group-hover:shadow-glow">
              {action.icon}
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-foreground block">{action.label}</span>
              <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-tighter">{action.group}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
