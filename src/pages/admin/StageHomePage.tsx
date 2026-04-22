import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck, Trophy, Building, UtensilsCrossed, Bus,
  AlertTriangle, ClipboardList, FileBarChart, ArrowRight, Gavel,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_OPS: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];

interface ModuleCard {
  label: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  color: string;
  roles: AppRole[];
}

const MODULES: ModuleCard[] = [
  { label: "Credenciamento", description: "Emissão e validação de credenciais.", icon: <BadgeCheck className="h-5 w-5" />, to: "credenciamento", color: "text-emerald-600", roles: ALL_OPS },
  { label: "Competição", description: "Provas, partidas e resultados desta etapa.", icon: <Trophy className="h-5 w-5" />, to: "competicao", color: "text-amber-600", roles: [...ALL_OPS, "coordenador_modalidade"] },
  { label: "Alojamento", description: "Locais, unidades e ocupações.", icon: <Building className="h-5 w-5" />, to: "alojamento", color: "text-purple-600", roles: [...ALL_OPS, "alojamento"] },
  { label: "Alimentação", description: "Janelas, tipos e consumos.", icon: <UtensilsCrossed className="h-5 w-5" />, to: "alimentacao", color: "text-orange-600", roles: [...ALL_OPS, "alimentacao"] },
  { label: "Transporte", description: "Veículos, rotas e viagens.", icon: <Bus className="h-5 w-5" />, to: "transporte", color: "text-cyan-600", roles: [...ALL_OPS, "transporte"] },
  { label: "Ocorrências", description: "Registro e acompanhamento de incidentes.", icon: <AlertTriangle className="h-5 w-5" />, to: "ocorrencias", color: "text-red-600", roles: ALL_OPS },
  { label: "Protestos (CDE)", description: "Fila de julgamento de protestos online.", icon: <Gavel className="h-5 w-5" />, to: "protestos", color: "text-rose-600", roles: [...ALL_OPS, "cde", "super_admin"] },
  { label: "Pesquisa de Satisfação", description: "Coleta de feedback dos participantes.", icon: <ClipboardList className="h-5 w-5" />, to: "pesquisa", color: "text-blue-600", roles: ALL_OPS },
  { label: "Relatórios da Etapa", description: "Relatórios operacionais desta etapa.", icon: <FileBarChart className="h-5 w-5" />, to: "relatorios", color: "text-indigo-600", roles: [...ALL_OPS, "coordenador_modalidade"] },
];

export default function StageHomePage() {
  const { stageId } = useParams<{ stageId: string }>();
  const { hasRole } = useAuth();

  const { data: counts } = useQuery({
    queryKey: ["stage_overview_counts", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { count } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id", { count: "exact", head: true })
        .eq("event_stage_id", stageId);
      return { participants: count ?? 0 };
    },
  });

  const visible = MODULES.filter((m) => m.roles.some((r) => hasRole(r)));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Visão Geral da Etapa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione um módulo operacional para começar.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {counts?.participants ?? "—"} participantes vinculados
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((m) => (
          <Link key={m.to} to={m.to} className="group">
            <Card className="h-full hover:border-primary hover:shadow-app-md transition-all">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className={m.color}>{m.icon}</span>
                    <span className="group-hover:text-primary transition-colors">{m.label}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
