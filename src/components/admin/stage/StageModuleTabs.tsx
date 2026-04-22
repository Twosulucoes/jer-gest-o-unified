import { NavLink, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface StageTabItem {
  label: string;
  /** Caminho relativo a /admin/etapa/:stageId (ex.: "competicao/painel"). Vazio = índice do módulo. */
  to: string;
  icon?: React.ReactNode;
  roles?: AppRole[];
  /** Marca como a aba "índice" do módulo (usa `end` no NavLink). */
  end?: boolean;
}

interface StageModuleTabsProps {
  items: StageTabItem[];
  className?: string;
}

/**
 * Sub-navegação horizontal por abas dentro de um módulo da etapa.
 * Exibe apenas itens cujo perfil do usuário tem acesso.
 */
export function StageModuleTabs({ items, className }: StageModuleTabsProps) {
  const { stageId } = useParams<{ stageId: string }>();
  const { hasRole } = useAuth();

  const visible = items.filter((it) => !it.roles || it.roles.some((r) => hasRole(r)));
  if (visible.length === 0 || !stageId) return null;

  const base = `/admin/etapa/${stageId}`;

  return (
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto overscroll-x-contain touch-pan-x p-1 rounded-lg bg-muted/40 border border-border/60",
        className,
      )}
      aria-label="Subnavegação do módulo"
    >
      {visible.map((it) => {
        const to = it.to ? `${base}/${it.to}` : base;
        return (
          <NavLink
            key={to}
            to={to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all",
                isActive
                  ? "bg-[hsl(var(--module-accent)/0.14)] text-[hsl(var(--module-accent))] shadow-sm ring-1 ring-[hsl(var(--module-accent)/0.35)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )
            }
          >
            {it.icon}
            {it.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
