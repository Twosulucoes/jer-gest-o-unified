import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface FieldConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  align?: string;
  maxWidth?: number;
  visible: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: any;
  participantId?: string;
}

export default function CredentialPreviewDialog({ open, onOpenChange, template, participantId: fixedParticipantId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState(fixedParticipantId || "");
  const [_rendering, setRendering] = useState(false);

  const eventId = template?.event_id;

  const { data: credentials = [] } = useQuery({
    queryKey: ["preview-credentials", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, credential_code, qr_code_value")
        .eq("event_id", eventId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open,
  });

  const participantIds = credentials.map((c) => c.participant_id);

  const { data: participants = [] } = useQuery({
    queryKey: ["preview-participants", participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, person_id, delegation_id")
        .in("id", participantIds);
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0 && open,
  });

  const personIds = participants.map((p) => p.person_id);
  const delegationIds = [...new Set(participants.map((p) => p.delegation_id))];

  const { data: people = [] } = useQuery({
    queryKey: ["preview-people", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return [];
      const { data, error } = await supabase.from("people").select("id, full_name, photo_url").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0 && open,
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["preview-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const { data, error } = await supabase.from("delegations").select("id, institution_id").in("id", delegationIds);
      if (error) throw error;
      return data;
    },
    enabled: delegationIds.length > 0 && open,
  });

  const instIds = [...new Set(delegations.map((d) => d.institution_id))];
  const { data: institutions = [] } = useQuery({
    queryKey: ["preview-institutions", instIds],
    queryFn: async () => {
      if (instIds.length === 0) return [];
      const { data, error } = await supabase.from("institutions").select("id, name").in("id", instIds);
      if (error) throw error;
      return data;
    },
    enabled: instIds.length > 0 && open,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["preview-enrollments", selectedParticipantId],
    queryFn: async () => {
      if (!selectedParticipantId) return [];
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("sport_event_id")
        .eq("participant_id", selectedParticipantId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedParticipantId && open,
  });

  const seIds = enrollments.map((e) => e.sport_event_id);
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["preview-sport-events", seIds],
    queryFn: async () => {
      if (seIds.length === 0) return [];
      const { data, error } = await supabase.from("sport_events").select("id, name").in("id", seIds);
      if (error) throw error;
      return data;
    },
    enabled: seIds.length > 0 && open,
  });

  const TYPE_LABELS: Record<string, string> = {
    athlete: "Atleta",
    coach: "Técnico",
    head_of_delegation: "Chefe de Delegação",
    staff: "Staff",
  };

  /** Draw text that auto-shrinks to fit maxWidth */
  const drawFittedText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    fc: FieldConfig
  ) => {
    const baseFontSize = fc.fontSize ?? 14;
    const weight = fc.fontWeight ?? "normal";
    const maxW = fc.maxWidth ?? 0;
    let fontSize = baseFontSize;

    // Auto-shrink if text overflows maxWidth
    if (maxW > 0) {
      ctx.font = `${weight} ${fontSize}px sans-serif`;
      while (ctx.measureText(text).width > maxW && fontSize > 8) {
        fontSize -= 1;
        ctx.font = `${weight} ${fontSize}px sans-serif`;
      }
    }

    ctx.font = `${weight} ${fontSize}px sans-serif`;
    ctx.fillStyle = fc.fontColor ?? "#000000";
    ctx.textAlign = (fc.align as CanvasTextAlign) ?? "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, fc.x, fc.y, maxW > 0 ? maxW : undefined);
  };

  const renderCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;

    setRendering(true);
    const ctx = canvas.getContext("2d")!;
    canvas.width = template.width;
    canvas.height = template.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (template.background_url) {
      try {
        const img = await loadImage(template.background_url);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch {
        // bg failed
      }
    }

    const fieldConfig = template.field_config as Record<string, FieldConfig>;
    const participant = participants.find((p) => p.id === selectedParticipantId);
    const credential = credentials.find((c) => c.participant_id === selectedParticipantId);
    const person = participant ? people.find((p) => p.id === participant.person_id) : null;
    const delegation = participant ? delegations.find((d) => d.id === participant.delegation_id) : null;
    const institution = delegation ? institutions.find((i) => i.id === delegation.institution_id) : null;
    const sportEventNames = sportEvents.map((se) => se.name).join(", ");

    const useDemo = !participant;
    const data: Record<string, string> = {
      full_name: useDemo ? "PAULO SILVA DE SOUZA" : (person?.full_name ?? "—").toUpperCase(),
      institution: useDemo ? "ESCOLA ESTADUAL MONTEIRO LOBATO" : (institution?.name ?? "—").toUpperCase(),
      participant_type: useDemo ? "Atleta" : TYPE_LABELS[participant?.participant_type ?? ""] ?? participant?.participant_type ?? "—",
      sport_event: useDemo ? "VOLEIBOL" : (sportEventNames || "—").toUpperCase(),
      credential_code: useDemo ? "RR-2026-0042" : credential?.credential_code ?? "—",
    };

    // Draw photo placeholder or actual photo
    const photoConfig = fieldConfig.photo;
    if (photoConfig?.visible) {
      const photoW = photoConfig.width ?? 120;
      const photoH = photoConfig.height ?? 140;
      const photoUrl = person?.photo_url;

      if (photoUrl) {
        try {
          const photoImg = await loadImage(photoUrl);
          // Draw with rounded corners
          ctx.save();
          const radius = 8;
          ctx.beginPath();
          ctx.moveTo(photoConfig.x + radius, photoConfig.y);
          ctx.lineTo(photoConfig.x + photoW - radius, photoConfig.y);
          ctx.quadraticCurveTo(photoConfig.x + photoW, photoConfig.y, photoConfig.x + photoW, photoConfig.y + radius);
          ctx.lineTo(photoConfig.x + photoW, photoConfig.y + photoH - radius);
          ctx.quadraticCurveTo(photoConfig.x + photoW, photoConfig.y + photoH, photoConfig.x + photoW - radius, photoConfig.y + photoH);
          ctx.lineTo(photoConfig.x + radius, photoConfig.y + photoH);
          ctx.quadraticCurveTo(photoConfig.x, photoConfig.y + photoH, photoConfig.x, photoConfig.y + photoH - radius);
          ctx.lineTo(photoConfig.x, photoConfig.y + radius);
          ctx.quadraticCurveTo(photoConfig.x, photoConfig.y, photoConfig.x + radius, photoConfig.y);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(photoImg, photoConfig.x, photoConfig.y, photoW, photoH);
          ctx.restore();
        } catch {
          drawPhotoPlaceholder(ctx, photoConfig.x, photoConfig.y, photoW, photoH);
        }
      } else {
        drawPhotoPlaceholder(ctx, photoConfig.x, photoConfig.y, photoW, photoH);
      }
    }

    // Draw text fields
    for (const [key, value] of Object.entries(data)) {
      const fc = fieldConfig[key];
      if (!fc || !fc.visible) continue;
      drawFittedText(ctx, value, fc);
    }

    // Draw QR Code
    const qrConfig = fieldConfig.qr_code;
    if (qrConfig?.visible) {
      const qrValue = useDemo ? "demo-qr-code-12345" : credential?.qr_code_value ?? "no-qr";
      try {
        const qrDataUrl = await QRCode.toDataURL(qrValue, {
          width: qrConfig.width ?? 110,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrConfig.x, qrConfig.y, qrConfig.width ?? 110, qrConfig.height ?? 110);
      } catch {
        // QR generation failed
      }
    }

    setRendering(false);
  };

  useEffect(() => {
    if (open && template) {
      const timer = setTimeout(renderCanvas, 300);
      return () => clearTimeout(timer);
    }
  }, [open, template, selectedParticipantId, participants, people, credentials, sportEvents]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    const person = people.find((p) => {
      const part = participants.find((pt) => pt.id === selectedParticipantId);
      return part && p.id === part.person_id;
    });
    link.download = `credencial-${person?.full_name?.replace(/\s+/g, "-").toLowerCase() ?? "preview"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh"><img src="${dataUrl}" style="max-width:100%;max-height:100vh" /></body></html>`);
      win.document.close();
      win.onload = () => win.print();
    }
  };

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
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium">Participante (com credencial emitida)</label>
            <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
              <SelectTrigger>
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

function drawPhotoPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(200, 200, 200, 0.5)";
  ctx.strokeStyle = "rgba(150, 150, 150, 0.6)";
  ctx.lineWidth = 1;
  const r = 8;
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
