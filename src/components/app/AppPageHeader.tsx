import { type ReactNode } from "react";

interface AppPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function AppPageHeader({ title, description, children }: AppPageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 mt-3 sm:mt-0">{children}</div>}
    </div>
  );
}
