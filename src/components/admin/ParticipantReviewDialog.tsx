import { Check, User, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ParticipantData {
  name: string;
  participantId: string;
  cpf: string | null;
  type: string;
  institution?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  foodRestrictions?: string | null;
}

interface ParticipantReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participant: ParticipantData | null;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  title?: string;
  statusColor?: string;
  statusLabel?: string;
  statusIcon?: React.ReactNode;
  message?: string | null;
  loading?: boolean;
}

export function ParticipantReviewDialog({
  open,
  onOpenChange,
  participant,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Nova leitura",
  title = "Revisar Dados",
  statusColor = "bg-muted/30 border-border",
  statusLabel,
  statusIcon,
  message,
  loading,
}: ParticipantReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none gap-0">
        <div className="flex flex-col">
          {/* Status Header */}
          {(statusLabel || statusIcon) && (
            <div className={`p-6 text-center space-y-2 ${statusColor} border-b`}>
              <div className="flex justify-center mb-2">
                {statusIcon}
              </div>
              <h2 className="text-2xl font-black tracking-tight uppercase">{statusLabel || title}</h2>
              {message && <p className="text-sm font-medium opacity-90">{message}</p>}
            </div>
          )}

          <div className="p-6 space-y-6">
            {participant ? (
              <div className="flex flex-col items-center text-center space-y-4">
                <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                  <AvatarImage src={participant.photo_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold uppercase">
                    {participant.name.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-foreground leading-tight">
                    {participant.name}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                    {participant.institution ?? "Sem instituição"}
                  </p>
                  {participant.cpf && (
                    <p className="text-xs text-muted-foreground font-mono">
                      CPF: {participant.cpf}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 w-full pt-2">
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Categoria</p>
                    <Badge variant="outline" className="font-bold border-primary/20 bg-primary/5 uppercase">
                      {participant.type === "athlete" ? "Atleta" : participant.type}
                    </Badge>
                  </div>
                  {participant.birth_date && (
                    <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Nascimento</p>
                      <p className="font-mono text-sm font-bold">
                        {new Date(participant.birth_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>

                {participant.foodRestrictions && (
                  <div className="w-full bg-destructive/10 border border-destructive/20 p-3 rounded-xl flex items-start gap-3 text-left">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">Restrição Alimentar</p>
                      <p className="text-sm font-bold text-destructive leading-tight">{participant.foodRestrictions}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                <XCircle className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium text-center">Dados indisponíveis.</p>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="w-full h-14 text-lg font-bold uppercase tracking-widest"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button 
              className="w-full h-14 text-lg font-bold uppercase tracking-widest shadow-lg" 
              onClick={onConfirm}
              disabled={loading}
              autoFocus
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
              ) : (
                <>
                  <Check className="mr-2 h-6 w-6" />
                  {confirmLabel}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
