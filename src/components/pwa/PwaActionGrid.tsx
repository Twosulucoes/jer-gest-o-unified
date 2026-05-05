import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { usePwaNavigation, type PwaModule } from "@/hooks/pwa/usePwaNavigation";

export interface PwaAction {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  description?: string;
  requireStage?: boolean;
  /** Quando true, o card ocupa toda a largura do grid (col-span-full) e
   * fica mais alto, com ícone maior. Use para a ação primária do módulo
   * (ex: Scan QR na Alimentação) — operador acerta o que precisa em 1 toque
   * sem ler labels. */
  featured?: boolean;
}

/**
 * PwaActionGrid — grade compacta de atalhos (2 colunas), padrão das telas operacionais.
 * Cada item usa o accent do módulo para o ícone.
 */
export function PwaActionGrid({
  actions,
  columns = 2,
  className,
}: {
  actions: PwaAction[];
  columns?: 2 | 3;
  className?: string;
}) {
  const navigate = useNavigate();
  const { navigateToPwa } = usePwaNavigation();
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={cn("grid gap-3", cols, className)}>
      {actions.map((a) => {
        const Icon = a.icon;
        const handle = () => {
          if (a.onClick) {
            a.onClick();
          } else if (a.to) {
            if (a.to.startsWith("/pwa/") && a.to !== "/pwa/configuracao" && a.to !== "/pwa/install") {
              const moduleMatch = a.to.match(/\/pwa\/([^/]+)/);
              const module = moduleMatch ? moduleMatch[1] as PwaModule : "configuracao" as PwaModule;
              const subPath = a.to.replace(`/pwa/${module}`, "");
              
              navigateToPwa(module, subPath, { skipStageCheck: a.requireStage === false });
            } else {
              navigate(a.to);
            }
          }
        };
        return (
          <button
            key={a.label}
            type="button"
            onClick={handle}
            className={cn(
              "op-card group relative flex items-center justify-center text-center transition-all hover:-translate-y-0.5 hover:border-module active:scale-[0.98]",
              a.featured
                ? "col-span-full flex-row gap-4 px-5 py-6 border-module/40 bg-module-soft/30"
                : "flex-col gap-2 px-3 py-4",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-2xl bg-module-soft text-module shadow-app-sm shrink-0",
                a.featured ? "h-16 w-16" : "h-12 w-12",
              )}
            >
              <Icon className={a.featured ? "h-8 w-8" : "h-6 w-6"} />
            </div>
            <div className={cn("flex flex-col", a.featured ? "items-start text-left" : "items-center")}>
              <span className={cn("font-semibold text-foreground", a.featured ? "text-lg" : "text-sm")}>
                {a.label}
              </span>
              {a.description && (
                <span className={cn(
                  "uppercase tracking-wider text-muted-foreground",
                  a.featured ? "text-xs mt-0.5" : "text-[10px]",
                )}>
                  {a.description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}