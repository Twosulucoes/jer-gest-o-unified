import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layers, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
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

const KIND_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  classificatoria: "secondary",
  regional: "outline",
  final: "default",
  geral: "outline",
};

export default function EtapasIndexPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const location = useLocation();
  const fromPath = location.state?.from as string | undefined;

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["event_stages", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventStage[];
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Etapas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma etapa para acessar todos os módulos operacionais filtrados por ela.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/eventos/etapas">
            <Plus className="mr-2 h-4 w-4" /> Gerenciar etapas
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : stages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma etapa ativa cadastrada. Acesse <Link to="/admin/eventos/etapas" className="text-primary underline">Gerenciar etapas</Link> para criar.
          </CardContent>
        </Card>
      ) : (
        (() => {
          const classificatorias = stages.filter((s) => s.kind === "classificatoria");
          const finais = stages.filter((s) => ["regional", "semifinal", "final"].includes(s.kind));
          const outras = stages.filter(
            (s) => !["classificatoria", "regional", "semifinal", "final"].includes(s.kind),
          );

          const renderCard = (stage: EventStage) => (
            <Link key={stage.id} to={`/admin/etapa/${stage.id}`} className="group">
              <Card className="h-full hover:border-primary hover:shadow-app-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                      {stage.name}
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={KIND_VARIANTS[stage.kind] ?? "outline"} className="text-xs">
                      {KIND_LABELS[stage.kind] ?? stage.kind}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">#{stage.sort_order}</span>
                  </div>
                  {(stage.starts_at || stage.ends_at) && (
                    <p className="text-xs text-muted-foreground">
                      {stage.starts_at ?? "—"} → {stage.ends_at ?? "—"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );

          const Section = ({
            title,
            description,
            accent,
            items,
          }: {
            title: string;
            description: string;
            accent: string;
            items: EventStage[];
          }) => (
            <section className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`h-8 w-1.5 rounded-full ${accent}`} />
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {title}
                    <Badge variant="outline" className="text-xs">{items.length}</Badge>
                  </h2>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
              {items.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center text-xs text-muted-foreground">
                    Nenhuma etapa nesta categoria.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(renderCard)}
                </div>
              )}
            </section>
          );

          return (
            <div className="space-y-8">
              <Section
                title="Fase Classificatória"
                description="Etapas iniciais e seletivas que definem os classificados para as fases seguintes."
                accent="bg-secondary"
                items={classificatorias}
              />
              <Section
                title="Fases Finais"
                description="Regionais, semifinais e finais — etapas decisivas da competição."
                accent="bg-primary"
                items={finais}
              />
              {outras.length > 0 && (
                <Section
                  title="Outras Etapas"
                  description="Etapas gerais ou de propósito específico."
                  accent="bg-muted-foreground"
                  items={outras}
                />
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
