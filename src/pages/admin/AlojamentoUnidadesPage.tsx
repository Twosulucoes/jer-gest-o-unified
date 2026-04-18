import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LodgingUnitFormDialog, { type LodgingUnitFormValues } from "@/components/admin/LodgingUnitFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";

export default function AlojamentoUnidadesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const selectedEventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["lodging_locations", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("lodging_locations").select("*").eq("event_id", selectedEventId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: units, isLoading } = useQuery({
    queryKey: ["lodging_units", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("lodging_units").select("*").eq("event_id", selectedEventId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Count active occupancies per unit
  const { data: occupancyCounts = [] } = useQuery({
    queryKey: ["lodging_occupancy_counts", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("lodging_occupancies")
        .select("unit_id")
        .eq("event_id", selectedEventId)
        .in("status", ["allocated", "checked_in"]);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const occCountMap = new Map<string, number>();
  occupancyCounts.forEach((o) => {
    occCountMap.set(o.unit_id, (occCountMap.get(o.unit_id) || 0) + 1);
  });

  const locationsMap = new Map(locations.map((l) => [l.id, l]));

  const genderLabel = (g: string) => g === "male" ? "Masculino" : g === "female" ? "Feminino" : "Misto";

  const createMut = useMutation({
    mutationFn: async (v: LodgingUnitFormValues) => {
      const { error } = await supabase.from("lodging_units").insert({
        event_id: selectedEventId,
        location_id: v.location_id,
        name: v.name,
        capacity: v.capacity,
        gender_restriction: v.gender_restriction,
        notes: v.notes || null,
        is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Unidade criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: LodgingUnitFormValues & { id: string }) => {
      const { error } = await supabase.from("lodging_units").update({
        location_id: v.location_id,
        name: v.name,
        capacity: v.capacity,
        gender_restriction: v.gender_restriction,
        notes: v.notes || null,
        is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Unidade atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: LodgingUnitFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Unidades de Alojamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Quartos, salas e blocos de hospedagem</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!locations.length}>
            <Plus className="mr-2 h-4 w-4" />Nova unidade
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-xs">
            <label className="text-sm font-medium text-foreground">Evento</label>
            <Select value={selectedEventId} onValueChange={() => {}}>
              <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
              <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <DoorOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !units?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <DoorOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma unidade cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre locais antes de criar unidades.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Ocupação</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u) => {
                const occ = occCountMap.get(u.id) || 0;
                const full = occ >= u.capacity;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{locationsMap.get(u.location_id)?.name ?? "—"}</TableCell>
                    <TableCell>{u.capacity}</TableCell>
                    <TableCell>
                      <Badge variant={full ? "destructive" : "outline"}>{occ}/{u.capacity}</Badge>
                    </TableCell>
                    <TableCell>{genderLabel(u.gender_restriction)}</TableCell>
                    <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <LodgingUnitFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        unit={editing}
        locations={locations}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
