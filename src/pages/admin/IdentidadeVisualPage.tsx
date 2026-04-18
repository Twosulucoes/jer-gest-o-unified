import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useEventBranding, type BrandingLogoWithUrl } from "@/hooks/useEventBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Loader2, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import ReportHeader from "@/components/relatorios/ReportHeader";

const MAX_LOGOS = 3;
const MAX_BYTES = 500 * 1024;
const ALLOWED = ["image/png", "image/jpeg"];

interface LogoSlot {
  path: string;
  label: string;
  active: boolean;
  order: number;
  url: string;
}

function emptySlot(order: number): LogoSlot {
  return { path: "", label: "", active: true, order, url: "" };
}

function publicUrl(path: string): string {
  if (!path) return "";
  return supabase.storage.from("report-assets").getPublicUrl(path).data.publicUrl;
}

export default function IdentidadeVisualPage() {
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const { data, isLoading } = useEventBranding(eventId);

  const [logos, setLogos] = useState<LogoSlot[]>(() =>
    Array.from({ length: MAX_LOGOS }, (_, i) => emptySlot(i + 1)),
  );
  const [nomeOficial, setNomeOficial] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [rodapeTexto, setRodapeTexto] = useState("");
  const [localAno, setLocalAno] = useState("");
  const [assinaturaNome, setAssinaturaNome] = useState("");
  const [assinaturaCargo, setAssinaturaCargo] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Hidrata estado quando dados chegam
  useEffect(() => {
    if (!data) return;
    const filled = Array.from({ length: MAX_LOGOS }, (_, i) => emptySlot(i + 1));
    data.logos.forEach((l, i) => {
      if (i < MAX_LOGOS) {
        filled[i] = {
          path: l.path,
          label: l.label ?? "",
          active: l.active ?? true,
          order: l.order ?? i + 1,
          url: l.url,
        };
      }
    });
    filled.sort((a, b) => a.order - b.order);
    filled.forEach((l, i) => (l.order = i + 1));
    setLogos(filled);
    setNomeOficial(data.nome_oficial ?? "");
    setSubtitulo(data.subtitulo ?? "");
    setRodapeTexto(data.rodape_texto ?? "");
    setLocalAno(data.local_ano ?? "");
    setAssinaturaNome(data.assinatura_nome ?? "");
    setAssinaturaCargo(data.assinatura_cargo ?? "");
  }, [data]);

  const previewLogos: BrandingLogoWithUrl[] = useMemo(
    () =>
      logos
        .filter((l) => l.path && l.url)
        .sort((a, b) => a.order - b.order)
        .map((l) => ({ path: l.path, label: l.label, active: l.active, order: l.order, url: l.url })),
    [logos],
  );

  function updateSlot(idx: number, patch: Partial<LogoSlot>) {
    setLogos((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function moveSlot(idx: number, dir: -1 | 1) {
    setLogos((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      next.forEach((s, i) => (s.order = i + 1));
      return next;
    });
  }

  async function handleUpload(idx: number, file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Formato inválido", { description: "Aceitos: PNG ou JPG." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", { description: "Tamanho máximo: 500 KB." });
      return;
    }
    setUploadingIdx(idx);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${eventId}/logo-${idx + 1}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("report-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;

      // Remove arquivo antigo (se houver) para não acumular lixo
      const old = logos[idx].path;
      if (old && old !== path) {
        await supabase.storage.from("report-assets").remove([old]).catch(() => null);
      }

      updateSlot(idx, { path, url: publicUrl(path) });
      toast.success("Logo carregado");
    } catch (err: any) {
      toast.error("Falha no upload", { description: err.message ?? String(err) });
    } finally {
      setUploadingIdx(null);
    }
  }

  async function handleRemove(idx: number) {
    const path = logos[idx].path;
    if (path) {
      await supabase.storage.from("report-assets").remove([path]).catch(() => null);
    }
    updateSlot(idx, { path: "", url: "", label: "" });
  }

  async function handleSave() {
    if (!eventId) {
      toast.error("Selecione um evento ativo.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const payload = {
        event_id: eventId,
        logos: logos
          .filter((l) => l.path)
          .map((l) => ({ path: l.path, label: l.label, active: l.active, order: l.order })),
        nome_oficial: nomeOficial || null,
        subtitulo: subtitulo || null,
        rodape_texto: rodapeTexto || null,
        local_ano: localAno || null,
        assinatura_nome: assinaturaNome || null,
        assinatura_cargo: assinaturaCargo || null,
        updated_by: userId,
        ...(data?.updated_at ? {} : { created_by: userId }),
      };

      const { error } = await supabase
        .from("event_branding")
        .upsert(payload, { onConflict: "event_id" });
      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["event-branding", eventId] });
      toast.success("Configuração salva");
    } catch (err: any) {
      toast.error("Falha ao salvar", { description: err.message ?? String(err) });
    } finally {
      setSaving(false);
    }
  }

  if (!eventId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Selecione um evento ativo para configurar a identidade visual.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <header>
        <h1 className="font-heading text-2xl font-bold">Identidade Visual do Evento</h1>
        <p className="text-sm text-muted-foreground">
          Configure logos e textos institucionais que aparecerão em todos os relatórios oficiais.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Logos do Evento</CardTitle>
              <CardDescription>Até 3 logos. Aceita PNG ou JPG, máx. 500 KB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logos.map((slot, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 border border-border rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-24 w-32 flex items-center justify-center bg-muted rounded border border-border overflow-hidden">
                      {slot.url ? (
                        <img src={slot.url} alt={slot.label} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem imagem</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(idx, f);
                            e.target.value = "";
                          }}
                        />
                        <Button asChild variant="outline" size="sm" disabled={uploadingIdx === idx}>
                          <span>
                            {uploadingIdx === idx ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </Button>
                      </label>
                      {slot.path && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div>
                      <Label htmlFor={`label-${idx}`}>Rótulo</Label>
                      <Input
                        id={`label-${idx}`}
                        value={slot.label}
                        onChange={(e) => updateSlot(idx, { label: e.target.value })}
                        placeholder='Ex: "Governo de Roraima"'
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slot.active}
                        onCheckedChange={(v) => updateSlot(idx, { active: v })}
                        id={`active-${idx}`}
                      />
                      <Label htmlFor={`active-${idx}`} className="text-sm">
                        Ativo (aparece nos relatórios)
                      </Label>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center justify-center gap-1">
                    <span className="text-xs text-muted-foreground">#{slot.order}</span>
                    <Button variant="ghost" size="icon" onClick={() => moveSlot(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveSlot(idx, 1)}
                      disabled={idx === logos.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações do Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome oficial</Label>
                <Input
                  id="nome"
                  value={nomeOficial}
                  onChange={(e) => setNomeOficial(e.target.value)}
                  placeholder="Ex: 53º Jogos Escolares de Roraima"
                />
              </div>
              <div>
                <Label htmlFor="sub">Subtítulo (opcional)</Label>
                <Input
                  id="sub"
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  placeholder="Ex: 1º Jogos Escolares Paralímpicos de Roraima"
                />
              </div>
              <div>
                <Label htmlFor="rodape">Texto de rodapé institucional</Label>
                <Textarea
                  id="rodape"
                  value={rodapeTexto}
                  onChange={(e) => setRodapeTexto(e.target.value)}
                  placeholder="Ex: IDJUV — Instituto de Desporto, Juventude e Lazer de Roraima"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="localAno">Local e ano</Label>
                <Input
                  id="localAno"
                  value={localAno}
                  onChange={(e) => setLocalAno(e.target.value)}
                  placeholder="Ex: Boa Vista/RR — 2026"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assinatura para Relatórios Formais</CardTitle>
              <CardDescription>Usada em documentos como prestação de contas (OSC).</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aname">Nome do responsável</Label>
                <Input
                  id="aname"
                  value={assinaturaNome}
                  onChange={(e) => setAssinaturaNome(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="acargo">Cargo</Label>
                <Input
                  id="acargo"
                  value={assinaturaCargo}
                  onChange={(e) => setAssinaturaCargo(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configuração
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização do cabeçalho</CardTitle>
              <CardDescription>Reflete em tempo real o estado atual do formulário.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-card p-6 rounded-lg border border-border">
                <ReportHeader
                  override={{
                    logos: previewLogos,
                    nome_oficial: nomeOficial || null,
                    subtitulo: subtitulo || null,
                    fallbackEventName: data?.fallbackEventName,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
