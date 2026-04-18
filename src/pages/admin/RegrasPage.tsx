import RegrasEventoPage from "./RegrasEventoPage";

/**
 * Página única consolidada de regras do evento.
 *
 * Reaproveita 100% RegrasEventoPage que já contém:
 * - Regras gerais da edição (event_edition_rules)
 * - Catálogo de modalidades (sport_event_rules) com edição visual
 *   no drawer (SportEventRuleDrawer)
 * - Qualificação, assistente de inscrição, publicação e auditoria
 *
 * /admin/regras-evento permanece como alias compatível.
 */
export default function RegrasPage() {
  return <RegrasEventoPage />;
}
