import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SportFormDialog, {
  type SportFormValues,
} from "@/components/admin/SportFormDialog";

export default function ModalidadesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<Tables<"sports"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sports, isLoading } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const createMutation = useMutation({
    mutationFn: async (values: SportFormValues) => {
      const { error } = await supabase.from("sports").insert({
        event_id: values.event_id,
        name: values.name,
        slug: values.slug,
        is_collective: values.is_collective,
        is_paralympic: values.is_paralympic,
        match_config: values.match_config ?? {},
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      toast.success("Modalidade criada com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      if (err.message?.includes("sports_event_id_slug_key")) {
        toast.error("Já existe uma modalidade com esse slug neste evento.");
      } else {
        toast.error("Erro ao criar modalidade: " + err.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: SportFormValues & { id: string }) => {
      const { error } = await supabase
        .from("sports")
        .update({
          name: values.name,
          slug: values.slug,
          is_collective: values.is_collective,
          is_paralympic: values.is_paralympic,
          match_config: values.match_config ?? {},
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      toast.success("Modalidade atualizada com sucesso");
      setDialogOpen(false);
      setEditingSport(null);
    },
    onError: (err: Error) => {
      if (err.message?.includes("sports_event_id_slug_key")) {
        toast.error("Já existe uma modalidade com esse slug neste evento.");
      } else {
        toast.error("Erro ao atualizar modalidade: " + err.message);
      }
    },
  });

  const handleSubmit = (values: SportFormValues) => {
    if (editingSport) {
      updateMutation.mutate({ id: editingSport.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreate = () => {
    setEditingSport(null);
    setDialogOpen(true);
  };

  const openEdit = (sport: Tables<"sports">) => {
    setEditingSport(sport);
    setDialogOpen(true);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Modalidades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de modalidades esportivas dos Jogos Escolares
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />
            Nova modalidade
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !sports?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma modalidade cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Crie a primeira modalidade para começar.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Paralímpica</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sports.map((sport) => {
                const event = eventsMap.get(sport.event_id);
                return (
                  <TableRow key={sport.id}>
                    <TableCell className="font-medium">{sport.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {event ? `${event.name} (${event.year})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sport.is_collective ? "default" : "secondary"}>
                        {sport.is_collective ? "Coletiva" : "Individual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sport.is_paralympic ? (
                        <Badge variant="outline">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não</span>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(sport)}>
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

      <SportFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSport(null);
        }}
        sport={editingSport}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
