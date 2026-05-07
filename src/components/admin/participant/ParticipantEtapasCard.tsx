import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";

interface Props {
  participantId: string;
  eventId: string;
}

interface StageLink {
  id: string;
  event_stage_id: string;
  status: string;
  stage: {
    id: string;
    name: string;
    kind: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
}

interface EventStage {
  id: string;
  name: string;
  kind: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
}

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória",
  regional: "Regional",
  final: "Final",
  legado: "Legado",
};

const STAGE_STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  draft: "text-yellow-600",
  archived: "text-muted-foreground",
};

export default function ParticipantEtapasCard({ participantId, eventId }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria");

  const [addingStageId, setAddingStageId] = useState<string>("");
  const [toRemove, setToRemove] = useState<StageLink | null>(null);

  const { data: stageLinks = [], isLoading } = useQuery<StageLink[]>({
    queryKey: ["participant_event_stages", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_event_stages")
        .select(`
          id, event_stage_id, status,
          stage:event_stages!event_stage_id(id, name, kind, status, starts_at, ends_at)
        `)
        .eq("participant_id", participantId)
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StageLink[];
    },
    enabled: !!participantId,
  });

  const { data: allStages = [] } = useQuery<EventStage[]>({
    queryKey: ["event_stages_all", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, kind, status, starts_at, ends_at")
        .eq("event_id", eventId)
        .neq("status", "archived")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventStage[];
    },
    enabled: !!eventId,
  });

  const enrolledStageIds = new Set(stageLinks.map((sl) => sl.event_stage_id));
  const availableToAdd = allStages.filter((s) => !enrolledStageIds.has(s.id));

  const addMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase
        .from("participant_event_stages")
        .insert({ participant_id: participantId, event_stage_id: stageId, event_id: eventId, status: "active" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa adicionada");
      setAddingStageId("");
      qc.invalidateQueries({ queryKey: ["participant_event_stages", participantId] });
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("participant_event_stages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa removida");
      setToRemove(null);
      qc.invalidateQueries({ queryKey: ["participant_event_stages", participantId] });
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Etapas de Participação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : stageLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma etapa vinculada.</p>
        ) : (
          <div className="space-y-1.5">
            {stageLinks.map((sl) => (
              <div key={sl.id} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sl.stage?.name ?? "—"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {KIND_LABELS[sl.stage?.kind ?? ""] ?? sl.stage?.kind}
                    </span>
                    {sl.stage?.starts_at && (
                      <span className="text-xs text-muted-foreground">
                        • {new Date(sl.stage.starts_at + "T00:00:00").toLocaleDateString("pt-BR")}
                        {sl.stage.ends_at ? ` – ${new Date(sl.stage.ends_at + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 ${STAGE_STATUS_COLORS[sl.stage?.status ?? ""] ?? ""}`}
                >
                  {sl.stage?.status === "active" ? "Ativa" : sl.stage?.status === "draft" ? "Rascunho" : sl.stage?.status ?? "—"}
                </Badge>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setToRemove(sl)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && availableToAdd.length > 0 && (
          <div className="flex gap-2 pt-1">
            <Select value={addingStageId} onValueChange={setAddingStageId}>
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue placeholder="Adicionar etapa…" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!addingStageId || addMutation.isPending}
              onClick={() => addingStageId && addMutation.mutate(addingStageId)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar
            </Button>
          </div>
        )}

        <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover etapa</AlertDialogTitle>
              <AlertDialogDescription>
                Remover <strong>{toRemove?.stage?.name}</strong> deste participante?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removeMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (toRemove) removeMutation.mutate(toRemove.id);
                }}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? "Removendo…" : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
