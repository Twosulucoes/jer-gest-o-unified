import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Swords } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CompetitionMatchFormDialog, { type MatchFormValues } from "@/components/admin/CompetitionMatchFormDialog";

export default function CompeticaoPartidasPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedSportEventId, setSelectedSportEventId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport_events", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("sport_events").select("*").eq("event_id", selectedEventId).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["competition_phases", selectedEventId, selectedSportEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("competition_phases").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (selectedSportEventId) q = q.eq("sport_event_id", selectedSportEventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["competition_groups", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_groups").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("venues").select("*").eq("event_id", selectedEventId).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: matches, isLoading } = useQuery({
    queryKey: ["competition_matches", selectedEventId, selectedSportEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const phaseIds = phases.map((p) => p.id);
      if (!phaseIds.length) return [];
      const { data, error } = await supabase.from("competition_matches").select("*").in("phase_id", phaseIds).order("match_date").order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId && phases.length > 0,
  });

  const phasesMap = new Map(phases.map((p) => [p.id, p]));
  const groupsMap = new Map(groups.map((g) => [g.id, g]));
  const venuesMap = new Map(venues.map((v) => [v.id, v]));

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada" };
    return m[s] || s;
  };
  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" =>
    s === "in_progress" ? "default" : s === "finished" ? "secondary" : s === "cancelled" ? "destructive" : "outline";

  const formatDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const createMut = useMutation({
    mutationFn: async (v: MatchFormValues) => {
      const { error } = await supabase.from("competition_matches").insert({
        event_id: selectedEventId,
        phase_id: v.phase_id,
        group_id: v.group_id || null,
        match_number: v.match_number || null,
        match_date: v.match_date || null,
        start_time: v.start_time || null,
        venue_id: v.venue_id || null,
        status: v.status,
        notes: v.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Partida criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MatchFormValues & { id: string }) => {
      const { error } = await supabase.from("competition_matches").update({
        phase_id: v.phase_id,
        group_id: v.group_id || null,
        match_number: v.match_number || null,
        match_date: v.match_date || null,
        start_time: v.start_time || null,
        venue_id: v.venue_id || null,
        status: v.status,
        notes: v.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Partida atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: MatchFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Partidas / Provas</h1>
          <p className="text-sm text-muted-foreground mt-1">Agenda operacional da competição</p>
        </div>
        {canWrite && selectedEventId && phases.length > 0 && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Nova partida
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedEventId(v); setSelectedSportEventId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prova (filtro)</label>
              <Select value={selectedSportEventId || "__all__"} onValueChange={(v) => setSelectedSportEventId(v === "__all__" ? "" : v)} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {sportEvents.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Swords className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !matches?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Swords className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma partida cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre fases antes de criar partidas.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.match_number ?? "—"}</TableCell>
                  <TableCell className="font-medium">{phasesMap.get(m.phase_id)?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.group_id ? groupsMap.get(m.group_id)?.name ?? "—" : "—"}</TableCell>
                  <TableCell>{formatDate(m.match_date)}</TableCell>
                  <TableCell className="font-mono text-xs">{m.start_time?.slice(0, 5) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.venue_id ? venuesMap.get(m.venue_id)?.name ?? "—" : "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(m); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompetitionMatchFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        match={editing}
        phases={phases}
        groups={groups}
        venues={venues}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
