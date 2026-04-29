import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { type IncidentModule, type IncidentStatus } from "@/types/incidents";
import { useTodayMealWindows } from "@/hooks/useTodayMealWindows";

interface FoodIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedWindowId?: string | null;
}

export function FoodIncidentDialog({
  open,
  onOpenChange,
  preselectedWindowId,
}: FoodIncidentDialogProps) {
  const { windows } = useTodayMealWindows(open);
  const [selectedWindow, setSelectedWindow] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setSelectedWindow(preselectedWindowId ?? "none");
  }, [open, preselectedWindowId]);

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      toast.error("Descreva a ocorrência com pelo menos 10 caracteres.");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      const chosenWindow = windows.find((w) => w.id === selectedWindow);

      let eventId: string | null = chosenWindow?.event_id ?? null;
      if (!eventId) {
        const stored = localStorage.getItem("jer_active_event");
        if (stored) {
          try { eventId = JSON.parse(stored).id; } catch {}
        }
      }
      if (!eventId) {
        toast.error("Nenhum evento ativo encontrado.");
        return;
      }

      const referenceLabel = chosenWindow
        ? `Janela ${chosenWindow.label}`
        : "Ocorrência geral - Alimentação";

      // Resolve event_stage_id: prioriza a janela; senão, primeira etapa ativa do evento.
      let eventStageId: string | null = chosenWindow?.event_stage_id ?? null;
      if (!eventStageId) {
        const { data: stage } = await supabase
          .from("event_stages")
          .select("id")
          .eq("event_id", eventId)
          .eq("status", "active")
          .order("sort_order")
          .limit(1)
          .maybeSingle();
        eventStageId = (stage as any)?.id ?? null;
      }
      if (!eventStageId) {
        toast.error("Nenhuma etapa ativa encontrada para este evento.");
        return;
      }

      const { error } = await supabase.from("operational_incidents").insert({
        event_id: eventId,
        event_stage_id: eventStageId,
        module: "alimentacao" as IncidentModule,
        reference_id: chosenWindow?.id ?? null,
        reference_label: referenceLabel,
        reported_by_user_id: session.user.id,
        reporter_name: profile?.full_name ?? null,
        reporter_phone: null,
        incident_description: description.trim(),
        incident_status: "pending" as IncidentStatus,
      });

      if (error) throw error;

      toast.success("Ocorrência registrada com sucesso");
      if (navigator.vibrate) navigator.vibrate(100);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar ocorrência");
    } finally {
      setSending(false);
    }
  };

  const selectedLabel = windows.find((w) => w.id === selectedWindow)?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Reportar Ocorrência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {selectedLabel && (
            <p className="text-sm text-muted-foreground">
              Registrando ocorrência para: <strong>{selectedLabel}</strong>
            </p>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Janela de Refeição (opcional)</Label>
            <Select value={selectedWindow} onValueChange={setSelectedWindow}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma janela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (geral)</SelectItem>
                {windows.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Descrição da Ocorrência *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema ou incidente..."
              rows={4}
            />
            {description.length > 0 && description.length < 10 && (
              <p className="text-xs text-destructive">Mínimo 10 caracteres</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="h-12 text-base" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button className="h-12 text-base" onClick={handleSubmit} disabled={sending || description.trim().length < 10}>
            {sending ? "Enviando..." : "Enviar Ocorrência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
