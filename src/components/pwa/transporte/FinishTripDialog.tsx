import { useState } from "react";
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

interface FinishTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardedCount: number;
  totalCount: number;
  finishing: boolean;
  onConfirm: (hasIncidents: boolean, notes: string) => void;
}

export function FinishTripDialog({
  open,
  onOpenChange,
  boardedCount,
  totalCount,
  finishing,
  onConfirm,
}: FinishTripDialogProps) {
  const [notes, setNotes] = useState("");

  const missing = totalCount - boardedCount;
  const hasIncidents = notes.trim().length > 0;

  const handleConfirm = () => {
    onConfirm(hasIncidents, notes.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar Viagem</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-2">
              <p className="text-2xl font-bold text-primary">{boardedCount}</p>
              <p className="text-[10px] text-muted-foreground">Embarcados</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-[10px] text-muted-foreground">Esperados</p>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <p className={`text-2xl font-bold ${missing > 0 ? "text-destructive" : "text-primary"}`}>
                {missing}
              </p>
              <p className="text-[10px] text-muted-foreground">Faltaram</p>
            </div>
          </div>

          {/* Single field for incidents/notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Ocorrências e Observações</Label>
            <p className="text-xs text-muted-foreground">
              (opcional — relate problemas ou informações importantes)
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva ocorrências, problemas ou observações sobre a viagem..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="h-12 text-base" onClick={() => onOpenChange(false)} disabled={finishing}>
            Cancelar
          </Button>
          <Button className="h-12 text-base" onClick={handleConfirm} disabled={finishing}>
            {finishing ? "Finalizando..." : "Confirmar Finalização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
