import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { RuleSportEventView } from "@/types/rulesSportEvent";
import { RuleStatusBadge, DisciplineTypeBadge } from "./RuleBadges";
import { RuleJsonAccordion } from "./RuleJsonAccordion";
import { RuleWarningCallout } from "./RuleWarningCallout";
import { humanizeDisciplineType } from "@/lib/rulesTransform";

interface SportEventRuleDrawerProps {
  rule: RuleSportEventView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export function SportEventRuleDrawer({ rule, open, onOpenChange }: SportEventRuleDrawerProps) {
  if (!rule) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-heading">
            {rule.sport_name} — {rule.category_name}
          </SheetTitle>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <RuleStatusBadge status={rule.national_flow_status} />
            <DisciplineTypeBadge type={rule.discipline_type} />
            {rule.is_paralympic && <Badge variant="outline" className="bg-purple-500/15 text-purple-700 border-purple-500/30">Paralímpico</Badge>}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Warning callout */}
          <RuleWarningCallout
            status={rule.national_flow_status}
            notes={rule.national_eligibility_notes}
            reasonCode={rule.national_eligibility_reason_code}
          />

          {/* Resumo regulatório */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Resumo regulatório</h4>
            <div className="divide-y divide-border">
              <Field label="Slug" value={<code className="text-[10px] bg-muted px-1 rounded">{rule.sport_event_slug}</code>} />
              <Field label="Tipo" value={humanizeDisciplineType(rule.discipline_type)} />
              <Field label="Gêneros" value={rule.allowed_genders_list.join(", ") || "—"} />
              <Field label="Limite por instituição" value={rule.institution_limit_summary} />
              <Field label="Tamanho equipe" value={rule.team_size_summary} />
              <Field label="Substituições" value={rule.substitution_summary} />
              <Field label="CREF" value={rule.cref_summary} />
              <Field label="Técnico externo" value={rule.external_technician_summary} />
              {rule.change_category_hours_before_technical_meeting != null && (
                <Field label="Mudança de categoria" value={`${rule.change_category_hours_before_technical_meeting}h antes do congresso`} />
              )}
            </div>
          </div>

          <Separator />

          {/* Nacional */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Elegibilidade Nacional</h4>
            <div className="divide-y divide-border">
              <Field label="Status" value={rule.national_flow_label} />
              <Field label="Método de seleção" value={rule.selection_method_label} />
              <Field label="Evento nacional" value={rule.national_event_type ?? "—"} />
              {rule.notes && <Field label="Observações" value={rule.notes} />}
            </div>
          </div>

          <Separator />

          {/* JSON snapshots */}
          <RuleJsonAccordion label="Regras (rules JSON)" data={rule.rules} />
          <RuleJsonAccordion label="Elegibilidade nacional (snapshot)" data={rule.national_eligibility_snapshot} />
          {rule.national_eligibility_rule_json && (
            <RuleJsonAccordion label="Regra de elegibilidade (JSON)" data={rule.national_eligibility_rule_json} />
          )}
          {rule.selection_rule_json && (
            <RuleJsonAccordion label="Regra de seleção (JSON)" data={rule.selection_rule_json} />
          )}

          <div className="text-[10px] text-muted-foreground pt-2">
            Versão das regras: v{rule.rules_version}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
