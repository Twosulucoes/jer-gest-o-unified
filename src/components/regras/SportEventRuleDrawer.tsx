import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Pencil, Eye, Save, X } from "lucide-react";
import type { RuleSportEventView } from "@/types/rulesSportEvent";
import { RuleStatusBadge, DisciplineTypeBadge } from "./RuleBadges";
import { RuleJsonAccordion } from "./RuleJsonAccordion";
import { RuleWarningCallout } from "./RuleWarningCallout";
import { humanizeDisciplineType } from "@/lib/rulesTransform";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import RulesForm from "@/components/admin/competition/RulesForm";
import RulesJsonEditor from "@/components/admin/competition/RulesJsonEditor";
import RulesPresetPicker from "@/components/admin/competition/RulesPresetPicker";
import type { SportEventRulesV1 } from "@/types/sportEventRules";
import { useAuth } from "@/hooks/useAuth";

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
  const { hasRole } = useAuth();
  const canEdit =
    hasRole("admin") ||
    hasRole("secretaria" as any) ||
    hasRole("coordenacao_tecnica" as any);

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<SportEventRulesV1 | null>(null);

  const { rules: serverRules, upsertRules, isSaving } = useSportEventRules(
    rule?.event_id,
    rule?.sport_event_id ?? null,
  );

  // Reset mode/draft when rule changes or drawer closes
  useEffect(() => {
    setMode("view");
    setDraft(null);
  }, [rule?.id, open]);

  if (!rule) return null;

  const startEdit = () => {
    setDraft((serverRules as SportEventRulesV1) ?? (rule.rules as unknown as SportEventRulesV1));
    setMode("edit");
  };

  const cancelEdit = () => {
    setDraft(null);
    setMode("view");
  };

  const handleSave = () => {
    if (!draft) return;
    upsertRules(
      { rules: draft, isActive: true },
      {
        onSuccess: () => {
          setMode("view");
          setDraft(null);
        },
      } as any,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-base font-heading">
                {rule.sport_name} — {rule.category_name}
              </SheetTitle>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <RuleStatusBadge status={rule.national_flow_status} />
                <DisciplineTypeBadge type={rule.discipline_type} />
                {rule.is_paralympic && (
                  <Badge variant="outline" className="bg-purple-500/15 text-purple-700 border-purple-500/30">
                    Paralímpico
                  </Badge>
                )}
              </div>
            </div>
            {canEdit && mode === "view" && (
              <Button size="sm" variant="default" onClick={startEdit} className="shrink-0">
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Button>
            )}
            {mode === "edit" && (
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
                <Button size="sm" variant="default" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-3.5 w-3.5 mr-1" /> {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        </SheetHeader>

        {mode === "edit" && draft ? (
          <div className="mt-4">
            <Tabs defaultValue="form">
              <TabsList>
                <TabsTrigger value="form">Editor visual</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="mt-3">
                <RulesForm rules={draft} onChange={setDraft} validationErrors={[]} />
              </TabsContent>
              <TabsContent value="presets" className="mt-3">
                <RulesPresetPicker onApply={setDraft} />
              </TabsContent>
              <TabsContent value="json" className="mt-3">
                <RulesJsonEditor rules={draft} onApply={setDraft} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <RuleWarningCallout
              status={rule.national_flow_status}
              notes={rule.national_eligibility_notes}
              reasonCode={rule.national_eligibility_reason_code}
            />

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Resumo regulatório
              </h4>
              <div className="divide-y divide-border">
                <Field
                  label="Slug"
                  value={<code className="text-[10px] bg-muted px-1 rounded">{rule.sport_event_slug}</code>}
                />
                <Field label="Tipo" value={humanizeDisciplineType(rule.discipline_type)} />
                <Field label="Gêneros" value={rule.allowed_genders_list.join(", ") || "—"} />
                <Field label="Limite por instituição" value={rule.institution_limit_summary} />
                <Field label="Tamanho equipe" value={rule.team_size_summary} />
                <Field label="Substituições" value={rule.substitution_summary} />
                <Field label="CREF" value={rule.cref_summary} />
                <Field label="Técnico externo" value={rule.external_technician_summary} />
                {rule.change_category_hours_before_technical_meeting != null && (
                  <Field
                    label="Mudança de categoria"
                    value={`${rule.change_category_hours_before_technical_meeting}h antes do congresso`}
                  />
                )}
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Elegibilidade Nacional
              </h4>
              <div className="divide-y divide-border">
                <Field label="Status" value={rule.national_flow_label} />
                <Field label="Método de seleção" value={rule.selection_method_label} />
                <Field label="Evento nacional" value={rule.national_event_type ?? "—"} />
                {rule.notes && <Field label="Observações" value={rule.notes} />}
              </div>
            </div>

            <Separator />

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
        )}
      </SheetContent>
    </Sheet>
  );
}
