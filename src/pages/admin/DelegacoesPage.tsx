import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Users, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { useStageParticipantFilter } from "@/hooks/useStageParticipantFilter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import DelegationFormDialog, { type DelegationFormValues } from "@/components/admin/DelegationFormDialog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export default function DelegacoesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<Tables<"delegations"> | null>(null);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { stageId, participantIds } = useStageParticipantFilter();

  // Quando filtrando por etapa, calcula os delegation_id que têm participantes na etapa
  const { data: stageDelegationIds } = useQuery({
    queryKey: ["stage_delegation_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participants!inner(delegation_id)")
        .eq("event_stage_id", stageId);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.participants?.delegation_id).filter(Boolean));
    },
  });

  const { data: allDelegations, isLoading } = useQuery({
    queryKey: ["delegations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delegations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const delegations = useMemo(() => {
    if (!allDelegations) return allDelegations;
    if (!stageId) return allDelegations;
    if (!stageDelegationIds) return [];
    return allDelegations.filter((d) => stageDelegationIds.has(d.id));
  }, [allDelegations, stageId, stageDelegationIds]);

  const eventsMap = new Map(events.map((e) => [e.id, e]));
  const institutionsMap = new Map(institutions.map((i) => [i.id, i]));

  const toPayload = (values: DelegationFormValues) => ({
    event_id: values.event_id,
    institution_id: values.institution_id,
    status: values.status,
    chief_name: values.chief_name || null,
    chief_phone: values.chief_phone || null,
    chief_email: values.chief_email || null,
    notes: values.notes || null,
  });

  const handleError = (err: Error, action: string) => {
    if (err.message?.includes("delegations_event_institution_key")) {
      toast.error("Esta instituição já possui uma delegação cadastrada para o evento selecionado.");
    } else {
      toast.error(`Erro ao ${action} delegação: ${err.message}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: DelegationFormValues) => {
      const { error } = await supabase.from("delegations").insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Delegação criada com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => handleError(err, "criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: DelegationFormValues & { id: string }) => {
      const { event_id: _, institution_id: __, ...rest } = toPayload(values);
      const { error } = await supabase.from("delegations").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delegations"] });
      toast.success("Delegação atualizada com sucesso");
      setDialogOpen(false);
      setEditingDelegation(null);
    },
    onError: (err: Error) => handleError(err, "atualizar"),
  });

  const handleSubmit = (values: DelegationFormValues) => {
    if (editingDelegation) {
      updateMutation.mutate({ id: editingDelegation.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Delegações</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão das delegações de instituições nos eventos</p>
        </div>
        {canWrite && (
          <Button
            onClick={() => { setEditingDelegation(null); setDialogOpen(true); }}
            disabled={!events.length || !institutions.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova delegação
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !delegations?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma delegação cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Registre a primeira delegação para começar.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Chefe</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {delegations.map((del) => {
                const event = eventsMap.get(del.event_id);
                const institution = institutionsMap.get(del.institution_id);
                const statusInfo = STATUS_MAP[del.status] ?? { label: del.status, variant: "outline" as const };
                return (
                  <TableRow key={del.id}>
                    <TableCell className="text-muted-foreground">
                      {event ? `${event.name} (${event.year})` : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {institution?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>{del.chief_name || "—"}</TableCell>
                    <TableCell>{del.chief_phone || "—"}</TableCell>
                    <TableCell>{del.chief_email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/admin/delegacoes/${del.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditingDelegation(del); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <DelegationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingDelegation(null); }}
        delegation={editingDelegation}
        events={events}
        institutions={institutions}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
