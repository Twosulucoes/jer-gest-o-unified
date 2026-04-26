import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESULT_STATUS } from "@/lib/resultStatus";

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

export default function ProvaReadinessChecklist({ eventId, sportEventId, stageId, onJumpTo }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["prova-readiness", eventId, sportEventId, stageId],
    enabled: !!eventId && !!sportEventId,
    queryFn: async () => {
      // Inscritos
      const { count: enrolled } = await supabase
        .from("participant_sport_events")
        .select("id", { count: "exact", head: true })
        .eq("sport_event_id", sportEventId);

      // Partidas
      let qMatches = supabase
        .from("competition_matches")
        .select("id, status, match_date, start_time, venue_id, event_stage_id", { count: "exact" })
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId);
      if (stageId) qMatches = qMatches.eq("event_stage_id", stageId);
      const { data: matches = [], count: matchesCount } = await qMatches;

      const matchIds = (matches ?? []).map((m: any) => m.id);
      const scheduled = (matches ?? []).filter((m: any) => m.match_date && m.start_time && m.venue_id).length;
      const finished = (matches ?? []).filter((m: any) => m.status === "finished").length;

      // Árbitros
      let officialsCount = 0;
      if (matchIds.length > 0) {
        const { count } = await supabase
          .from("match_user_assignments")
          .select("id", { count: "exact", head: true })
          .in("match_id", matchIds);
        officialsCount = count ?? 0;
      }

      // Resultados publicados
      let publishedCount = 0;
      if (matchIds.length > 0) {
        const { count } = await supabase
          .from("competition_match_results")
          .select("id", { count: "exact", head: true })
          .in("match_id", matchIds)
          .eq("result_status", RESULT_STATUS.PUBLISHED);
        publishedCount = count ?? 0;
      }

      return {
        enrolled: enrolled ?? 0,
        matchesCount: matchesCount ?? 0,
        scheduled,
        finished,
        officialsCount,
        publishedCount,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <Card><CardContent className="pt-4 text-xs text-muted-foreground">Carregando checklist...</CardContent></Card>
    );
  }

  const { enrolled, matchesCount, scheduled, finished, officialsCount, publishedCount } = data;

  const items: ChecklistItem[] = [
    {
      key: "participants",
      label: "Inscritos",
      state: enrolled > 0 ? "ok" : "missing",
      hint: enrolled > 0 ? `${enrolled} confirmados` : "Sem inscritos",
      goTo: "participants",
    },
    {
      key: "builder",
      label: "Disputas montadas",
      state: matchesCount > 0 ? "ok" : "missing",
      hint: matchesCount > 0 ? `${matchesCount} partida(s)` : "Sem partidas",
      goTo: "builder",
    },
    {
      key: "agenda",
      label: "Agenda completa",
      state: matchesCount === 0 ? "missing" : scheduled === matchesCount ? "ok" : "warn",
      hint: matchesCount === 0 ? "—" : `${scheduled}/${matchesCount} com data, hora e local`,
      goTo: "agenda",
    },
    {
      key: "arbitragem",
      label: "Arbitragem escalada",
      state: matchesCount === 0 ? "missing" : officialsCount > 0 ? "ok" : "warn",
      hint: matchesCount === 0 ? "—" : `${officialsCount} designação(ões)`,
      goTo: "arbitragem",
    },
    {
      key: "results",
      label: "Resultados lançados",
      state: matchesCount === 0 ? "missing" : finished === matchesCount ? "ok" : "warn",
      hint: matchesCount === 0 ? "—" : `${finished}/${matchesCount} finalizadas`,
      goTo: "results",
    },
    {
      key: "publish",
      label: "Publicado no portal",
      state: finished === 0 ? "missing" : publishedCount > 0 ? "ok" : "warn",
      hint: publishedCount > 0 ? `${publishedCount} publicado(s)` : "Aguardando publicação",
      goTo: "publish",
    },
  ];

  const allOk = items.every((i) => i.state === "ok");

  return (
    <Card className={cn(allOk && "border-success/40 bg-success/5")}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Prontidão da Prova</h4>
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
