import { useState, useMemo, useCallback, useEffect } from "react";
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
  Filter, Check, X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  phase_id: string;
  group_name: string | null;
  group_id: string | null;
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

// ─── Inline Quick Editor ────────────────────────────────────────────────────

function InlineScheduleEditor({
  match,
  venues,
  eventId,
  onSaved,
  onCancel,
}: {
  match: MatchRow;
  venues: Venue[];
  eventId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(match.match_date ?? "");
  const [startTime, setStartTime] = useState(match.start_time?.slice(0, 5) ?? "");
  const [venueId, setVenueId] = useState(match.venue_id ?? "");

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("competition_matches")
        .update({
          match_date: date || null,
          start_time: startTime || null,
          venue_id: venueId || null,
        })
        .eq("id", match.id);
      if (error) throw error;

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: match.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "schedule_inline_edit",
        payload: { match_date: date, start_time: startTime, venue_id: venueId },
      });
    },
    onSuccess: () => {
      toast({ title: "Agendamento salvo" });
      onSaved();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <TableCell className="p-1">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs w-[130px]" />
      </TableCell>
      <TableCell className="p-1">
        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-xs w-[90px]" />
      </TableCell>
      <TableCell className="p-1">
        <Select value={venueId || "__none__"} onValueChange={(v) => setVenueId(v === "__none__" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="Local" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1">
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </>
  );
}

// ─── Schedule Match Dialog (full) ───────────────────────────────────────────

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

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: match.id,
        action: "schedule_edit",
        payload: { match_date: matchDate, start_time: startTime, venue_id: venueId },
      });

      // Check for conflicts
      const { data: conflicts } = await supabase
        .from("competition_matches")
        .select("id, match_number, start_time, end_time")
        .eq("venue_id", venueId)
        .eq("match_date", matchDate)
        .eq("event_id", eventId)
        .neq("id", match.id);

      if (conflicts && conflicts.length > 0) {
        const parseTimeToMinutes = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        const addMinutes = (time: string, mins: number): string => {
          const total = parseTimeToMinutes(time) + mins;
          const hh = String(Math.floor(total / 60)).padStart(2, "0");
          const mm = String(total % 60).padStart(2, "0");
          return `${hh}:${mm}`;
        };

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

      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: match.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "schedule_remove",
        payload: {},
      });
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

            <div className="space-y-2">
              <Label>Hora de início *</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Hora de término (opcional)</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>

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

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Ex: quadra coberta, ginásio 2..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

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
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [interval, setInterval] = useState(60);
  const [venueId, setVenueId] = useState("");

  const parseTimeToMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

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

      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: eventId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "schedule_batch",
        payload: { count: preview.length, match_date: matchDate, venue_id: venueId },
      });
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
            Definir data, local e horários sequenciais para {unscheduledMatches.length} partida(s).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Data das Partidas</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal h-10", !date && "text-muted-foreground")}
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
                  className="p-3"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Local Único</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Início (1ª Partida)</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Intervalo (minutos)</Label>
            <Input type="number" value={interval} onChange={(e) => setInterval(Number(e.target.value))} className="h-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-[200px] border rounded-md p-2 bg-muted/20">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-3 px-1">Prévia da Sequência</p>
          <div className="space-y-2">
            {preview.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-card border text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    #{p.match_number || (i+1)}
                  </span>
                  <span className="font-medium truncate max-w-[180px]">{p.side_a} vs {p.side_b}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-primary font-bold">
                  <Clock className="h-3 w-3" />
                  {p.scheduledTime}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose} className="h-10">Cancelar</Button>
          <Button 
            onClick={() => saveMut.mutate()} 
            disabled={!canSave || saveMut.isPending}
            className="h-10 px-8"
          >
            {saveMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarPlus className="h-4 w-4 mr-2" />}
            Confirmar Agendamento de {preview.length} Partidas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
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
  const canEdit = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("coordenador_modalidade");

  const [editMatch, setEditMatch] = useState<MatchRow | null>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());

  // Filters
  const [filterPhase, setFilterPhase] = useState<string>("__all__");
  const [filterGroup, setFilterGroup] = useState<string>("__all__");
  const [filterSchedule, setFilterSchedule] = useState<string>("__all__");
  const [filterStatus, setFilterStatus] = useState<string>("__all__");

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

      const entryMap = new Map<string, any[]>();
      for (const e of entries ?? []) {
        const list = entryMap.get(e.match_id) ?? [];
        list.push(e);
        entryMap.set(e.match_id, list);
      }

      return (rawMatches ?? []).map((m: any): MatchRow => {
        const mEntries = entryMap.get(m.id) ?? [];
        const sideA = mEntries.find(e => e.side === 'A');
        const sideB = mEntries.find(e => e.side === 'B');

        const labelA = sideA?.teams?.name || sideA?.participant_sport_events?.participants?.people?.full_name || "A definir";
        const labelB = sideB?.teams?.name || sideB?.participant_sport_events?.participants?.people?.full_name || "A definir";

        return {
          id: m.id,
          match_number: m.match_number,
          match_date: m.match_date,
          start_time: m.start_time,
          end_time: m.end_time,
          venue_id: m.venue_id,
          venue_name: m.venues?.name ?? null,
          venue_address: m.venues?.address ?? null,
          notes: m.notes,
          phase_id: m.phase_id,
          phase_name: m.competition_phases?.name ?? "—",
          group_id: m.group_id,
          group_name: m.competition_groups?.name ?? null,
          round_number: m.round_number,
          side_a: labelA,
          side_b: labelB,
          status: m.status,
        };
      });
    },
  });

  const { data: conflictsRaw } = useQuery({
    queryKey: ["agenda-conflicts", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_detect_schedule_conflicts", { p_event_id: eventId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!eventId,
  });

  const conflicts = conflictsRaw as any;
  const totalConflicts = (conflicts?.venue_conflicts?.length || 0) + (conflicts?.team_conflicts?.length || 0) + (conflicts?.participant_conflicts?.length || 0);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filterPhase !== "__all__" && m.phase_id !== filterPhase) return false;
      if (filterGroup !== "__all__" && m.group_id !== filterGroup) return false;
      if (filterSchedule === "scheduled" && !m.match_date) return false;
      if (filterSchedule === "unscheduled" && m.match_date) return false;
      if (filterStatus !== "__all__" && m.status !== filterStatus) return false;
      return true;
    });
  }, [matches, filterPhase, filterGroup, filterSchedule, filterStatus]);

  const scheduled = matches.filter(m => m.match_date);
  const unscheduled = matches.filter(m => !m.match_date);
  const allScheduled = unscheduled.length === 0;
  const noneScheduled = scheduled.length === 0;

  const phaseOptions = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach(m => map.set(m.phase_id, m.phase_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  const groupOptions = useMemo(() => {
    const map = new Map<string, string>();
    matches.forEach(m => {
      if (m.group_id && m.group_name) map.set(m.group_id, m.group_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  const hasActiveFilters = filterPhase !== "__all__" || filterGroup !== "__all__" || filterSchedule !== "__all__" || filterStatus !== "__all__";
  const clearFilters = () => {
    setFilterPhase("__all__");
    setFilterGroup("__all__");
    setFilterSchedule("__all__");
    setFilterStatus("__all__");
  };

  const handleSaved = () => {
    refetch();
    if (onChanged) onChanged();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedMatches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMatches(next);
  };

  const selectAll = () => {
    if (selectedMatches.size === filteredMatches.length && filteredMatches.length > 0) setSelectedMatches(new Set());
    else setSelectedMatches(new Set(filteredMatches.map(m => m.id)));
  };

  const selectedList = useMemo(() => 
    matches.filter(m => selectedMatches.has(m.id)),
  [matches, selectedMatches]);

  const canBatch = selectedMatches.size > 0;
  const unscheduledVisible = useMemo(() => filteredMatches.filter(m => !m.match_date), [filteredMatches]);

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

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CalendarClock className="h-10 w-10 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Nenhuma partida encontrada. Volte ao passo anterior e gere as partidas/baterias primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Smart Batch Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border-2 border-dashed border-primary/20">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Agendamento Inteligente</p>
            <p className="text-[11px] text-muted-foreground">Agende rapidamente as partidas pendentes ou selecionadas.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {unscheduledVisible.length > 0 && !canBatch && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSelectedMatches(new Set(unscheduledVisible.map(m => m.id)));
                setShowBatch(true);
              }}
              className="flex-1 sm:flex-none text-xs border-primary/30 text-primary hover:bg-primary/5"
            >
              <CalendarClock className="h-3.5 w-3.5 mr-2" />
              Agendar Pendentes ({unscheduledVisible.length})
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={selectAll}
            className="flex-1 sm:flex-none text-xs hover:bg-muted"
          >
            {selectedMatches.size === filteredMatches.length && filteredMatches.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            disabled={!canBatch}
            onClick={() => setShowBatch(true)}
            className="flex-1 sm:flex-none text-xs bg-primary hover:bg-primary/90 shadow-sm px-4"
          >
            <CalendarPlus className="h-3.5 w-3.5 mr-2" />
            Agendar ({selectedMatches.size})
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {allScheduled && <Badge variant="default" className="bg-green-600">Todas agendadas ✅</Badge>}
          {!allScheduled && matches.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {scheduled.length}/{matches.length} agendadas
            </span>
          )}
          {unscheduled.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unscheduled.length} pendentes
            </Badge>
          )}
          {totalConflicts > 0 && (
            <Badge variant="destructive">{totalConflicts} conflito(s)</Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as fases</SelectItem>
                {phaseOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {groupOptions.length > 0 && (
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os grupos</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filterSchedule} onValueChange={setFilterSchedule}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Agendamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="scheduled">Agendadas</SelectItem>
                <SelectItem value="unscheduled">Sem agendamento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos status</SelectItem>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="finished">Finalizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-auto">
              {filteredMatches.length} de {matches.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Callout: none scheduled */}
      {noneScheduled && (
        <Alert className="border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-sm">
            Nenhuma partida foi agendada ainda. Clique em "Agendar" ou use a edição rápida na linha.
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45px] px-3 text-center">
                    <input 
                      type="checkbox" 
                      checked={filteredMatches.length > 0 && selectedMatches.size === filteredMatches.length}
                      onChange={selectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[50px] text-[11px] font-bold uppercase tracking-wider">#</TableHead>
                  <TableHead>Fase / Grupo</TableHead>
                  <TableHead>Confronto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Local</TableHead>
                  {canEdit && <TableHead className="w-[120px]">Ação</TableHead>}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8} className="text-center text-muted-foreground py-8">
                      Nenhum resultado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMatches.map((m) => {
                    const isScheduled = !!(m.match_date && m.start_time && m.venue_id);
                    const isInlineEdit = inlineEditId === m.id;
                    const isSelected = selectedMatches.has(m.id);

                    return (
                      <TableRow 
                        key={m.id} 
                        className={cn(
                          "transition-colors group",
                          !isScheduled && "bg-destructive/5",
                          isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                        )}
                      >
                        <TableCell className="px-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleSelect(m.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.match_number ?? "—"}</TableCell>
                        <TableCell className="text-[11px]">
                          <p className="font-bold text-foreground">{m.phase_name}</p>
                          {m.group_name && <p className="text-muted-foreground leading-tight">{m.group_name}</p>}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[140px]">{m.side_a}</span>
                            <span className="text-[10px] text-muted-foreground font-black opacity-30">VS</span>
                            <span className="truncate max-w-[140px]">{m.side_b}</span>
                          </div>
                        </TableCell>

                        {isInlineEdit ? (
                          <InlineScheduleEditor
                            match={m}
                            venues={venues}
                            eventId={eventId}
                            onSaved={handleSaved}
                            onCancel={() => setInlineEditId(null)}
                          />
                        ) : (
                          <>
                            <TableCell className="text-sm">
                              {m.match_date ? (
                                formatDateBR(m.match_date)
                              ) : (
                                <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                                  <Clock className="h-3 w-3 mr-0.5" /> Sem data
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {m.start_time ? formatTime(m.start_time) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {m.venue_name ? (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {m.venue_name}
                                </span>
                              ) : (
                                <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">
                                  <MapPin className="h-3 w-3 mr-0.5" /> Sem local
                                </Badge>
                              )}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => setInlineEditId(m.id)}
                                    title="Edição rápida"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={isScheduled ? "ghost" : "secondary"}
                                    className="h-7 text-xs"
                                    onClick={() => setEditMatch(m)}
                                  >
                                    {isScheduled ? "Editar" : (
                                      <><CalendarPlus className="h-3 w-3 mr-1" /> Agendar</>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/admin/competicao/partida/${m.id}`)}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
          unscheduledMatches={selectedList}
          venues={venues}
          eventId={eventId}
          onSaved={() => {
            handleSaved();
            setSelectedMatches(new Set());
          }}
          onClose={() => setShowBatch(false)}
        />
      )}
    </div>
  );
}
