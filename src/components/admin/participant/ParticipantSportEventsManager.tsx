import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Trash2, Trophy, AlertTriangle } from "lucide-react";

interface Props {
  participantId: string;
  eventId: string;
  /** When true, shows a warning banner about blocking irregularities */
  hasBlockingIrregularity?: boolean;
}

interface SportEventRow {
  id: string;
  status: string;
  registration_status: string | null;
  sport_event: {
    id: string;
    name: string;
    sport: { name: string } | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  enrolled: { label: "Inscrito", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  waitlist: { label: "Fila de espera", variant: "outline" },
};

export default function ParticipantSportEventsManager({ participantId, eventId, hasBlockingIrregularity }: Props) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria");

  const [toDelete, setToDelete] = useState<SportEventRow | null>(null);

  const { data: rows = [], isLoading } = useQuery<SportEventRow[]>({
    queryKey: ["participant_sport_events_manage", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select(`
          id, status, registration_status,
          sport_event:sport_events!participant_sport_events_sport_event_id_fkey(
            id, name,
            sport:sports!sport_events_sport_id_fkey(name)
          )
        `)
        .eq("participant_id", participantId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SportEventRow[];
    },
    enabled: !!participantId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("participant_sport_events")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição removida com sucesso");
      qc.invalidateQueries({ queryKey: ["participant_sport_events_manage", participantId] });
      qc.invalidateQueries({ queryKey: ["participation-irregularities"] });
      qc.invalidateQueries({ queryKey: ["participant_sport_history", participantId] });
      setToDelete(null);
    },
    onError: (err: Error) => toast.error("Erro ao remover: " + err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {hasBlockingIrregularity && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Este atleta possui irregularidade bloqueante. Remova uma inscrição para sanar o limite excedido.</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
          <Trophy className="h-6 w-6" />
          <p className="text-sm">Nenhuma inscrição em modalidade encontrada.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const st = row.status ? (STATUS_LABELS[row.status] ?? { label: row.status, variant: "outline" as const }) : null;
            return (
              <div key={row.id} className="flex items-center gap-3 p-2.5 rounded-md border bg-card hover:bg-muted/30 transition-colors">
                <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.sport_event?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.sport_event?.sport?.name ?? "—"}</p>
                </div>
                {st && (
                  <Badge variant={st.variant} className="text-xs shrink-0">{st.label}</Badge>
                )}
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setToDelete(row)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover inscrição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a inscrição em <strong>{toDelete?.sport_event?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) deleteMutation.mutate(toDelete.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
