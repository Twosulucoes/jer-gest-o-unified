import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { NationalFlowStatus } from "@/types/rulesSportEvent";

interface RuleWarningCalloutProps {
  status: NationalFlowStatus;
  notes?: string | null;
  reasonCode?: string | null;
}

export function RuleWarningCallout({ status, notes, reasonCode }: RuleWarningCalloutProps) {
  if (status === "eligible" || status === "unknown") return null;

  const configs: Record<string, { icon: React.ReactNode; variant: "default" | "destructive"; message: string }> = {
    manual_confirmation: {
      icon: <ShieldAlert className="h-4 w-4" />,
      variant: "destructive",
      message: "A elegibilidade nacional depende de regulamento específico da modalidade e/ou norma nacional aplicável. Não automatizar decisão.",
    },
    state_only: {
      icon: <Info className="h-4 w-4" />,
      variant: "default",
      message: "Esta disputa é válida apenas no âmbito estadual e não possui encaminhamento nacional automático.",
    },
    not_eligible: {
      icon: <AlertTriangle className="h-4 w-4" />,
      variant: "destructive",
      message: `Não elegível ao nacional.${reasonCode ? ` Motivo: ${reasonCode}` : ""}`,
    },
    state_selection_required: {
      icon: <Info className="h-4 w-4" />,
      variant: "default",
      message: "A ida ao nacional depende da composição da seleção estadual conforme regulamento.",
    },
    functional_classification_required: {
      icon: <Info className="h-4 w-4" />,
      variant: "default",
      message: "A classificação depende de índice técnico e classificação funcional.",
    },
  };

  const cfg = configs[status];
  if (!cfg) return null;

  return (
    <div className="space-y-2">
      <Alert variant={cfg.variant}>
        {cfg.icon}
        <AlertDescription className="text-sm">{cfg.message}</AlertDescription>
      </Alert>
      {notes && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">{notes}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
