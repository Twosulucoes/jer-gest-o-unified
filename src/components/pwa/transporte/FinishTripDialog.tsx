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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle } from "lucide-react";

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
  const [noProblems, setNoProblems] = useState<string>("yes");
  const [incidents, setIncidents] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  const missing = totalCount - boardedCount;
  const hasIncidents = noProblems === "no";
  const canSubmit = !hasIncidents || incidents.trim().length > 0;

  const handleConfirm = () => {
    const allNotes = [
      hasIncidents ? `OCORRÊNCIAS: ${incidents.trim()}` : null,
      additionalNotes.trim() ? `OBS: ${additionalNotes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    onConfirm(hasIncidents, allNotes);
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

          {/* Radio */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Viagem ocorreu sem problemas?</Label>
            <RadioGroup value={noProblems} onValueChange={setNoProblems} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="rYes" />
                <Label htmlFor="rYes" className="flex items-center gap-1 cursor-pointer">
                  <CheckCircle className="h-4 w-4 text-primary" /> Sim
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="rNo" />
                <Label htmlFor="rNo" className="flex items-center gap-1 cursor-pointer">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Não
                </Label>
              </div>
            </RadioGroup>
          </div>

          {hasIncidents && (
            <div className="space-y-1">
              <Label className="text-sm">
                Descreva as ocorrências <Badge variant="destructive" className="text-[10px] ml-1">Obrigatório</Badge>
              </Label>
              <Textarea
                value={incidents}
                onChange={(e) => setIncidents(e.target.value)}
                placeholder="Relate o que aconteceu..."
                rows={3}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-sm">Observações adicionais</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Informações extras (opcional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={finishing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={finishing || !canSubmit}>
            {finishing ? "Finalizando..." : "Confirmar Finalização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
