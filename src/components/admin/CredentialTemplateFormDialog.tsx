import { useEffect, useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Loader2, Upload, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

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

interface FieldConfigMap {
  [key: string]: FieldConfig;
}

const FIELD_META: Record<string, { label: string; help: string; group: "visual" | "text" }> = {
  photo: { label: "Foto", help: "Foto do participante. Posição e tamanho da área da foto na credencial.", group: "visual" },
  qr_code: { label: "QR Code", help: "QR Code para validação. Posição e tamanho do código.", group: "visual" },
  full_name: { label: "Nome Completo", help: "Nome do participante em destaque na credencial.", group: "text" },
  participant_type: { label: "Tipo de Participante", help: "Atleta, Técnico, Staff, etc.", group: "text" },
  sport_event: { label: "Modalidade / Prova", help: "Ex: Voleibol — Masculino Sub-17.", group: "text" },
  institution: { label: "Instituição", help: "Nome da escola/instituição do participante.", group: "text" },
  credential_code: { label: "Código da Credencial", help: "Código serial único da credencial.", group: "text" },
};

const buildDefaultFieldConfig = (w: number, h: number): FieldConfigMap => {
  const cx = w / 2;
  const photoW = Math.round(w * 0.20);
  const photoH = Math.round(photoW * 1.25);
  const photoY = Math.round(h * 0.22);
  const textStart = photoY + photoH + Math.round(h * 0.04);
  const lineH = Math.round(h * 0.04);
  const qrSize = Math.round(w * 0.18);

  return {
    photo: { x: Math.round(cx - photoW / 2), y: photoY, width: photoW, height: photoH, visible: true },
    full_name: { x: cx, y: textStart, fontSize: Math.round(h * 0.028), fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: Math.round(w * 0.8), visible: true },
    participant_type: { x: cx, y: textStart + lineH, fontSize: Math.round(h * 0.018), fontColor: "#555555", align: "center", maxWidth: Math.round(w * 0.7), visible: true },
    sport_event: { x: cx, y: textStart + lineH * 2, fontSize: Math.round(h * 0.02), fontColor: "#333333", align: "center", maxWidth: Math.round(w * 0.7), visible: true },
    institution: { x: cx, y: textStart + lineH * 3, fontSize: Math.round(h * 0.017), fontColor: "#333333", align: "center", maxWidth: Math.round(w * 0.75), visible: true },
    credential_code: { x: cx, y: textStart + lineH * 4.5, fontSize: Math.round(h * 0.02), fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: Math.round(w * 0.5), visible: true },
    qr_code: { x: Math.round(cx - qrSize / 2), y: Math.round(h * 0.82), width: qrSize, height: qrSize, visible: true },
  };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  template?: any;
}

export default function CredentialTemplateFormDialog({ open, onOpenChange, eventId, template }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!template;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState("");
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(900);
  const [isActive, setIsActive] = useState(true);
  const [participantTypeFilter, setParticipantTypeFilter] = useState("all");
  const [notes, setNotes] = useState("");
  const [fieldConfig, setFieldConfig] = useState<FieldConfigMap>(buildDefaultFieldConfig(600, 900));
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);

  const { data: event } = useQuery({
    queryKey: ["template-form-event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase.from("events").select("id, name, year").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && open,
  });

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setWidth(template.width);
        setHeight(template.height);
        setIsActive(template.is_active);
        setParticipantTypeFilter(template.participant_type_filter || "all");
        setNotes(template.notes || "");
        setBackgroundUrl(template.background_url);
        setBgPreviewUrl(template.background_url);
        const fc = template.field_config as FieldConfigMap;
        setFieldConfig({ ...buildDefaultFieldConfig(template.width, template.height), ...fc });
      } else {
        setName("");
        setWidth(600);
        setHeight(900);
        setIsActive(true);
        setParticipantTypeFilter("all");
        setNotes("");
        setBackgroundUrl(null);
        setBgPreviewUrl(null);
        setFieldConfig(buildDefaultFieldConfig(600, 900));
      }
      setBackgroundFile(null);
    }
  }, [open, template]);

  // When user picks a new background file, create object URL for preview
  useEffect(() => {
    if (backgroundFile) {
      const url = URL.createObjectURL(backgroundFile);
      setBgPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [backgroundFile]);

  const updateField = (key: string, prop: string, value: any) => {
    setFieldConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [prop]: value },
    }));
  };

  const handleResetPositions = () => {
    setFieldConfig(buildDefaultFieldConfig(width, height));
    toast.info("Posições recalculadas para as dimensões atuais.");
  };

  // --- Live preview rendering ---
  const renderPreview = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const scale = 0.5;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // White base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Background
    if (bgPreviewUrl) {
      try {
        const img = await loadImage(bgPreviewUrl);
        ctx.drawImage(img, 0, 0, width, height);
      } catch {
        drawDefaultBg(ctx, width, height, event);
      }
    } else {
      drawDefaultBg(ctx, width, height, event);
    }

    // Demo data
    const demoData: Record<string, string> = {
      full_name: "NOME DO PARTICIPANTE",
      institution: "NOME DA INSTITUIÇÃO",
      participant_type: "TIPO",
      sport_event: "MODALIDADE / PROVA",
      credential_code: "JER-000000-0000",
    };

    // Draw photo placeholder
    const photoFc = fieldConfig.photo;
    if (photoFc?.visible) {
      const pw = photoFc.width ?? 120;
      const ph = photoFc.height ?? 150;
      ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
      ctx.strokeStyle = "rgba(100, 100, 100, 0.4)";
      ctx.lineWidth = 1;
      ctx.fillRect(photoFc.x, photoFc.y, pw, ph);
      ctx.strokeRect(photoFc.x, photoFc.y, pw, ph);
      ctx.fillStyle = "#666";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FOTO", photoFc.x + pw / 2, photoFc.y + ph / 2);
    }

    // Draw text fields
    for (const [key, value] of Object.entries(demoData)) {
      const fc = fieldConfig[key];
      if (!fc?.visible) continue;
      const fs = fc.fontSize ?? 14;
      const weight = fc.fontWeight ?? "normal";
      ctx.font = `${weight} ${fs}px sans-serif`;
      ctx.fillStyle = fc.fontColor ?? "#000000";
      ctx.textAlign = (fc.align as CanvasTextAlign) ?? "center";
      ctx.textBaseline = "middle";
      ctx.fillText(value, fc.x, fc.y, fc.maxWidth ?? undefined);
    }

    // Draw QR placeholder
    const qrFc = fieldConfig.qr_code;
    if (qrFc?.visible) {
      try {
        const qrDataUrl = await QRCode.toDataURL("demo-qr-preview", {
          width: qrFc.width ?? 100,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
        const qrImg = await loadImage(qrDataUrl);
        ctx.drawImage(qrImg, qrFc.x, qrFc.y, qrFc.width ?? 100, qrFc.height ?? 100);
      } catch { /* ignore */ }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
  }, [width, height, fieldConfig, bgPreviewUrl, event]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(renderPreview, 150);
      return () => clearTimeout(timer);
    }
  }, [open, renderPreview]);

  const isTextfield = (key: string) => !["qr_code", "photo"].includes(key);
  const visualFields = Object.entries(FIELD_META).filter(([, m]) => m.group === "visual");
  const textFields = Object.entries(FIELD_META).filter(([, m]) => m.group === "text");

  // --- Save ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      let bgUrl = backgroundUrl;
      if (backgroundFile) {
        setUploading(true);
        const ext = backgroundFile.name.split(".").pop();
        const path = `${eventId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("credential-templates")
          .upload(path, backgroundFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("credential-templates")
          .getPublicUrl(path);
        bgUrl = urlData.publicUrl;
        setUploading(false);
      }
      const payload = {
        event_id: eventId,
        name,
        width,
        height,
        is_active: isActive,
        notes: notes || null,
        background_url: bgUrl,
        field_config: JSON.parse(JSON.stringify(fieldConfig)),
      };
      if (isEdit) {
        const { error } = await supabase.from("credential_templates").update(payload).eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("credential_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credential-templates"] });
      queryClient.invalidateQueries({ queryKey: ["event-default-template"] });
      toast.success(isEdit ? "Modelo atualizado!" : "Modelo criado!");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setUploading(false);
      toast.error(err.message);
    },
  });

  const renderFieldEditor = (key: string, meta: { label: string; help: string }) => {
    const fc = fieldConfig[key];
    if (!fc) return null;
    const isText = isTextfield(key);
    return (
      <div key={key} className="rounded-md border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{meta.label}</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  <p className="text-xs">{meta.help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Visível</span>
            <Switch checked={fc.visible} onCheckedChange={(v) => updateField(key, "visible", v)} />
          </div>
        </div>
        {fc.visible && (
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">X (px)</Label>
              <Input type="number" value={fc.x ?? 0} onChange={(e) => updateField(key, "x", Number(e.target.value))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Y (px)</Label>
              <Input type="number" value={fc.y ?? 0} onChange={(e) => updateField(key, "y", Number(e.target.value))} className="h-8 text-xs" />
            </div>
            {!isText && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Largura</Label>
                  <Input type="number" value={fc.width ?? 100} onChange={(e) => updateField(key, "width", Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Altura</Label>
                  <Input type="number" value={fc.height ?? 100} onChange={(e) => updateField(key, "height", Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </>
            )}
            {isText && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Fonte (px)</Label>
                  <Input type="number" value={fc.fontSize ?? 14} onChange={(e) => updateField(key, "fontSize", Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cor</Label>
                  <Input type="color" value={fc.fontColor ?? "#000000"} onChange={(e) => updateField(key, "fontColor", e.target.value)} className="h-8 p-1" />
                </div>
              </>
            )}
            {isText && (
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Larg. máx. texto (0 = sem limite)</Label>
                <Input type="number" value={fc.maxWidth ?? 0} onChange={(e) => updateField(key, "maxWidth", Number(e.target.value))} className="h-8 text-xs" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Modelo de Credencial" : "Novo Modelo de Credencial"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Config */}
          <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2">
            {/* Basic info */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome do Modelo</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Credencial Oficial JER 2026" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Largura (px)</Label>
                  <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label>Altura (px)</Label>
                  <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-mono">
                  {width} × {height} px — {width < height ? "Vertical" : width > height ? "Horizontal" : "Quadrado"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleResetPositions}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Recalcular posições
                </Button>
              </div>
            </div>

            {/* Background */}
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Arte Base (fundo)</Label>
                {backgroundUrl && !backgroundFile && (
                  <Badge variant="secondary" className="text-xs">Arte carregada</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Envie a imagem de fundo. Trocar a arte mantém todos os campos configurados — só reajuste o necessário.
              </p>
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent w-fit">
                <Upload className="h-4 w-4" />
                {backgroundFile ? backgroundFile.name : "Escolher arquivo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            {/* Active + Notes */}
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Modelo ativo</Label>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {/* Field configuration with tabs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Campos dinâmicos</Label>
                <span className="text-xs text-muted-foreground">Configure posição e estilo de cada campo</span>
              </div>
              <Tabs defaultValue="visual" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="visual" className="flex-1">Visuais (Foto, QR)</TabsTrigger>
                  <TabsTrigger value="text" className="flex-1">Textos</TabsTrigger>
                </TabsList>
                <TabsContent value="visual" className="space-y-3 mt-3">
                  {visualFields.map(([key, meta]) => renderFieldEditor(key, meta))}
                </TabsContent>
                <TabsContent value="text" className="space-y-3 mt-3">
                  {textFields.map(([key, meta]) => renderFieldEditor(key, meta))}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* RIGHT: Live Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Preview ao vivo</Label>
              <span className="text-xs text-muted-foreground">Dados fictícios de exemplo</span>
            </div>
            <div className="flex justify-center items-start rounded-lg border border-border bg-muted/30 p-4 min-h-[300px]">
              <canvas
                ref={canvasRef}
                className="border shadow-sm bg-white"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Escala reduzida (50%) — a credencial final será gerada em tamanho real ({width}×{height}px).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending || uploading}>
            {(saveMutation.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Criar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Helpers ---
function drawDefaultBg(ctx: CanvasRenderingContext2D, w: number, h: number, event?: { name: string; year: number } | null) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1e3a5f");
  grad.addColorStop(0.15, "#1e3a5f");
  grad.addColorStop(0.15, "#f0f4f8");
  grad.addColorStop(1, "#e8ecf1");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(0, 0, w, Math.round(h * 0.15));

  const eventName = event?.name ?? "EVENTO ESPORTIVO";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(h * 0.026)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(eventName.toUpperCase(), w / 2, Math.round(h * 0.06), w - 40);

  if (event?.year) {
    ctx.font = `${Math.round(h * 0.02)}px sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(String(event.year), w / 2, Math.round(h * 0.1));
  }

  ctx.fillStyle = "#1e3a5f";
  ctx.font = `bold ${Math.round(h * 0.016)}px sans-serif`;
  ctx.fillText("CREDENCIAL OFICIAL", w / 2, Math.round(h * 0.18));

  ctx.fillStyle = "#1e3a5f";
  ctx.fillRect(0, h - 30, w, 30);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "10px sans-serif";
  ctx.fillText("Sistema JER Gestão", w / 2, h - 12);
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
