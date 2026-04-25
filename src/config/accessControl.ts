import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** Roles that grant access to /admin and stage admin context. */
export const ADMIN_ACCESS_ROLES: AppRole[] = [
  "admin",
  "secretaria",
  "super_admin",
  "coordenacao_tecnica",
  "coordenador_modalidade",
  "cde",
];

/** Route target for operational-only users. */
export const OPERATIONAL_ROLE_REDIRECT: Partial<Record<AppRole, string>> = {
  transporte: "/pwa/transporte",
  alimentacao: "/pwa/alimentacao",
  alojamento: "/pwa/alojamento",
  delegacao: "/pwa/delegacao",
  mesario: "/aovivo",
  arbitragem: "/aovivo",
};

export const TRANSPORT_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "transporte"];
export const FOOD_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"];
export const LODGING_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "alojamento"];
export const COMPETITION_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"];

/** Roles that grant full admin panel access (beyond coordenador_modalidade). */
const FULL_ADMIN_ROLES: AppRole[] = ["admin", "secretaria", "super_admin", "coordenacao_tecnica", "cde"];

export function getOperationalRedirect(roles: AppRole[]): string | null {
  if (roles.some((r) => FULL_ADMIN_ROLES.includes(r))) return null;

  // coordenador_modalidade sem roles de admin vai direto ao módulo PWA de resultados
  if (roles.includes("coordenador_modalidade")) return "/pwa/resultados";

  for (const role of roles) {
    const target = OPERATIONAL_ROLE_REDIRECT[role];
    if (target) return target;
  }

  return "/pwa";
}
