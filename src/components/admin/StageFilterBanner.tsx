import { Link, useSearchParams } from "react-router-dom";
import { Layers, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStageParticipantFilter } from "@/hooks/useStageParticipantFilter";

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória",
  regional: "Regional",
  semifinal: "Semifinal",
  final: "Final",
  geral: "Geral",
  legado: "Legado",
  outro: "Outro",
};

/**
 * Banner global exibido no AdminLayout sempre que ?stage= estiver presente.
 * Mostra a etapa ativa, contagem de participantes vinculados e atalhos
 * para voltar ao hub da etapa ou limpar o filtro.
 */
export default function StageFilterBanner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { stage, participantIds, isFiltering } = useStageParticipantFilter();

  if (!isFiltering || !stage) return null;

  const clear = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="border-b border-primary/30 bg-primary/5">
      <div className="flex items-center gap-3 px-4 py-2 text-sm flex-wrap">
        <Layers className="h-4 w-4 text-primary shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">Filtrando por etapa:</span>
          <span className="font-semibold text-foreground">{stage.name}</span>
          <Badge variant="outline" className="text-xs">
            {KIND_LABELS[stage.kind] ?? stage.kind}
          </Badge>
          {participantIds && (
            <Badge variant="secondary" className="text-xs">
              {participantIds.size} participantes
            </Badge>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <Link to={`/admin/etapas/${stage.id}`}>
              <ArrowLeft className="h-3 w-3 mr-1" /> Hub da etapa
            </Link>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clear}>
            <X className="h-3 w-3 mr-1" /> Limpar filtro
          </Button>
        </div>
      </div>
    </div>
  );
}
