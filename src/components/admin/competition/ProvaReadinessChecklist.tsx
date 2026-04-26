import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProvaStatus } from "@/hooks/useProvaStatus";
import { isAtLeast, PROVA_STATUS, PROVA_STATUS_LABEL, type ProvaStatus } from "@/lib/competition/provaStatus";

type ChecklistState = "ok" | "warn" | "missing";

interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  hint: string;
  goTo: string;
}

interface Props {
  eventId: string;
  sportEventId: string;
  stageId?: string | null;
  onJumpTo: (stepKey: string) => void;
}

function stateForStep(stepKey: string, status: ProvaStatus, hasMatches: boolean): ChecklistState {
  if (!hasMatches && stepKey !== "participants") return "missing";
  const minimums: Record<string, ProvaStatus> = {
    participants: PROVA_STATUS.ENROLLED,
    builder: PROVA_STATUS.BUILT,
    agenda: PROVA_STATUS.SCHEDULED,
    arbitragem: PROVA_STATUS.OFFICIATED,
    results: PROVA_STATUS.FINISHED,
    publish: PROVA_STATUS.PUBLISHED,
  };
  const min = minimums[stepKey];
  if (!min) return "warn";
  if (isAtLeast(status, min)) return "ok";
  // Etapas intermediárias parciais → warn; ausência total → missing
  if (stepKey === "agenda" || stepKey === "arbitragem" || stepKey === "results" || stepKey === "publish") {
    return "warn";
  }
  return "missing";
}

export default function ProvaReadinessChecklist({ eventId, sportEventId, onJumpTo }: Props) {
  const { status, signals, isLoading } = useProvaStatus(eventId, sportEventId);

  if (isLoading) {
    return (
      <Card><CardContent className="pt-4 text-xs text-muted-foreground">Carregando checklist...</CardContent></Card>
    );
  }

  const { enrolled, matchesCount, scheduled, finished, officialsCount, resultsPublished } = signals;
  const hasMatches = matchesCount > 0;

  const items: ChecklistItem[] = [
    {
      key: "participants",
      label: "Inscritos",
      state: stateForStep("participants", status, hasMatches),
      hint: enrolled > 0 ? `${enrolled} confirmados` : "Sem inscritos",
      goTo: "participants",
    },
    {
      key: "builder",
      label: "Disputas montadas",
      state: stateForStep("builder", status, hasMatches),
      hint: matchesCount > 0 ? `${matchesCount} partida(s)` : "Sem partidas",
      goTo: "builder",
    },
    {
      key: "agenda",
      label: "Agenda completa",
      state: !hasMatches ? "missing" : scheduled === matchesCount ? "ok" : "warn",
      hint: !hasMatches ? "—" : `${scheduled}/${matchesCount} com data, hora e local`,
      goTo: "agenda",
    },
    {
      key: "arbitragem",
      label: "Arbitragem escalada",
      state: !hasMatches ? "missing" : officialsCount > 0 ? "ok" : "warn",
      hint: !hasMatches ? "—" : `${officialsCount} designação(ões)`,
      goTo: "arbitragem",
    },
    {
      key: "results",
      label: "Resultados lançados",
      state: !hasMatches ? "missing" : finished === matchesCount ? "ok" : "warn",
      hint: !hasMatches ? "—" : `${finished}/${matchesCount} finalizadas`,
      goTo: "results",
    },
    {
      key: "publish",
      label: "Publicado no portal",
      state: finished === 0 ? "missing" : resultsPublished > 0 ? "ok" : "warn",
      hint: resultsPublished > 0 ? `${resultsPublished} publicado(s)` : "Aguardando publicação",
      goTo: "publish",
    },
  ];

  const allOk = status === PROVA_STATUS.PUBLISHED;

  return (
    <Card className={cn(allOk && "border-success/40 bg-success/5")}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-semibold">Prontidão da Prova</h4>
            <p className="text-[11px] text-muted-foreground">
              Estado atual: <strong>{PROVA_STATUS_LABEL[status]}</strong>
            </p>
          </div>
          {allOk && <Badge variant="outline" className="border-success/50 text-success">Tudo pronto</Badge>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onJumpTo(it.goTo)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-md border p-2 text-left transition-colors hover:bg-muted/50",
                it.state === "ok" && "border-success/40",
                it.state === "warn" && "border-pending/50 bg-pending/5",
                it.state === "missing" && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center gap-1.5">
                {it.state === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                {it.state === "warn" && <AlertCircle className="h-3.5 w-3.5 text-pending" />}
                {it.state === "missing" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className="text-xs font-medium">{it.label}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{it.hint}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                ir <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
