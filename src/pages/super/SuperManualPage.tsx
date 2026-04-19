import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Edit, Trash2, BookOpen, ArrowUp, ArrowDown, Save } from "lucide-react";

interface Section {
  id: string;
  category: string;
  title: string;
  content_md: string;
  sort_order: number;
  is_published: boolean;
  updated_at: string;
}

const EMPTY: Partial<Section> = {
  category: "Geral",
  title: "",
  content_md: "",
  sort_order: 100,
  is_published: true,
};

export default function SuperManualPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Section> | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("help_manual_sections")
      .select("*")
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setSections((data ?? []) as Section[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing?.title?.trim() || !editing?.category?.trim()) {
      toast.error("Categoria e título são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      category: editing.category!.trim(),
      title: editing.title!.trim(),
      content_md: editing.content_md ?? "",
      sort_order: editing.sort_order ?? 100,
      is_published: editing.is_published ?? true,
    };
    const { error } = editing.id
      ? await (supabase as any).from("help_manual_sections").update(payload).eq("id", editing.id)
      : await (supabase as any).from("help_manual_sections").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Seção salva");
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta seção do manual?")) return;
    const { error } = await (supabase as any).from("help_manual_sections").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Seção excluída");
    load();
  }

  async function reorder(sec: Section, delta: number) {
    const { error } = await (supabase as any)
      .from("help_manual_sections")
      .update({ sort_order: sec.sort_order + delta })
      .eq("id", sec.id);
    if (error) toast.error(error.message);
    else load();
  }

  const categories = Array.from(new Set(sections.map((s) => s.category))).sort();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Manual de Instruções
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conteúdo exibido em <code>/admin/ajuda/manual</code> e usado como base do Chat de IA.
          </p>
        </div>
        <Button onClick={() => setEditing(EMPTY)}>
          <Plus className="h-4 w-4 mr-2" /> Nova seção
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : sections.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma seção cadastrada ainda. Clique em "Nova seção" para começar.
        </CardContent></Card>
      ) : (
        categories.map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-primary">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sections.filter((s) => s.category === cat).map((s) => (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => reorder(s, -10)} className="text-muted-foreground hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => reorder(s, 10)} className="text-muted-foreground hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className="text-[10px]">#{s.sort_order}</Badge>
                      {!s.is_published && <Badge variant="secondary" className="text-[10px]">rascunho</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {s.content_md.slice(0, 200) || "(sem conteúdo)"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar seção" : "Nova seção"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Categoria</Label>
                    <Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Ex.: 3. Painel Administrativo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ordem</Label>
                    <Input type="number" value={editing.sort_order ?? 100} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 100 })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Ex.: 3.5 Credenciamento" />
                </div>
                <div className="space-y-1.5">
                  <Label>Conteúdo (Markdown)</Label>
                  <Textarea
                    value={editing.content_md ?? ""}
                    onChange={(e) => setEditing({ ...editing, content_md: e.target.value })}
                    rows={16}
                    className="font-mono text-sm"
                    placeholder="Suporta **negrito**, *itálico*, listas, tabelas, `código`, etc."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_published ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_published: v })} />
                  <Label>Publicado (visível para usuários e Chat de IA)</Label>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
