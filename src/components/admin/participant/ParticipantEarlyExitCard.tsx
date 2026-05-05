import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const REASONS: { value: string; label: string }[] = [
  { value: "desistencia", label: "Desistência" },
  { value: "saude", label: "Problema de saúde" },
  { value: "convocacao", label: "Convocação externa" },
  { value: "disciplinar", label: "Medida disciplinar" },
  { value: "outro", label: "Outro" },
];

interface Props {
  participantId: string;
  participantName: string;
}

interface ExitRow {
  left_event_at: string | null;
  left_event_reason: string | null;
  left_event_by: string | null;
}

export default function ParticipantEarlyExitCard({ participantId, participantName }: Props) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("secretaria");

  const [openRegister, setOpenRegister] = useState(false);
  const [openRevert, setOpenRevert] = useState(false);
  const [reasonKey, setReasonKey] = useState<string>("desistencia");
  const [reasonNotes, setReasonNotes] = useState("");

  const { data, isLoading } = useQuery<ExitRow | null>({
    queryKey: ["participant_left_event", participantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("participants")
        .select("left_event_at, left_event_reason, left_event_by")
        .eq("id", participantId)
        .single();
      if (error) throw error;
      return data as ExitRow;
    },
  });

  const registerExit = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Sessão expirada");

      const reasonLabel = REASONS.find((r) => r.value === reasonKey)?.label ?? reasonKey;
      const composedReason = reasonNotes.trim()
        ? `${reasonLabel} — ${reasonNotes.trim()}`
        : reasonLabel;

      const { error } = await (supabase as any)
        .from("participants")
        .update({
          left_event_at: new Date().toISOString(),
          left_event_reason: composedReason,
          left_event_by: userId,
        })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída antecipada registrada");
      setOpenRegister(false);
      setReasonNotes("");
      setReasonKey("desistencia");
      qc.invalidateQueries({ queryKey: ["participant_left_event", participantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertExit = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("participants")
        .update({
          left_event_at: null,
          left_event_reason: null,
          left_event_by: null,
        })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída antecipada removida");
      setOpenRevert(false);
      qc.invalidateQueries({ queryKey: ["participant_left_event", participantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasExit = !!data?.left_event_at;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LogOut className="h-4 w-4 text-amber-600" />
          Saída Antecipada do Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : hasExit ? (
          <>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
              <p className="font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Saída registrada em{" "}
                {new Date(data!.left_event_at!).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              {data?.left_event_reason && (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">Motivo:</span> {data.left_event_reason}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A partir desta data o participante é recusado em todos os caminhos de
                registro de refeição (QR, voucher e manual).
              </p>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setOpenRevert(true)}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Reverter saída
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Nenhuma saída antecipada registrada. O participante segue elegível para
              consumo de refeições conforme a trava de presença padrão (credencial, ativo
              e <span className="font-mono">needs_meals</span>).
            </p>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setOpenRegister(true)}>
                <LogOut className="h-4 w-4 mr-1.5" /> Registrar saída antecipada
              </Button>
            )}
          </>
        )}

        <Dialog open={openRegister} onOpenChange={setOpenRegister}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar saída antecipada</DialogTitle>
              <DialogDescription>
                Esta ação encerra a elegibilidade de <strong>{participantName}</strong> a
                partir de agora. A trilha guarda quem registrou e quando. Pode ser
                revertida por administrador ou secretaria.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Motivo</Label>
                <Select value={reasonKey} onValueChange={setReasonKey}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Detalhes (opcional)</Label>
                <Textarea
                  placeholder="Ex.: retornou à cidade de origem com a delegação às 14h."
                  value={reasonNotes}
                  onChange={(e) => setReasonNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenRegister(false)}>
                Cancelar
              </Button>
              <Button onClick={() => registerExit.mutate()} disabled={registerExit.isPending}>
                {registerExit.isPending ? "Registrando…" : "Registrar saída"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openRevert} onOpenChange={setOpenRevert}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reverter saída antecipada</DialogTitle>
              <DialogDescription>
                Vai remover o registro de saída de <strong>{participantName}</strong>. A
                pessoa volta a ser elegível para refeições a partir de agora. Use apenas
                em casos de registro indevido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenRevert(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => revertExit.mutate()}
                disabled={revertExit.isPending}
              >
                {revertExit.isPending ? "Removendo…" : "Reverter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
