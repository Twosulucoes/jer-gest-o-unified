import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { Printer, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface LabelData {
  fullName: string;
  institution: string;
  participantType: string;
  credentialCode: string;
  qrCodeValue: string;
  sportEvent?: string;
}

const TYPE_LABELS: Record<string, string> = {
  athlete: "ATLETA",
  coach: "TÉCNICO",
  head_of_delegation: "CHEFE DE DELEGAÇÃO",
  staff: "STAFF",
  commission: "COMISSÃO",
};

/* ─── Single label on canvas (80mm × 40mm @ 2x = 604×302 px) ─── */
const LABEL_W = 604;
const LABEL_H = 302;

async function renderLabel(canvas: HTMLCanvasElement, data: LabelData) {
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  // Border
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, LABEL_W - 2, LABEL_H - 2);

  // Left accent bar
  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(0, 0, 6, LABEL_H);

  // QR Code on right side
  const qrSize = 120;
  const qrX = LABEL_W - qrSize - 20;
  const qrY = Math.round((LABEL_H - qrSize) / 2);
  try {
    const qrDataUrl = await QRCode.toDataURL(data.qrCodeValue, {
      width: qrSize,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });
    const img = await loadImg(qrDataUrl);
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
  } catch { /* skip */ }

  // Text area (left of QR)
  const textMaxW = qrX - 30;
  let y = 35;

  // Participant type badge
  const typeText = TYPE_LABELS[data.participantType] ?? data.participantType.toUpperCase();
  ctx.font = "bold 13px sans-serif";
  const badgeW = ctx.measureText(typeText).width + 16;
  ctx.fillStyle = "#1e3a5f";
  roundRect(ctx, 20, y - 12, badgeW, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(typeText, 28, y);
  y += 32;

  // Name
  ctx.fillStyle = "#000000";
  ctx.font = "bold 20px sans-serif";
  const name = data.fullName.toUpperCase();
  let fontSize = 20;
  while (ctx.measureText(name).width > textMaxW && fontSize > 12) {
    fontSize--;
    ctx.font = `bold ${fontSize}px sans-serif`;
  }
  ctx.fillText(name, 20, y, textMaxW);
  y += 28;

  // Institution
  ctx.fillStyle = "#444444";
  ctx.font = "14px sans-serif";
  const inst = data.institution.toUpperCase();
  ctx.fillText(inst, 20, y, textMaxW);
  y += 22;

  // Sport event (if present)
  if (data.sportEvent) {
    ctx.fillStyle = "#666666";
    ctx.font = "12px sans-serif";
    ctx.fillText(data.sportEvent.toUpperCase(), 20, y, textMaxW);
    y += 20;
  }

  // Credential code
  ctx.fillStyle = "#888888";
  ctx.font = "bold 11px monospace";
  ctx.fillText(data.credentialCode, 20, LABEL_H - 25);

  // Dashed cut line at bottom
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, LABEL_H - 1);
  ctx.lineTo(LABEL_W, LABEL_H - 1);
  ctx.stroke();
  ctx.setLineDash([]);
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

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ═══════════════════════════════════════════════════════
   Individual Label Dialog
   ═══════════════════════════════════════════════════════ */

interface SingleLabelProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  participantId: string;
  eventId: string;
}

export function SingleLabelDialog({ open, onOpenChange, participantId, eventId }: SingleLabelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data } = useQuery({
    queryKey: ["label-data", participantId],
    queryFn: () => fetchLabelData(participantId, eventId),
    enabled: open && !!participantId,
  });

  useEffect(() => {
    if (open && data && canvasRef.current) {
      renderLabel(canvasRef.current, data);
    }
  }, [open, data]);

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html><head><title>Etiqueta</title>
        <style>@page{size:80mm 40mm;margin:0}body{margin:0;display:flex;justify-content:center;align-items:center}img{width:80mm;height:40mm}</style>
        </head><body><img src="${dataUrl}"/></body></html>`);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiqueta — {data?.fullName ?? "..."}
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center rounded-lg border bg-muted/30 p-4">
          <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />
        </div>
        <DialogFooter>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir Etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════
   Batch Labels Dialog
   ═══════════════════════════════════════════════════════ */

interface BatchLabelsProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  participantIds: string[];
  eventId: string;
}

export function BatchLabelsDialog({ open, onOpenChange, participantIds, eventId }: BatchLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);

  const { data: labels = [] } = useQuery({
    queryKey: ["batch-label-data", participantIds],
    queryFn: async () => {
      const results: LabelData[] = [];
      for (const pid of participantIds) {
        const d = await fetchLabelData(pid, eventId);
        if (d) results.push(d);
      }
      return results;
    },
    enabled: open && participantIds.length > 0,
  });

  useEffect(() => {
    if (!open || labels.length === 0 || !containerRef.current) return;
    setRendering(true);
    const container = containerRef.current;
    container.innerHTML = "";

    (async () => {
      for (const label of labels) {
        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.marginBottom = "4px";
        container.appendChild(canvas);
        await renderLabel(canvas, label);
      }
      setRendering(false);
    })();
  }, [open, labels]);

  const handlePrint = () => {
    const container = containerRef.current;
    if (!container) return;
    const canvases = container.querySelectorAll("canvas");
    const images = Array.from(canvases).map((c) => (c as HTMLCanvasElement).toDataURL("image/png"));

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html><head><title>Etiquetas em Lote</title>
        <style>
          @page{size:80mm 40mm;margin:0}
          body{margin:0}
          img{width:80mm;height:40mm;page-break-after:always;display:block}
          img:last-child{page-break-after:auto}
        </style>
        </head><body>${images.map((src) => `<img src="${src}"/>`).join("")}</body></html>`);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Etiquetas em Lote — {participantIds.length} participante(s)
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-1 max-h-[55vh] overflow-y-auto" ref={containerRef}>
          {rendering && <p className="text-sm text-muted-foreground text-center py-8">Gerando etiquetas…</p>}
        </div>

        <DialogFooter>
          <Button onClick={handlePrint} disabled={labels.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir {labels.length} Etiqueta(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════
   Shared data fetcher
   ═══════════════════════════════════════════════════════ */

async function fetchLabelData(participantId: string, eventId: string): Promise<LabelData | null> {
  const { data: participant } = await supabase
    .from("participants")
    .select("id, participant_type, person_id, delegation_id")
    .eq("id", participantId)
    .single();
  if (!participant) return null;

  const { data: person } = await supabase
    .from("people")
    .select("full_name")
    .eq("id", participant.person_id)
    .single();

  const { data: credential } = await supabase
    .from("participant_credentials")
    .select("credential_code, qr_code_value")
    .eq("participant_id", participantId)
    .eq("event_id", eventId)
    .eq("status", "active")
    .maybeSingle();

  const { data: delegation } = await supabase
    .from("delegations")
    .select("institution_id")
    .eq("id", participant.delegation_id)
    .single();

  let institutionName = "—";
  if (delegation) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("name")
      .eq("id", delegation.institution_id)
      .single();
    institutionName = inst?.name ?? "—";
  }

  // Sport events
  const { data: enrollments = [] } = await supabase
    .from("participant_sport_events")
    .select("sport_event_id")
    .eq("participant_id", participantId);
  
  let sportEvent = "";
  if (enrollments.length > 0) {
    const seIds = enrollments.map((e) => e.sport_event_id);
    const { data: sportEvents = [] } = await supabase
      .from("sport_events")
      .select("name")
      .in("id", seIds);
    sportEvent = sportEvents.map((se) => se.name).join(", ");
  }

  return {
    fullName: person?.full_name ?? "—",
    institution: institutionName,
    participantType: participant.participant_type,
    credentialCode: credential?.credential_code ?? "—",
    qrCodeValue: credential?.qr_code_value ?? "no-qr",
    sportEvent: sportEvent || undefined,
  };
}
