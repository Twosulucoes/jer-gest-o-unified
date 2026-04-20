import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import VenueFormDialog, { type VenueFormValues } from "@/components/admin/VenueFormDialog";

const VENUE_TYPE_MAP: Record<string, string> = {
  arena: "Arena", ginasio: "Ginásio", campo: "Campo", piscina: "Piscina",
  quadra: "Quadra", pista: "Pista", outro: "Outro",
};

export default function LocaisPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Tables<"venues"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: venues, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const toPayload = (values: VenueFormValues) => ({
    event_id: values.event_id,
    event_stage_id: values.event_stage_id,
    name: values.name,
    venue_type: values.venue_type,
    city: values.city || null,
    address: values.address || null,
    is_active: values.is_active,
  });

  const createMutation = useMutation({
    mutationFn: async (values: VenueFormValues) => {
      const { error } = await supabase.from("venues").insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      toast.success("Local criado com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error("Erro ao criar local: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: VenueFormValues & { id: string }) => {
      const { event_id: _, ...payload } = toPayload(values);
      const { error } = await supabase.from("venues").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      toast.success("Local atualizado com sucesso");
      setDialogOpen(false);
      setEditingVenue(null);
    },
    onError: (err: Error) => toast.error("Erro ao atualizar local: " + err.message),
  });

  const handleSubmit = (values: VenueFormValues) => {
    if (editingVenue) {
      updateMutation.mutate({ id: editingVenue.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Locais de competição</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de locais e arenas dos Jogos Escolares</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditingVenue(null); setDialogOpen(true); }} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />
            Novo local
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !venues?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum local cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">Crie o primeiro local para começar.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map((venue) => {
                const event = eventsMap.get(venue.event_id);
                return (
                  <TableRow key={venue.id}>
                    <TableCell className="font-medium">{venue.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {event ? `${event.name} (${event.year})` : "—"}
                    </TableCell>
                    <TableCell>{VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}</TableCell>
                    <TableCell>{venue.city || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={venue.is_active ? "default" : "secondary"}>
                        {venue.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingVenue(venue); setDialogOpen(true); }}>
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

      <VenueFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingVenue(null); }}
        venue={editingVenue}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
