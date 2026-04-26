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
              {prova.family === "combat" ? "Combate" : prova.is_collective ? "Coletiva" : "Individual"}
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

          <p className="text-sm text-muted-foreground">
            {prova.is_grouped_combat ? "Múltiplas Categorias" : `${prova.sport_name} · ${prova.category_name}`}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
            {prova.is_grouped_combat && (
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold">Categorias</span>
                <span className="text-lg font-bold">{prova.category_count}</span>
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">
                {prova.is_grouped_combat ? "Atletas" : "Lutas"}
              </span>
              <span className="text-lg font-bold">
                {prova.is_grouped_combat ? prova.enrolled_count : prova.match_count}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Registradas</span>
              <span className="text-lg font-bold">{prova.match_count}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Pendentes</span>
              <span className="text-lg font-bold text-amber-600">
                {prova.match_count - prova.results_validated}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold">Homologadas</span>
              <span className="text-lg font-bold text-green-600">{prova.results_validated}</span>
            </div>
          </div>
        </div>

        {/* Right: Action */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="lg"
            variant="default"
            className="gap-2 font-semibold"
            onClick={() => onAction(prova)}
          >
            Abrir Painel Score
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
