import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Wand2, Loader2, QrCode, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { issueCredentialWithRetry } from "@/lib/credentialUtils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
}

export default function BulkQrDialog({ open, onOpenChange, eventId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const { data: semQrIds = [], isLoading } = useQuery({
    queryKey: ["bulk-qr-sem-qr-ids", eventId, open],
    enabled: !!eventId && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_participants_sem_qr" as any, {
        p_event_id: eventId,
      });
      if (error) throw error;
      return ((data ?? []) as Array<{ participant_id: string }>).map((r) => r.participant_id);
    },
  });

  const handleGenerate = async () => {
    if (!user || semQrIds.length === 0) return;
    setRunning(true);
    setDone(0);
    setFailed(0);
    setProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < semQrIds.length; i++) {
      const participantId = semQrIds[i];
      try {
        await issueCredentialWithRetry(eventId, participantId, user.id);
        successCount++;
      } catch {
        failCount++;
      }
      setDone(successCount);
      setFailed(failCount);
      setProgress(Math.round(((i + 1) / semQrIds.length) * 100));
    }

    setRunning(false);
    setFinished(true);

    if (failCount === 0) {
      toast.success(`${successCount} QR codes gerados com sucesso.`);
    } else {
      toast.warning(`${successCount} gerados, ${failCount} falharam.`);
    }

    qc.invalidateQueries({ queryKey: ["participant_credentials"] });
    qc.invalidateQueries({ queryKey: ["participants-page"] });
    qc.invalidateQueries({ queryKey: ["credentialed-participant-ids"] });
    qc.invalidateQueries({ queryKey: ["bulk-qr-sem-qr-ids"] });
  };

  const handleClose = () => {
    if (running) return;
    setFinished(false);
    setProgress(0);
    setDone(0);
    setFailed(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Gerar QR em lote
          </DialogTitle>
          <DialogDescription>
            Gera credenciais e QR codes para todos os participantes que ainda não possuem vínculo ativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando participantes sem QR...
            </div>
          ) : finished ? (
            <div className="text-center space-y-2 py-4">
              <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-medium">{done} QR codes gerados</p>
              {failed > 0 && <p className="text-sm text-destructive">{failed} falharam</p>}
            </div>
          ) : running ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gerando credenciais...</span>
                <span className="font-medium">{done + failed}/{semQrIds.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{done} gerados · {failed} falhas</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <QrCode className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  {semQrIds.length === 0
                    ? "Todos os participantes já têm QR"
                    : `${semQrIds.length} participante${semQrIds.length !== 1 ? "s" : ""} sem QR`}
                </p>
                {semQrIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cada credencial recebe um código único no formato J + 5 dígitos.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={running}>
            {finished ? "Fechar" : "Cancelar"}
          </Button>
          {!finished && (
            <Button
              onClick={handleGenerate}
              disabled={running || isLoading || semQrIds.length === 0}
            >
              {running ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" />Gerar {semQrIds.length > 0 ? semQrIds.length : ""} QR codes</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
