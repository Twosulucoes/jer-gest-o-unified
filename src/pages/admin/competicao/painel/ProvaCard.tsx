import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Users } from "lucide-react";
import {
  STATUS_CONFIG,
  STEP_COLORS,
  getActionIcon,
  getActionLabel,
} from "./lib/statusConfig";
import type { ProvaRow, ProvaStatus } from "./lib/computeProvaData";

interface ProvaCardProps {
  prova: ProvaRow;
  onAction: (p: ProvaRow) => void;
}

export function ProvaCard({ prova, onAction }: ProvaCardProps) {
  const cfg = STATUS_CONFIG[prova.status];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-heading font-semibold text-sm truncate">
              {prova.name}
            </h4>
            <Badge variant="outline" className="text-[10px]">
              {prova.is_collective ? "Coletiva" : "Individual"}
            </Badge>
            <div
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}
              title={
                prova.status === "bloqueada"
                  ? "Aguardando liberação na pré-validação"
                  : undefined
              }
            >
              {cfg.icon}
              {cfg.label}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {prova.sport_name} · {prova.category_name}
          </p>

          <div className="flex gap-4 text-xs text-muted-foreground">
            {prova.is_collective ? (
              <>
                <span>
                  <Users className="inline h-3 w-3 mr-0.5" />
                  {prova.team_count} equipes
                </span>
                <span>{prova.match_count} partidas</span>
                <span>{prova.matches_with_result} resultados</span>
              </>
            ) : (
              <>
                <span>
                  <Users className="inline h-3 w-3 mr-0.5" />
                  {prova.enrolled_count} inscritos
                </span>
                <span>{prova.match_count} partidas</span>
                <span>{prova.matches_with_result} resultados</span>
              </>
            )}
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1 mt-1">
            {prova.steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${STEP_COLORS[step.state]}`}
                  role="img"
                  aria-label={`${step.label}: ${
                    step.state === "done"
                      ? "Concluído"
                      : step.state === "active"
                      ? "Em andamento"
                      : "Pendente"
                  }`}
                  title={`${step.label}: ${
                    step.state === "done"
                      ? "Concluído"
                      : step.state === "active"
                      ? "Em andamento"
                      : "Pendente"
                  }`}
                />
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  {step.label}
                </span>
                {i < prova.steps.length - 1 && (
                  <span className="text-muted-foreground/30 text-[8px] hidden sm:inline">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Progress + Action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 space-y-1">
            <Progress value={prova.progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-center">
              {prova.progress}%
            </p>
          </div>
          <Button
            size="sm"
            variant={prova.status === "concluida" ? "outline" : "default"}
            className="gap-1.5 whitespace-nowrap"
            onClick={() => onAction(prova)}
          >
            {getActionIcon(prova.status as ProvaStatus)}
            {getActionLabel(prova.status as ProvaStatus)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
