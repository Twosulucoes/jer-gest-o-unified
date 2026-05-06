import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const REVERSAL_REASONS = [
  { value: "duplicidade", label: "Duplicidade" },
  { value: "participante_errado", label: "Participante errado" },
  { value: "janela_errada", label: "Janela errada" },
  { value: "lancamento_acidental", label: "Lançamento acidental" },
  { value: "incidente_operacional", label: "Incidente operacional" },
] as const;

export type ReversalReason = (typeof REVERSAL_REASONS)[number]["value"];

export interface ReverseConsumptionDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  consumptionId: string | null;
  participantName?: string | null;
  windowLabel?: string | null;
  onSuccess?: () => void;
}

export function ReverseConsumptionDialog({
  open,
  onOpenChange,
  consumptionId,
  participantName,
  windowLabel,
  onSuccess,
}: ReverseConsumptionDialogProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<ReversalReason | "">("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!consumptionId || !reason) throw new Error("Selecione um motivo.");
      const { data, error } = await supabase.rpc("reverse_meal_consumption" as any, {
        p_consumption_id: consumptionId,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Consumo estornado com sucesso.", {
        description: "A operação foi registrada na trilha de auditoria.",
      });
      void qc.invalidateQueries({ queryKey: ["meal_consumptions"] });
      void qc.invalidateQueries({ queryKey: ["meal_audit_logs"] });
      onSuccess?.();
      onOpenChange(false);
      setReason("");
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Falha ao estornar consumo.";
      const isPermission = msg.toLowerCase().includes("admin") || msg.includes("42501");
      toast.error(isPermission ? "Apenas administradores podem estornar consumos." : msg);
    },
  });

  const submitting = mutation.isPending;

  const handleConfirm = () => {
    if (!reason || submitting) return;
    mutation.mutate();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            Estornar consumo
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {participantName && (
              <span className="block">
                Participante: <span className="font-medium text-foreground">{participantName}</span>
              </span>
            )}
            {windowLabel && (
              <span className="block">
                Janela: <span className="font-medium text-foreground">{windowLabel}</span>
              </span>
            )}
            <span className="block pt-2 text-destructive">
              Esta ação é irreversível e ficará registrada no log de auditoria.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reverse-reason">
            Motivo do estorno
          </label>
          <Select value={reason} onValueChange={(v) => setReason(v as ReversalReason)} disabled={submitting}>
            <SelectTrigger id="reverse-reason" aria-required>
              <SelectValue placeholder="Selecione um motivo" />
            </SelectTrigger>
            <SelectContent>
              {REVERSAL_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!reason || submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Estornando…
              </>
            ) : (
              "Confirmar estorno"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ReverseConsumptionDialog;
