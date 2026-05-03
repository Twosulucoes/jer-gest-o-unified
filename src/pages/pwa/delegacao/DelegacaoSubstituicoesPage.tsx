import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowLeftRight, Clock, Check, X, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import RequestSubstitutionDialog from "@/components/admin/competition/RequestSubstitutionDialog";

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  requested: { label: "Solicitada", tone: "outline", icon: Clock },
  approved: { label: "Aprovada", tone: "default", icon: Check },
  rejected: { label: "Rejeitada", tone: "destructive", icon: X },
  executed: { label: "Executada", tone: "secondary", icon: PlayCircle },
  cancelled: { label: "Cancelada", tone: "destructive", icon: X },
};

const REASON_LABEL: Record<string, string> = {
  lesao: "Lesão",
  desistencia: "Desistência",
  disciplinar: "Disciplinar",
  convocacao: "Convocação externa",
  outro: "Outro",
};

export default function DelegacaoSubstituicoesPage() {
  const { activeEventId } = useEventContext();
  const stageId = useActiveStageId();
  usePwaAudit("delegacao/substituicoes");

  const [delegationId, setDelegationId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setDelegationId(data?.delegation_id ?? null);
    })();
  }, []);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["pwa_delegacao_substitutions", delegationId, activeEventId, stageId],
    enabled: !!delegationId && !!activeEventId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("substitutions")
        .select(`
          id, status, reason, reason_code, requested_at, approved_at, executed_at, rejected_at, rejection_notes,
          sport_events(id, name, sports(name), categories(name)),
          out_part:participants!substitutions_participant_out_id_fkey(id, people(full_name)),
          in_part:participants!substitutions_participant_in_id_fkey(id, people(full_name))
        `)
        .eq("event_id", activeEventId)
        .eq("delegation_id", delegationId)
        .order("requested_at", { ascending: false });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <PwaLayout backTo="/pwa/delegacao" moduleTitle="Substituições">
      <main className="p-4 max-w-md mx-auto space-y-4">
        {!delegationId && (
          <Card className="border-amber/40">
            <CardContent className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma delegação vinculada ao seu perfil.
            </CardContent>
          </Card>
        )}

        {delegationId && (
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={() => setDialogOpen(true)}
            disabled={!stageId}
          >
            <Plus className="h-5 w-5 mr-1.5" /> Solicitar substituição
          </Button>
        )}

        {!stageId && delegationId && (
          <p className="text-center text-xs text-amber-600 dark:text-amber-400">
            Selecione uma etapa para solicitar.
          </p>
        )}

        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma substituição registrada para sua delegação.
            </CardContent>
          </Card>
        ) : (
          rows.map((r) => {
            const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "outline" as const, icon: Clock };
            const StatusIcon = status.icon;
            const reasonLabel = r.reason_code ? REASON_LABEL[r.reason_code] ?? r.reason_code : "—";
            return (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {r.sport_events?.name ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.sport_events?.sports?.name} · {r.sport_events?.categories?.name}
                      </p>
                    </div>
                    <Badge variant={status.tone} className="shrink-0 text-[10px]">
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-amber-700 dark:text-amber-300 truncate flex-1">
                      Sai: {r.out_part?.people?.full_name ?? "—"}
                    </span>
                    <ArrowLeftRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-emerald-700 dark:text-emerald-300 truncate flex-1">
                      Entra: {r.in_part?.people?.full_name ?? "—"}
                    </span>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/50">
                    <p><span className="font-medium text-foreground/70">Motivo:</span> {reasonLabel}</p>
                    {r.reason && <p className="line-clamp-2 text-[10px]">{r.reason}</p>}
                    {r.rejection_notes && (
                      <p className="text-[10px] text-destructive">
                        <span className="font-medium">Rejeição:</span> {r.rejection_notes}
                      </p>
                    )}
                    <p>
                      Solicitada {format(new Date(r.requested_at), "dd/MM HH:mm")}
                      {r.executed_at && ` · executada ${format(new Date(r.executed_at), "dd/MM HH:mm")}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        <RequestSubstitutionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          eventId={activeEventId}
          stageId={stageId}
          onSuccess={() => refetch()}
        />
      </main>
    </PwaLayout>
  );
}
