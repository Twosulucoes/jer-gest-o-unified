import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
import EventFormDialog from "@/components/admin/EventFormDialog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  published: { label: "Publicado", variant: "default" },
  in_progress: { label: "Em andamento", variant: "outline" },
  finished: { label: "Encerrado", variant: "destructive" },
};

export default function EventosPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Tables<"events"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events, isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (values: {
      name: string;
      slug: string;
      year: number;
      status: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const { error } = await supabase.from("events").insert({
        name: values.name,
        slug: values.slug,
        year: values.year,
        status: values.status,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento criado com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar evento: " + err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...values
    }: {
      id: string;
      name: string;
      slug: string;
      year: number;
      status: string;
      start_date?: string;
      end_date?: string;
    }) => {
      const { error } = await supabase
        .from("events")
        .update({
          name: values.name,
          slug: values.slug,
          year: values.year,
          status: values.status,
          start_date: values.start_date || null,
          end_date: values.end_date || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento atualizado com sucesso");
      setDialogOpen(false);
      setEditingEvent(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar evento: " + err.message);
    },
  });

  const handleSubmit = (values: {
    name: string;
    slug: string;
    year: number;
    status: string;
    start_date?: string;
    end_date?: string;
  }) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const openCreate = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEdit = (event: Tables<"events">) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Eventos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de eventos dos Jogos Escolares
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !events?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum evento cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Crie o primeiro evento para começar.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const status = STATUS_MAP[event.status] ?? {
                  label: event.status,
                  variant: "outline" as const,
                };
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{event.year}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(event.start_date)}</TableCell>
                    <TableCell>{formatDate(event.end_date)}</TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(event)}
                        >
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

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingEvent(null);
        }}
        event={editingEvent}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
