import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Globe, FileWarning, Loader2, Undo2, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  eventId: string;
  sportEventId: string;
  onPublished?: () => void;
}

interface PhasePublishInfo {
  id: string;
  name: string;
  disputes_published_at: string | null;
  disputes_published_by: string | null;
  disputes_updated_at: string | null;
  disputes_unpublished_reason: string | null;
}

export default function DisputePublishControl({ eventId, sportEventId, onPublished }: Props) {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canPublish = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("coordenador_modalidade");
  const canRevert = hasRole("admin") || hasRole("coordenacao_tecnica");

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [revertReason, setRevertReason] = useState("");

  // Fetch publish status for all phases of this sport_event
  const { data: phases = [], isLoading } = useQuery({
    queryKey: ["dispute-publish-status", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, name, disputes_published_at, disputes_published_by, disputes_updated_at, disputes_unpublished_reason")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PhasePublishInfo[];
    },
  });

  const anyPublished = phases.some((p) => p.disputes_published_at);
  const allPublished = phases.length > 0 && phases.every((p) => p.disputes_published_at);
  const hasUnpublishedChanges = phases.some(
    (p) => p.disputes_published_at && p.disputes_updated_at &&
      new Date(p.disputes_updated_at) > new Date(p.disputes_published_at)
  );
  const unpublishedPhases = phases.filter((p) => !p.disputes_published_at);

  // Publish mutation
  const publishMut = useMutation({
    mutationFn: async () => {
      const phaseIds = phases.map((p) => p.id);
      const now = new Date().toISOString();

      for (const id of phaseIds) {
        const { error } = await supabase
          .from("competition_phases")
          .update({
            disputes_published_at: now,
            disputes_published_by: user?.id ?? null,
            disputes_unpublished_reason: null,
          })
          .eq("id", id);
        if (error) throw error;
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_phases",
        record_id: sportEventId,
        action: "disputes_publish",
        payload: { phase_ids: phaseIds, published_at: now },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Disputas publicadas com sucesso!");
      qc.invalidateQueries({ queryKey: ["dispute-publish-status"] });
      setShowPublishDialog(false);
      onPublished?.();
    },
    onError: (e: Error) => toast.error("Erro ao publicar: " + e.message),
  });

  // Revert mutation
  const revertMut = useMutation({
    mutationFn: async () => {
      if (!revertReason.trim()) throw new Error("Informe a justificativa para reverter a publicação.");

      const phaseIds = phases.filter((p) => p.disputes_published_at).map((p) => p.id);

      for (const id of phaseIds) {
        const { error } = await supabase
          .from("competition_phases")
          .update({
            disputes_published_at: null,
            disputes_published_by: null,
            disputes_unpublished_reason: revertReason.trim(),
          })
          .eq("id", id);
        if (error) throw error;
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_phases",
        record_id: sportEventId,
        action: "disputes_unpublish",
        payload: { phase_ids: phaseIds, reason: revertReason.trim() },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Publicação revertida. As disputas voltaram ao estado de rascunho.");
      qc.invalidateQueries({ queryKey: ["dispute-publish-status"] });
      setShowRevertDialog(false);
      setRevertReason("");
      onPublished?.();
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  if (isLoading || phases.length === 0) return null;

  const lastPublished = phases
    .filter((p) => p.disputes_published_at)
    .sort((a, b) => new Date(b.disputes_published_at!).getTime() - new Date(a.disputes_published_at!).getTime())[0];

  return (
    <div className="space-y-2">
      {/* Status bar */}
      <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border bg-card">
        {allPublished && !hasUnpublishedChanges ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Disputas publicadas
            </span>
            {lastPublished?.disputes_published_at && (
              <span className="text-xs text-muted-foreground">
                em {format(new Date(lastPublished.disputes_published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </>
        ) : allPublished && hasUnpublishedChanges ? (
          <>
            <FileWarning className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Alterações não publicadas
            </span>
            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
              Rascunho pendente
            </Badge>
          </>
        ) : anyPublished ? (
          <>
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm text-muted-foreground">
              {unpublishedPhases.length} fase(s) ainda em rascunho
            </span>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Disputas em rascunho — não visíveis externamente
            </span>
            <Badge variant="outline" className="text-[10px]">Rascunho</Badge>
          </>
        )}

        <div className="ml-auto flex gap-2">
          {canPublish && (!allPublished || hasUnpublishedChanges) && (
            <Button size="sm" onClick={() => setShowPublishDialog(true)}>
              <Globe className="h-3.5 w-3.5 mr-1" />
              {hasUnpublishedChanges ? "Republicar" : "Publicar"}
            </Button>
          )}
          {canRevert && anyPublished && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowRevertDialog(true)}
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" />
              Reverter
            </Button>
          )}
        </div>
      </div>

      {/* Publish confirmation dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar disputas?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Ao publicar, as disputas montadas ficarão como referência oficial
                para agenda, resultados e visualização por outros perfis autorizados.
              </p>
              <p className="font-medium text-foreground">
                {phases.length} fase(s) serão marcadas como publicadas.
              </p>
              {hasUnpublishedChanges && (
                <Alert className="mt-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-xs">
                    Existem alterações feitas após a última publicação. Ao republicar, a versão atual substituirá a anterior.
                  </AlertDescription>
                </Alert>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMut.mutate()}
              disabled={publishMut.isPending}
            >
              {publishMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Globe className="h-4 w-4 mr-1" />
              )}
              Confirmar publicação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert dialog with justification */}
      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Undo2 className="h-5 w-5" />
              Reverter publicação
            </DialogTitle>
            <DialogDescription>
              As disputas voltarão ao estado de rascunho e não serão mais visíveis externamente até serem republicadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Esta ação requer justificativa e ficará registrada em auditoria.
                Apenas administradores e coordenação técnica podem reverter.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Justificativa *</Label>
              <Textarea
                placeholder="Descreva o motivo da reversão..."
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevertDialog(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => revertMut.mutate()}
              disabled={!revertReason.trim() || revertMut.isPending}
            >
              {revertMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reverter publicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
