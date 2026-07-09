import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { toast } from "sonner";
import PwaLayout from "@/components/pwa/PwaLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar, Clock, MapPin, Check, X, AlertTriangle, Loader2, CalendarX, Upload,
} from "lucide-react";
import LancamentoSimplificadoDialog from "@/components/admin/competition/LancamentoSimplificadoDialog";
import { format, parseISO } from "date-fns";

interface AgendaRow {
  id: string;
  match_id: string;
  role: string;
  acceptance_status: string | null;
  indisponibility_reason: string | null;
  reported_at: string | null;
  match_date: string | null;
  start_time: string | null;
  match_status: string | null;
  sport_name: string | null;
  category_name: string | null;
  venue_name: string | null;
  phase_name: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  arbitro_principal: "Árbitro Principal",
  arbitro_auxiliar: "Auxiliar",
  mesario: "Mesário",
  fiscal: "Fiscal",
  anotador: "Anotador",
};

function formatDateTime(date: string | null, time: string | null) {
  if (!date) return "Data a definir";
  try {
    const d = format(parseISO(date), "dd/MM");
    return time ? `${d} ${time.slice(0, 5)}` : d;
  } catch {
    return date;
  }
}

export default function ArbitragemAgendaPage() {
  const { user } = useAuth();
  const { activeEventId } = useEventContext();
  const qc = useQueryClient();
  usePwaAudit("arbitragem/agenda");

  const [unavailableTarget, setUnavailableTarget] = useState<AgendaRow | null>(null);
  const [reason, setReason] = useState("");
  const [lancamentoTarget, setLancamentoTarget] = useState<AgendaRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pwa-arb-agenda", user?.id, activeEventId],
    enabled: !!user?.id && !!activeEventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("match_user_assignments")
        .select(`
          id, match_id, role, acceptance_status, indisponibility_reason, reported_at,
          competition_matches!inner(
            id, match_date, start_time, status,
            sport_events(sports(name), categories(name)),
            venues(name),
            competition_phases(name)
          )
        `)
        .eq("user_id", user!.id)
        .eq("event_id", activeEventId!);
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        match_id: row.match_id,
        role: row.role,
        acceptance_status: row.acceptance_status,
        indisponibility_reason: row.indisponibility_reason,
        reported_at: row.reported_at,
        match_date: row.competition_matches?.match_date ?? null,
        start_time: row.competition_matches?.start_time ?? null,
        match_status: row.competition_matches?.status ?? null,
        sport_name: row.competition_matches?.sport_events?.sports?.name ?? null,
        category_name: row.competition_matches?.sport_events?.categories?.name ?? null,
        venue_name: row.competition_matches?.venues?.name ?? null,
        phase_name: row.competition_matches?.competition_phases?.name ?? null,
      })) as AgendaRow[];
    },
  });

  // Sincronização em tempo real: convocação/confirmação/indisponibilidade
  // feita em outro dispositivo deve refletir aqui sem refresh manual.
  useRealtimeSync({
    channelName: `pwa-arb-agenda-${user?.id}`,
    tables: [
      { table: "match_user_assignments", filter: `user_id=eq.${user?.id}` },
    ],
    onChange: () => {
      qc.invalidateQueries({ queryKey: ["pwa-arb-agenda", user?.id, activeEventId] });
    },
    enabled: !!user?.id && !!activeEventId,
    debounceMs: 400,
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const grouped = useMemo(() => {
    const sorter = (a: AgendaRow, b: AgendaRow) => {
      const ax = `${a.match_date ?? "z"} ${a.start_time ?? ""}`;
      const bx = `${b.match_date ?? "z"} ${b.start_time ?? ""}`;
      return ax.localeCompare(bx);
    };
    const future = rows
      .filter((r) => !r.match_date || r.match_date >= today)
      .filter((r) => r.acceptance_status !== "unavailable")
      .sort(sorter);
    const past = rows
      .filter((r) => r.match_date && r.match_date < today)
      .filter((r) => r.acceptance_status !== "unavailable")
      .sort((a, b) => -1 * sorter(a, b));
    const unavailable = rows
      .filter((r) => r.acceptance_status === "unavailable")
      .sort((a, b) => -1 * sorter(a, b));
    return { future, past, unavailable };
  }, [rows, today]);

  const confirmMut = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await (supabase as any)
        .from("match_user_assignments")
        .update({
          acceptance_status: "confirmed",
          reported_at: new Date().toISOString(),
        })
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Designação confirmada.");
      qc.invalidateQueries({ queryKey: ["pwa-arb-agenda"] });
      qc.invalidateQueries({ queryKey: ["pwa-arb-home-assignments"] });
    },
    onError: (err: any) => toast.error("Erro ao confirmar: " + err.message),
  });

  const unavailableMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await (supabase as any)
        .from("match_user_assignments")
        .update({
          acceptance_status: "unavailable",
          indisponibility_reason: reason,
          reported_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Indisponibilidade registrada. A coordenação será notificada.");
      qc.invalidateQueries({ queryKey: ["pwa-arb-agenda"] });
      qc.invalidateQueries({ queryKey: ["pwa-arb-home-assignments"] });
      qc.invalidateQueries({ queryKey: ["pwa-arb-indisponibilidades"] });
      setUnavailableTarget(null);
      setReason("");
    },
    onError: (err: any) => toast.error("Erro ao reportar: " + err.message),
  });

  function handleSubmitUnavailable() {
    if (!unavailableTarget) return;
    if (reason.trim().length < 4) {
      toast.error("Descreva o motivo (mín. 4 caracteres).");
      return;
    }
    unavailableMut.mutate({ id: unavailableTarget.id, reason: reason.trim() });
  }

  return (
    <PwaLayout backTo="/pwa/arbitragem" moduleTitle="Minha Agenda">
      <main className="p-4 max-w-md mx-auto space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma designação registrada para você neste evento.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="future">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="future" className="text-xs">
                Próximas ({grouped.future.length})
              </TabsTrigger>
              <TabsTrigger value="past" className="text-xs">
                Passadas ({grouped.past.length})
              </TabsTrigger>
              <TabsTrigger value="unavailable" className="text-xs">
                Indisp. ({grouped.unavailable.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="future" className="space-y-2 mt-3">
              {grouped.future.length === 0 ? (
                <EmptyState text="Nenhuma partida futura na sua agenda." />
              ) : (
                grouped.future.map((r) => (
                  <AgendaCard
                    key={r.id}
                    row={r}
                    onConfirm={() => confirmMut.mutate(r.id)}
                    onReportUnavailable={() => setUnavailableTarget(r)}
                    onLancar={() => setLancamentoTarget(r)}
                    pendingMutation={confirmMut.isPending}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-2 mt-3">
              {grouped.past.length === 0 ? (
                <EmptyState text="Nenhuma partida passada." />
              ) : (
                grouped.past.map((r) => (
                  <AgendaCard key={r.id} row={r} readonly />
                ))
              )}
            </TabsContent>

            <TabsContent value="unavailable" className="space-y-2 mt-3">
              {grouped.unavailable.length === 0 ? (
                <EmptyState text="Sem indisponibilidades reportadas." />
              ) : (
                grouped.unavailable.map((r) => (
                  <AgendaCard key={r.id} row={r} readonly />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      <Dialog
        open={!!unavailableTarget}
        onOpenChange={(open) => {
          if (!open) {
            setUnavailableTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar indisponibilidade</DialogTitle>
            <DialogDescription>
              Descreva o motivo. A coordenação técnica será notificada.
            </DialogDescription>
          </DialogHeader>

          {unavailableTarget && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium">
                {unavailableTarget.sport_name} {unavailableTarget.category_name && `· ${unavailableTarget.category_name}`}
              </p>
              <p className="text-muted-foreground">
                {formatDateTime(unavailableTarget.match_date, unavailableTarget.start_time)}
                {unavailableTarget.venue_name && ` · ${unavailableTarget.venue_name}`}
              </p>
              <p className="text-muted-foreground">
                Função: {ROLE_LABEL[unavailableTarget.role] ?? unavailableTarget.role}
              </p>
            </div>
          )}

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: viagem confirmada com a família, lesão muscular, conflito profissional..."
            className="min-h-[100px]"
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{reason.length}/500</p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnavailableTarget(null);
                setReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmitUnavailable}
              disabled={unavailableMut.isPending}
            >
              {unavailableMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarX className="h-4 w-4 mr-2" />
              )}
              Reportar indisponibilidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LancamentoSimplificadoDialog
        open={!!lancamentoTarget}
        onOpenChange={(o) => { if (!o) setLancamentoTarget(null); }}
        matchId={lancamentoTarget?.match_id ?? null}
        eventId={activeEventId ?? ""}
        matchSummary={
          lancamentoTarget
            ? `${lancamentoTarget.sport_name ?? "Modalidade"}${lancamentoTarget.category_name ? ` · ${lancamentoTarget.category_name}` : ""} · ${formatDateTime(lancamentoTarget.match_date, lancamentoTarget.start_time)}${lancamentoTarget.venue_name ? ` · ${lancamentoTarget.venue_name}` : ""}`
            : undefined
        }
      />
    </PwaLayout>
  );
}

interface AgendaCardProps {
  row: AgendaRow;
  onConfirm?: () => void;
  onReportUnavailable?: () => void;
  onLancar?: () => void;
  pendingMutation?: boolean;
  readonly?: boolean;
}

function AgendaCard({ row, onConfirm, onReportUnavailable, onLancar, pendingMutation, readonly }: AgendaCardProps) {
  const status = row.acceptance_status ?? "pending";
  const statusBadge =
    status === "confirmed"
      ? { label: "Confirmada", tone: "default", icon: Check }
      : status === "unavailable"
      ? { label: "Indisponível", tone: "destructive", icon: X }
      : { label: "Pendente", tone: "outline", icon: AlertTriangle };
  const Icon = statusBadge.icon;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {row.sport_name ?? "Modalidade"}
              {row.category_name && (
                <span className="font-normal text-muted-foreground"> · {row.category_name}</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ROLE_LABEL[row.role] ?? row.role}
              {row.phase_name && ` · ${row.phase_name}`}
            </p>
          </div>
          <Badge variant={statusBadge.tone as any} className="shrink-0 text-[10px]">
            <Icon className="h-3 w-3 mr-1" />
            {statusBadge.label}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateTime(row.match_date, row.start_time)}
          </span>
          {row.venue_name && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              {row.venue_name}
            </span>
          )}
        </div>

        {status === "unavailable" && row.indisponibility_reason && (
          <div className="text-[11px] rounded border border-destructive/30 bg-destructive/5 p-2">
            <span className="font-medium">Motivo:</span> {row.indisponibility_reason}
          </div>
        )}

        {!readonly && status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={onConfirm}
              disabled={pendingMutation}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={onReportUnavailable}
              disabled={pendingMutation}
            >
              <CalendarX className="h-3.5 w-3.5 mr-1.5" />
              Indisp.
            </Button>
          </div>
        )}

        {!readonly && status === "confirmed" && (
          <div className="pt-1 space-y-1.5">
            {onLancar && (
              <Button
                size="sm"
                className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                onClick={onLancar}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Lançamento Rápido
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={onReportUnavailable}
              disabled={pendingMutation}
            >
              <CalendarX className="h-3.5 w-3.5 mr-1.5" />
              Reportar indisponibilidade
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
