import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

interface FieldConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontColor?: string;
  align?: string;
  visible: boolean;
}

interface FieldConfigMap {
  [key: string]: FieldConfig;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome Completo",
  institution: "Instituição / Delegação",
  participant_type: "Tipo de Participante",
  sport_event: "Modalidade / Prova",
  credential_code: "Código da Credencial",
  qr_code: "QR Code",
  photo: "Foto",
};

const DEFAULT_FIELD_CONFIG: FieldConfigMap = {
  full_name: { x: 300, y: 180, fontSize: 24, fontColor: "#000000", align: "center", visible: true },
  institution: { x: 300, y: 220, fontSize: 14, fontColor: "#333333", align: "center", visible: true },
  participant_type: { x: 300, y: 250, fontSize: 12, fontColor: "#666666", align: "center", visible: true },
  sport_event: { x: 300, y: 270, fontSize: 12, fontColor: "#666666", align: "center", visible: true },
  credential_code: { x: 300, y: 350, fontSize: 10, fontColor: "#999999", align: "center", visible: true },
  qr_code: { x: 250, y: 290, width: 100, height: 100, visible: true },
  photo: { x: 250, y: 40, width: 100, height: 120, visible: false },
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

  const [name, setName] = useState("");
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [fieldConfig, setFieldConfig] = useState<FieldConfigMap>(DEFAULT_FIELD_CONFIG);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setWidth(template.width);
        setHeight(template.height);
        setIsActive(template.is_active);
        setNotes(template.notes || "");
        setBackgroundUrl(template.background_url);
        const fc = template.field_config as FieldConfigMap;
        setFieldConfig({ ...DEFAULT_FIELD_CONFIG, ...fc });
      } else {
        setName("");
        setWidth(600);
        setHeight(400);
        setIsActive(true);
        setNotes("");
        setBackgroundUrl(null);
        setFieldConfig(DEFAULT_FIELD_CONFIG);
      }
      setBackgroundFile(null);
    }
  }, [open, template]);

  const updateField = (key: string, prop: string, value: any) => {
    setFieldConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [prop]: value },
    }));
  };

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
        field_config: fieldConfig as unknown as Record<string, unknown>,
      };

      if (isEdit) {
        const { error } = await supabase
          .from("credential_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("credential_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credential-templates"] });
      toast.success(isEdit ? "Modelo atualizado!" : "Modelo criado!");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setUploading(false);
      toast.error(err.message);
    },
  });

  const isTextfield = (key: string) => !["qr_code", "photo"].includes(key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Modelo" : "Novo Modelo de Credencial"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome do Modelo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Credencial Oficial JER 2026" />
            </div>
            <div className="space-y-2">
              <Label>Largura (px)</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Altura (px)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Arte Base</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {backgroundFile ? backgroundFile.name : "Escolher arquivo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {backgroundUrl && !backgroundFile && (
                <span className="text-xs text-muted-foreground">Arte atual carregada</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Modelo ativo</Label>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="fields">
              <AccordionTrigger className="text-sm font-medium">
                Configuração dos campos dinâmicos
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {Object.entries(FIELD_LABELS).map(([key, label]) => (
                    <div key={key} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Visível</span>
                          <Switch
                            checked={fieldConfig[key]?.visible ?? false}
                            onCheckedChange={(v) => updateField(key, "visible", v)}
                          />
                        </div>
                      </div>
                      {fieldConfig[key]?.visible && (
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label className="text-xs">X</Label>
                            <Input
                              type="number"
                              value={fieldConfig[key]?.x ?? 0}
                              onChange={(e) => updateField(key, "x", Number(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Y</Label>
                            <Input
                              type="number"
                              value={fieldConfig[key]?.y ?? 0}
                              onChange={(e) => updateField(key, "y", Number(e.target.value))}
                              className="h-8 text-xs"
                            />
                          </div>
                          {!isTextfield(key) && (
                            <>
                              <div>
                                <Label className="text-xs">Larg.</Label>
                                <Input
                                  type="number"
                                  value={fieldConfig[key]?.width ?? 100}
                                  onChange={(e) => updateField(key, "width", Number(e.target.value))}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Alt.</Label>
                                <Input
                                  type="number"
                                  value={fieldConfig[key]?.height ?? 100}
                                  onChange={(e) => updateField(key, "height", Number(e.target.value))}
                                  className="h-8 text-xs"
                                />
                              </div>
                            </>
                          )}
                          {isTextfield(key) && (
                            <>
                              <div>
                                <Label className="text-xs">Fonte</Label>
                                <Input
                                  type="number"
                                  value={fieldConfig[key]?.fontSize ?? 14}
                                  onChange={(e) => updateField(key, "fontSize", Number(e.target.value))}
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Cor</Label>
                                <Input
                                  type="color"
                                  value={fieldConfig[key]?.fontColor ?? "#000000"}
                                  onChange={(e) => updateField(key, "fontColor", e.target.value)}
                                  className="h-8 p-1"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending || uploading}>
            {(saveMutation.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
