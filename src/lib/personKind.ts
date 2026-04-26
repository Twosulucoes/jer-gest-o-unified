/**
 * Tipos de pessoa registrados em `public.people`.
 * Espelha o CHECK constraint `people_kind_check` da migration de árbitros.
 *
 * Uso: filtros, KPIs, badges e formulários que precisam classificar a pessoa
 * (atleta/técnico ficam em `participants`, não em `people`).
 */

export type PersonKind = "pessoa" | "acompanhante" | "staff" | "arbitro";

export const PERSON_KINDS: PersonKind[] = ["pessoa", "acompanhante", "staff", "arbitro"];

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  pessoa: "Pessoa",
  acompanhante: "Acompanhante",
  staff: "Staff",
  arbitro: "Árbitro",
};

export const PERSON_KIND_BADGE_VARIANT: Record<PersonKind, "default" | "secondary" | "outline" | "success"> = {
  pessoa: "outline",
  acompanhante: "secondary",
  staff: "default",
  arbitro: "success",
};

export function personKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Pessoa";
  return PERSON_KIND_LABEL[kind as PersonKind] ?? kind;
}
