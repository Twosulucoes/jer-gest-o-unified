import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Trash2, Save, Eye, History } from "lucide-react";


function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const SLUG_REGEX = /^[a-z0-9-]{3,64}$/;

export default function LinkFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "novo";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [kind, setKind] = useState("external_link");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [active, setActive] = useState(true);
  const [visibility, setVisibility] = useState("public");
  const [sortOrder, setSortOrder] = useState(0);
  const [tagsStr, setTagsStr] = useState("");

  const { data: existing, isLoading } = useQuery({
    queryKey: ["public_content", id],
    queryFn: async () => {
      if (isNew) return null;
      const { data, error } = await supabase.from("public_content").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existing) {
      setKind(existing.kind);
      setTitle(existing.title);
      setSlug(existing.slug);
      setSlugTouched(true);
      setDescription(existing.description || "");
      setDestinationUrl(existing.destination_url || "");
      setContentMd(existing.content_md || "");
      setOpenInNewTab(existing.open_in_new_tab);
      setActive(existing.active);
      setVisibility(existing.visibility);
      setSortOrder(existing.sort_order);
      setTagsStr((existing.tags || []).join(", "));
    }
  }, [existing]);

  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, slugTouched]);

  const needsUrl = kind === "external_link" || kind === "redirect";
  const needsMd = kind === "public_page";

  const isUrlValid = !needsUrl || /^https?:\/\/.+/.test(destinationUrl);
  const isSlugValid = SLUG_REGEX.test(slug);
  const canSave = title.trim() && isSlugValid && isUrlValid && (!needsMd || contentMd.trim());

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        kind,
        title: title.trim(),
        slug,
        description: description.trim() || null,
        destination_url: needsUrl ? destinationUrl.trim() : null,
        content_md: needsMd ? contentMd : null,
        open_in_new_tab: needsUrl ? openInNewTab : true,
        active,
        visibility,
        sort_order: sortOrder,
        tags: tags.length > 0 ? tags : null,
        updated_by: user?.id || null,
      };

      if (isNew) {
        const { error } = await supabase.from("public_content").insert({ ...payload, created_by: user?.id || null });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("public_content").update(payload).eq("id", id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      toast.success(isNew ? "Criado com sucesso!" : "Salvo com sucesso!");
      navigate("/admin/links");
    },
    onError: (err: any) => {
      if (err?.message?.includes("uq_public_content_kind_slug")) {
        toast.error("Este slug já existe para este tipo. Escolha outro.");
      } else {
        toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("public_content").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      toast.success("Excluído!");
      navigate("/admin/links");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-bold text-foreground">{isNew ? "Novo Link / Página" : "Editar Link / Página"}</h1>
        <p className="text-sm text-muted-foreground">Configure os detalhes do conteúdo público.</p>
      </div>

      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/links")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <Card>
        <CardHeader><CardTitle>Dados</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="external_link">Link Externo</SelectItem>
                  <SelectItem value="public_page">Página Pública</SelectItem>
                  <SelectItem value="redirect">Redirect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilidade</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="unlisted">Não listado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: PWA Transporte" />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="ex: pwa-transporte"
              className={!isSlugValid && slug ? "border-destructive" : ""}
            />
            {!isSlugValid && slug && <p className="text-xs text-destructive">Slug deve ter 3-64 caracteres (a-z, 0-9, hifens)</p>}
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {needsUrl && (
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <Input
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://..."
                className={!isUrlValid && destinationUrl ? "border-destructive" : ""}
              />
              {!isUrlValid && destinationUrl && <p className="text-xs text-destructive">URL deve começar com http:// ou https://</p>}
            </div>
          )}

          {needsUrl && (
            <div className="flex items-center gap-3">
              <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} />
              <Label>Abrir em nova aba</Label>
            </div>
          )}

          {needsMd && (
            <div className="space-y-2">
              <Label>Conteúdo (Markdown)</Label>
              <Textarea
                value={contentMd}
                onChange={(e) => setContentMd(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="# Título&#10;&#10;Conteúdo em Markdown..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="pwa, oficial" />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-between">
        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          {needsMd && !isNew && (
            <Button variant="outline" onClick={() => navigate(`/admin/links/preview/${id}`)} className="gap-2">
              <Eye className="h-4 w-4" /> Preview
            </Button>
          )}
        </div>

        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" /> Excluir</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir conteúdo?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
