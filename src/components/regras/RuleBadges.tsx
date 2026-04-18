import { Badge } from "@/components/ui/badge";
import type { NationalFlowStatus } from "@/types/rulesSportEvent";
import { buildNationalFlowLabel } from "@/lib/rulesTransform";

const STATUS_STYLES: Record<NationalFlowStatus, string> = {
  state_only: "bg-warning/15 text-warning border-warning/30",
  eligible: "bg-success/15 text-success border-success/30",
  not_eligible: "bg-destructive/15 text-destructive border-destructive/30",
  manual_confirmation: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  state_selection_required: "bg-info/15 text-info border-info/30",
  functional_classification_required: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function RuleStatusBadge({ status }: { status: NationalFlowStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {buildNationalFlowLabel(status)}
    </Badge>
  );
}

export function EligibilityBadge({ eligible }: { eligible: boolean | null }) {
  if (eligible === true) return <Badge variant="outline" className="bg-success/15 text-success border-success/30">Elegível ao nacional</Badge>;
  if (eligible === false) return <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Não elegível ao nacional</Badge>;
  return <Badge variant="outline" className="bg-muted text-muted-foreground">Não informado</Badge>;
}

export function SelectionMethodBadge({ method }: { method: string | null }) {
  if (!method || method === "NONE") return null;
  const labels: Record<string, string> = {
    STATE_SELECTION_MIXED: "Seleção estadual",
    DIRECT_CLASSIFICATION_SUBJECT_TO_NATIONAL_RULES: "Classificação direta",
    TECHNICAL_INDEX_AND_FUNCTIONAL_CLASSIFICATION: "Índice técnico",
  };
  return (
    <Badge variant="outline" className="bg-info/15 text-info border-info/30">
      {labels[method] ?? method}
    </Badge>
  );
}

export function DisciplineTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, { label: string; cls: string }> = {
    individual: { label: "Individual", cls: "bg-info/15 text-info border-info/30" },
    collective: { label: "Coletiva", cls: "bg-accent/15 text-accent border-accent/30" },
    individual_paralympic: { label: "Individual paralímpica", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" },
  };
  const entry = map[type];
  if (!entry) return null;
  return <Badge variant="outline" className={entry.cls}>{entry.label}</Badge>;
}

export function ManualConfirmationBadge() {
  return (
    <Badge variant="outline" className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">
      Confirmação manual
    </Badge>
  );
}
