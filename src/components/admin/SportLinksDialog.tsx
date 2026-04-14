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
import { Plus, Trash2 } from "lucide-react";

interface SportLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export default function SportLinksDialog({ open, onOpenChange, userId, userName }: SportLinksDialogProps) {
  const { activeEvent } = useEventContext();
  const queryClient = useQueryClient();
  const [selectedSport, setSelectedSport] = useState("");

  const eventId = activeEvent?.id;

  const { data: sports = [] } = useQuery({
    queryKey: ["sports-for-links", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await supabase.from("sports").select("id, name").eq("event_id", eventId).order("name");
      return data || [];
    },
    enabled: open && !!eventId,
  });

  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["user-sport-links", userId, eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await supabase
        .from("user_sport_links")
        .select("id, sport_id, sports(name)")
        .eq("user_id", userId)
        .eq("event_id", eventId);
      return data || [];
    },
    enabled: open && !!eventId,
  });

  const addMutation = useMutation({
    mutationFn: async (sportId: string) => {
      const { error } = await supabase.from("user_sport_links").insert({
        user_id: userId,
        sport_id: sportId,
        event_id: eventId!,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sport-links", userId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["user-sport-links-all"] });
      setSelectedSport("");
      toast.success("Modalidade vinculada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("user_sport_links").delete().eq("id", linkId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sport-links", userId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["user-sport-links-all"] });
      toast.success("Vínculo removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const linkedSportIds = links.map((l: any) => l.sport_id);
  const availableSports = sports.filter((s: any) => !linkedSportIds.includes(s.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modalidades — {userName}</DialogTitle>
        </DialogHeader>

        {!eventId ? (
          <p className="text-sm text-muted-foreground">Selecione um evento ativo primeiro.</p>
        ) : (
          <div className="space-y-4">
            {loadingLinks ? (
              <Skeleton className="h-10 w-full" />
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma modalidade vinculada.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {links.map((l: any) => (
                  <Badge key={l.id} variant="secondary" className="gap-1 pr-1">
                    {(l as any).sports?.name || "—"}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1"
                      onClick={() => removeMutation.mutate(l.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar modalidade..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSports.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedSport || addMutation.isPending}
                onClick={() => addMutation.mutate(selectedSport)}
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
