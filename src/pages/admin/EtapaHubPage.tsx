import { Link, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowLeft, Users, UsersRound, Trophy, Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventStage } from "@/contexts/StageContext";

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória",
  regional: "Regional",
  final: "Final",
  geral: "Geral",
};

interface ModuleCard {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: (stageId: string) => string;
  color: string;
}

const MODULES: ModuleCard[] = [
  {
    label: "Participantes",
    description: "Atletas, técnicos e staff inscritos nesta etapa.",
    icon: <UsersRound className="h-5 w-5" />,
    to: (id) => `/admin/participantes?stage=${id}`,
    color: "text-blue-600",
  },
  {
    label: "Delegações (Escolas)",
    description: "Escolas com participantes nesta etapa.",
    icon: <Users className="h-5 w-5" />,
    to: (id) => `/admin/delegacoes?stage=${id}`,
    color: "text-indigo-600",
  },
  {
    label: "Entrar na Etapa →",
    description: "Acessar todos os módulos operacionais (credenciamento, competição, logística, ocorrências, pesquisa, relatórios).",
    icon: <Trophy className="h-5 w-5" />,
    to: (id) => `/admin/etapa/${id}`,
    color: "text-amber-600",
  },
];

export default function EtapaHubPage() {
  const { stageId } = useParams<{ stageId: string }>();
  const eventId = useActiveEventId();

  const { data: stage, isLoading } = useQuery({
    queryKey: ["event_stage", stageId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("*")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventStage | null;
    },
  });

  // KPI: contagem de participantes nessa etapa
  const { data: participantsCount } = useQuery({
    queryKey: ["stage_participants_count", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { count, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id", { count: "exact", head: true })
        .eq("event_stage_id", stageId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!stage) {
    return <Navigate to="/admin/etapas" replace />;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/admin/etapas">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Todas as etapas
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" /> {stage.name}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="default">{KIND_LABELS[stage.kind] ?? stage.kind}</Badge>
              {(stage.starts_at || stage.ends_at) && (
                <span className="text-xs text-muted-foreground">
                  {stage.starts_at ?? "—"} → {stage.ends_at ?? "—"}
                </span>
              )}
              <Badge variant="outline" className="text-xs">
                {participantsCount ?? "—"} participantes vinculados
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link key={m.label} to={m.to(stage.id)} className="group">
            <Card className="h-full hover:border-primary hover:shadow-app-md transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className={m.color}>{m.icon}</span>
                  <span className="group-hover:text-primary transition-colors">{m.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="py-4 text-xs text-muted-foreground">
          💡 Os módulos abrem com o filtro <code className="bg-background px-1.5 py-0.5 rounded">?stage={stage.slug}</code> aplicado.
          Os filtros automáticos por etapa nas páginas operacionais serão aplicados conforme cada módulo for adaptado.
        </CardContent>
      </Card>
    </div>
  );
}
