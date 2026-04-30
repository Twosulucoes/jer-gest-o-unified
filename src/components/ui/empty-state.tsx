import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "Nenhum dado encontrado",
  description = "Não há informações para exibir neste momento.",
  icon: Icon = Inbox,
  className,
  action
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500",
      className
    )}>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
        <Icon className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
