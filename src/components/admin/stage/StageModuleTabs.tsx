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
        "flex flex-wrap gap-1 border-b border-border -mb-px overflow-x-auto",
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
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
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
