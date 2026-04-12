import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AppEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: AppEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
