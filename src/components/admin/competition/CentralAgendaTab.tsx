import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { format, parse, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  CalendarIcon, CalendarClock, Loader2, AlertTriangle, Clock, MapPin,
  Pencil, CalendarPlus, Trash2, ListChecks, XCircle, RefreshCw, ExternalLink,
} from "lucide-react";

interface Props {
  eventId: string;
  sportEventId: string;
  onChanged?: () => void;
}

interface MatchRow {
  id: string;
  match_number: number | null;
  match_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_address: string | null;
  notes: string | null;
  phase_name: string;
  group_name: string | null;
  round_number: number | null;
  side_a: string;
  side_b: string;
  status: string;
}

interface Venue {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
}

// ─── Schedule Match Dialog ───────────────────────────────────────────────────

function ScheduleMatchDialog({
  match,
  venues,
  eventId,
  onSaved,
  onClose,
}: {
  match: MatchRow;
  venues: Venue[];
  eventId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const isAlreadyScheduled = !!(match.match_date && match.start_time && match.venue_id);

  const [date, setDate] = useState<Date | undefined>(
    match.match_date ? parse(match.match_date, "yyyy-MM-dd", new Date()) : undefined
  );
  const [startTime, setStartTime] = useState(match.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(match.end_time?.slice(0, 5) ?? "");
  const [venueId, setVenueId] = useState(match.venue_id ?? "");
  const [notes, setNotes] = useState(match.notes ?? "");
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!date || !startTime || !venueId) throw new Error("Preencha data, hora e local.");
      if (endTime && endTime <= startTime) throw new Error("Hora de término deve ser posterior à de início.");

      const matchDate = format(date, "yyyy-MM-dd");
      const { error } = await supabase
        .from("competition_matches")
        .update({
          match_date: matchDate,
          start_time: startTime,
          end_time: endTime || null,
          venue_id: venueId,
          notes: notes || null,
        })
        .eq("id", match.id);
      if (error) throw error;

      // Check for conflicts at same venue + date
      const { data: conflicts } = await supabase
        .from("competition_matches")
        .select("id, match_number, start_time, end_time")
        .eq("venue_id", venueId)
        .eq("match_date", matchDate)
        .eq("event_id", eventId)
        .neq("id", match.id);

      if (conflicts && conflicts.length > 0) {
        const effectiveEnd = endTime || addMinutes(startTime, 60);
        const overlapping = conflicts.filter((c: any) => {
          const cStart = c.start_time?.slice(0, 5);
          const cEnd = c.end_time?.slice(0, 5) || addMinutes(cStart, 60);
          return cStart < effectiveEnd && cEnd > startTime;
        });
        if (overlapping.length > 0) {
          setConflictWarning(
            `Atenção: conflito de horário detectado neste local com ${overlapping.length} partida(s)`
          );
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Agendamento salvo" });
      onSaved();
      if (!conflictWarning) onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("competition_matches")
        .update({ match_date: null, start_time: null, end_time: null, venue_id: null })
        .eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Agendamento removido" });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const canSave = !!date && !!startTime && !!venueId;

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAlreadyScheduled ? "Editar agendamento" : "Agendar partida"}
            </DialogTitle>
            <DialogDescription>
              Partida #{match.match_number} — {match.side_a} vs {match.side_b}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => isBefore(d, startOfDay(new Date()))}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start time */}
            <div className="space-y-2">
              <Label>Hora de início *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>

            {/* End time */}
            <div className="space-y-2">
              <Label>Hora de término (opcional)</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>

            {/* Venue */}
            <div className="space-y-2">
              <Label>Local *</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o local" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div>
                        <span>{v.name}</span>
                        {v.address && (
                          <span className="text-xs text-muted-foreground ml-2">— {v.address}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: quadra coberta, ginásio 2..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Conflict warning */}
            {conflictWarning && (
              <Alert className="border-warning/50 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">{conflictWarning}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isAlreadyScheduled && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRemoveConfirm(true)}
                className="mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Remover agendamento
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      {showRemoveConfirm && (
        <AlertDialog open onOpenChange={() => setShowRemoveConfirm(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover agendamento?</AlertDialogTitle>
              <AlertDialogDescription>
                A data, hora e local da partida #{match.match_number} serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeMut.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

// ─── Batch Schedule Dialog ───────────────────────────────────────────────────

function BatchScheduleDialog({
  unscheduledMatches,
  venues,
  eventId,
  onSaved,
  onClose,
}: {
  unscheduledMatches: MatchRow[];
  venues: Venue[];
  eventId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("08:00");
  const [interval, setInterval] = useState(60);
  const [venueId, setVenueId] = useState("");

  const preview = useMemo(() => {
    if (!startTime) return [];
    return unscheduledMatches.map((m, i) => {
      const totalMinutes = parseTimeToMinutes(startTime) + i * interval;
      const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const mm = String(totalMinutes % 60).padStart(2, "0");
      return { ...m, scheduledTime: `${hh}:${mm}` };
    });
  }, [unscheduledMatches, startTime, interval]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!date || !startTime || !venueId) throw new Error("Preencha todos os campos.");
      const matchDate = format(date, "yyyy-MM-dd");

      for (const item of preview) {
        const { error } = await supabase
          .from("competition_matches")
          .update({
            match_date: matchDate,
            start_time: item.scheduledTime,
            venue_id: venueId,
          })
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Agendamento em lote concluído", description: `${preview.length} partidas agendadas.` });
      onSaved();
      onClose();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const canSave = !!date && !!startTime && !!venueId && preview.length > 0;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agendar em lote</DialogTitle>
          <DialogDescription>
            Definir data, local e horários sequenciais para {unscheduledMatches.length} partida(s) não agendada(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => isBefore(d, startOfDay(new Date()))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label>Local *</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.address ? ` — ${v.address}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start time */}
            <div className="space-y-2">
              <Label>Hora da primeira partida *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>

            {/* Interval */}
            <div className="space-y-2">
              <Label>Intervalo (min)</Label>
              <Input
                type="number"
                min={10}
                max={240}
                value={interval}
                onChange={(e) => setInterval(Math.max(10, parseInt(e.target.value) || 60))}
              />
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="rounded-md border divide-y max-h-[200px] overflow-y-auto">
                {preview.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span>Partida #{p.match_number} — {p.side_a} vs {p.side_b}</span>
                    <Badge variant="outline">{p.scheduledTime}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Confirmar agendamento em lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMinutes(time: string, mins: number): string {
  const total = parseTimeToMinutes(time) + mins;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(parse(dateStr, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
}

function formatTime(time: string | null): string {
  if (!time) return "";
  return time.slice(0, 5);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CentralAgendaTab({ eventId, sportEventId, onChanged }: Props) {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("coordenacao_tecnica");

  const [editMatch, setEditMatch] = useState<MatchRow | null>(null);
  const [showBatch, setShowBatch] = useState(false);

  // Fetch venues
  const { data: venues = [] } = useQuery({
    queryKey: ["venues-for-scheduling", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address, city")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Venue[];
    },
  });

  // Fetch matches with entries and venue
  const { data: matches = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["agenda-matches", eventId, sportEventId],
    queryFn: async () => {
      // Fetch matches
      const { data: rawMatches, error: mErr } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, end_time, venue_id, notes, status, round_number,
          phase_id, group_id,
          competition_phases(name),
          competition_groups(name),
          venues(name, address)
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_number");
      if (mErr) throw mErr;

      // Fetch entries for all matches
      const matchIds = (rawMatches ?? []).map((m: any) => m.id);
      if (matchIds.length === 0) return [];

      const { data: entries, error: eErr } = await supabase
        .from("competition_match_entries")
        .select(`
          id, match_id, side, team_id,
          participant_sport_event_id,
          teams(name),
          participant_sport_events(participants(people(full_name)))
        `)
        .in("match_id", matchIds);
      if (eErr) throw eErr;

      // Group entries by match
      const entryMap = new Map<string, any[]>();
      for (const e of entries ?? []) {
        const list = entryMap.get(e.match_id) ?? [];
        list.push(e);
        entryMap.set(e.match_id, list);
      }

      return (rawMatches ?? []).map((m: any): MatchRow => {
        const matchEntries = entryMap.get(m.id) ?? [];
        const sideA = matchEntries.find((e: any) => e.side === "home" || e.side === "participant");
        const sideB = matchEntries.find((e: any) => e.side === "away" || (e.side !== "home" && e.side !== "participant" && e !== sideA));

        const getName = (entry: any): string => {
          if (!entry) return "A definir";
          if (entry.teams?.name) return entry.teams.name;
          const pName = (entry.participant_sport_events as any)?.participants?.people?.full_name;
          return pName ?? "A definir";
        };

        return {
          id: m.id,
          match_number: m.match_number,
          match_date: m.match_date,
          start_time: m.start_time,
          end_time: m.end_time,
          venue_id: m.venue_id,
          venue_name: (m.venues as any)?.name ?? null,
          venue_address: (m.venues as any)?.address ?? null,
          notes: m.notes,
          phase_name: (m.competition_phases as any)?.name ?? "—",
          group_name: (m.competition_groups as any)?.name ?? null,
          round_number: m.round_number,
          side_a: getName(sideA),
          side_b: getName(sideB),
          status: m.status,
        };
      });
    },
  });

  // Conflict detection
  const { data: conflicts } = useQuery({
    queryKey: ["schedule-conflicts", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_detect_schedule_conflicts", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: matches.some((m) => m.match_date != null),
  });

  const totalConflicts = (conflicts?.venue_conflicts?.length ?? 0) +
    (conflicts?.team_conflicts?.length ?? 0) +
    (conflicts?.participant_conflicts?.length ?? 0);

  // Counts
  const scheduled = matches.filter((m) => m.match_date && m.start_time && m.venue_id);
  const unscheduled = matches.filter((m) => !m.match_date || !m.start_time || !m.venue_id);
  const allScheduled = matches.length > 0 && unscheduled.length === 0;
  const noneScheduled = matches.length > 0 && scheduled.length === 0;

  const handleSaved = useCallback(() => {
    refetch();
    qc.invalidateQueries({ queryKey: ["schedule-conflicts", eventId, sportEventId] });
    onChanged?.();
  }, [refetch, qc, eventId, sportEventId, onChanged]);

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // Error
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Erro ao carregar partidas</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
        </Button>
      </div>
    );
  }

  // No matches
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Nenhuma partida encontrada. Volte ao Passo 3 e gere as partidas primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Agenda</h3>
          {allScheduled && <Badge variant="success">Todas agendadas ✅</Badge>}
          {!allScheduled && matches.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {scheduled.length} de {matches.length} partidas agendadas
            </span>
          )}
          {totalConflicts > 0 && (
            <Badge variant="destructive">{totalConflicts} conflito(s)</Badge>
          )}
        </div>
        {canEdit && unscheduled.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setShowBatch(true)}>
            <ListChecks className="h-4 w-4 mr-1" />
            Agendar em lote ({unscheduled.length})
          </Button>
        )}
      </div>

      {/* Callout: none scheduled */}
      {noneScheduled && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            Nenhuma partida foi agendada ainda. Clique em "Agendar" para definir data e local.
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead>Fase / Grupo</TableHead>
                <TableHead>Confronto</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Local</TableHead>
                {canEdit && <TableHead className="w-[100px]">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => {
                const isScheduled = !!(m.match_date && m.start_time && m.venue_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.match_number ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {m.phase_name}
                      {m.group_name && <span className="text-muted-foreground"> · {m.group_name}</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {m.side_a} <span className="text-muted-foreground mx-1">vs</span> {m.side_b}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.match_date ? (
                        formatDateBR(m.match_date)
                      ) : (
                        <span className="text-destructive text-xs">Não agendada</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.start_time ? formatTime(m.start_time) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.venue_name ?? "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant={isScheduled ? "ghost" : "secondary"}
                          onClick={() => setEditMatch(m)}
                        >
                          {isScheduled ? (
                            <><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</>
                          ) : (
                            <><CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendar</>
                          )}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conflict summary */}
      {totalConflicts > 0 && (
        <Card className="border-warning/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Conflitos detectados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(conflicts?.venue_conflicts ?? []).map((c: any, i: number) => (
              <div key={`v${i}`} className="flex items-start gap-2 p-2 border rounded-md">
                <MapPin className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{c.venue_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.match_date} às {c.start_time} — Partidas: {c.matches?.map((m: any) => `#${m.match_number}`).join(", ")}
                  </p>
                </div>
              </div>
            ))}
            {(conflicts?.team_conflicts ?? []).map((c: any, i: number) => (
              <div key={`t${i}`} className="flex items-start gap-2 p-2 border rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{c.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.match_date} às {c.start_time} — Partidas: {c.matches?.map((m: any) => `#${m.match_number}`).join(", ")}
                  </p>
                </div>
              </div>
            ))}
            {(conflicts?.participant_conflicts ?? []).map((c: any, i: number) => (
              <div key={`p${i}`} className="flex items-start gap-2 p-2 border rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.match_date} às {c.start_time} — Partidas: {c.matches?.map((m: any) => `#${m.match_number}`).join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Schedule dialog */}
      {editMatch && (
        <ScheduleMatchDialog
          match={editMatch}
          venues={venues}
          eventId={eventId}
          onSaved={handleSaved}
          onClose={() => setEditMatch(null)}
        />
      )}

      {/* Batch dialog */}
      {showBatch && (
        <BatchScheduleDialog
          unscheduledMatches={unscheduled}
          venues={venues}
          eventId={eventId}
          onSaved={handleSaved}
          onClose={() => setShowBatch(false)}
        />
      )}
    </div>
  );
}
