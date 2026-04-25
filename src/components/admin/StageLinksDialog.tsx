import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Layers } from "lucide-react";

interface StageLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export default function StageLinksDialog({ open, onOpenChange, userId, userName }: StageLinksDialogProps) {
  const { activeEvent } = useEventContext();
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState("");

  const eventId = activeEvent?.id;

  const { data: stages = [] } = useQuery({
    queryKey: ["stages-for-links", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await (supabase.from("event_stages" as never) as any)
        .select("id, name, kind")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      return (data || []) as Array<{ id: string; name: string; kind: string }>;
    },
    enabled: open && !!eventId,
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["user-stage-links", userId, eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await supabase
        .from("user_stage_assignments")
        .select(`
          id, 
          event_stage_id,
          event_stages:event_stage_id (
            id,
            name
          )
        `)
        .eq("user_id", userId);
      
      // Filter by current event if needed, but usually stages are event-specific
      // If event_stages doesn't belong to current event, we could filter it out in JS
      return (data || []) as any[];
    },
    enabled: open && !!eventId,
  });

  const addMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const { error } = await supabase.from("user_stage_assignments").insert({
        user_id: userId,
        event_stage_id: stageId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-stage-links", userId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["user-stage-links-all"] });
      setSelectedStage("");
      toast.success("Etapa vinculada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("user_stage_assignments").delete().eq("id", linkId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-stage-links", userId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["user-stage-links-all"] });
      toast.success("Vínculo removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkedStageIds = links.map((l: any) => l.event_stage_id);
  const availableStages = stages.filter((s: any) => !linkedStageIds.includes(s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vínculo de Credenciamento (Etapas) — {userName}</DialogTitle>
        </DialogHeader>

        {!eventId ? (
          <p className="text-sm text-muted-foreground">Selecione um evento ativo primeiro.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Vincule este usuário a etapas específicas para restringir seu escopo de atuação no credenciamento e outras operações por etapa.
            </p>

            {loadingLinks ? (
              <Skeleton className="h-10 w-full" />
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma etapa vinculada.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {links.map((l: any) => (
                  <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                    <Layers className="h-3 w-3 mr-1" />
                    {l.event_stages?.name || "—"}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeMutation.mutate(l.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedStage || addMutation.isPending}
                onClick={() => addMutation.mutate(selectedStage)}
              >
                <Plus className="h-4 w-4 mr-1" /> Vincular
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
