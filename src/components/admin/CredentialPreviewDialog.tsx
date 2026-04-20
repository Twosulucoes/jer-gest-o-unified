import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
...
export default function CredentialPreviewDialog({ open, onOpenChange, template, participantId: fixedParticipantId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(fixedParticipantId || "");
  const [_rendering, setRendering] = useState(false);
  const participantLabelId = useId();
...
  const participantOptions = participants.map((p) => {
    const person = people.find((pe) => pe.id === p.person_id);
    return { id: p.id, label: person?.full_name ?? p.id };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview da Credencial — {template?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!fixedParticipantId && (
            <div className="space-y-2 max-w-md">
              <Label id={participantLabelId} className="text-sm font-medium">Participante (com credencial emitida)</Label>
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger aria-labelledby={participantLabelId} aria-label="Participante com credencial emitida">
                  <SelectValue placeholder={credentials.length === 0 ? "Nenhuma credencial emitida" : "Selecione ou veja demo"} />
                </SelectTrigger>
                <SelectContent>
                  {participantOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedParticipantId && (
                <p className="text-xs text-muted-foreground">Sem seleção, será exibido preview com dados fictícios.</p>
              )}
            </div>
          )}

          <div className="flex justify-center rounded-lg border bg-muted/30 p-4 overflow-auto">
            <canvas
              ref={canvasRef}
              className="border shadow-sm"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Baixar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPhotoPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
  ctx.strokeStyle = "rgba(150, 150, 150, 0.6)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#888";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FOTO", x + w / 2, y + h / 2);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
