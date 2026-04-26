import { cn } from "@/lib/utils";

/**
 * PwaScreen — wrapper raiz para todas as telas operacionais (PWA).
 * Aplica fundo dark com leve glow do accent do módulo, padding e safe area.
 */
export function PwaScreen({
  children,
  className,
  noPadding,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={cn("op-screen relative flex flex-col", className)}>
      <div className={cn("relative flex-1", !noPadding && "pb-32")}>{children}</div>
    </div>
  );
}

/**
 * PwaContainer — container central com largura mobile-first.
 */
export function PwaContainer({
  children,
  className,
  size = "sm",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const max = size === "lg" ? "max-w-5xl" : size === "md" ? "max-w-2xl" : "max-w-md";
  return (
    <div className={cn("relative mx-auto w-full px-4 py-4 space-y-4", max, className)}>
      {children}
    </div>
  );
}

/**
 * PwaEventSubtitle — exibe contexto de evento abaixo do header.
 */
export function PwaEventSubtitle({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
      {children}
    </p>
  );
}

/**
 * PwaBottomBar — barra fixa inferior (CTA principal das telas operacionais).
 */
export function PwaBottomBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "fixed bottom-16 left-0 right-0 z-30 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur-md transition-all",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
