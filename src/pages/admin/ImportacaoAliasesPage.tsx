import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Search, Trash2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type AliasKind = "sport" | "category" | "participant_type" | "status";

interface AliasRow {
  id: string;
  kind: AliasKind;
  alias_norm: string;
  canonical_slug: string;
  event_id: string | null;
  notes: string | null;
  updated_at: string;
}

const KIND_LABEL: Record<AliasKind, string> = {
  sport: "Modalidade",
  category: "Categoria",
  participant_type: "Tipo de Participante",
  status: "Status",
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

export default function ImportacaoAliasesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("secretaria" as any);
  const canDelete = hasRole("admin");

  const [rows, setRows] = useState<AliasRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<AliasKind>("sport");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState<{ kind: AliasKind; alias_norm: string; canonical_slug: string; notes: string }>({
    kind: "sport",
    alias_norm: "",
    canonical_slug: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("import_aliases")
      .select("*")
      .order("kind", { ascending: true })
      .order("alias_norm", { ascending: true });
    if (error) {
      toast.error("Falha ao carregar aliases: " + error.message);
    } else {
      setRows((data ?? []) as AliasRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows
      .filter((r) => r.kind === tab)
      .filter((r) =>
        !f ||
        r.alias_norm.toLowerCase().includes(f) ||
        r.canonical_slug.toLowerCase().includes(f),
      );
  }, [rows, tab, filter]);

  const counts = useMemo(() => {
    const c: Record<AliasKind, number> = { sport: 0, category: 0, participant_type: 0, status: 0 };
    rows.forEach((r) => { c[r.kind]++; });
    return c;
  }, [rows]);

  async function handleSave() {
    if (!form.alias_norm.trim() || !form.canonical_slug.trim()) {
      toast.error("Preencha alias e slug canônico.");
      return;
    }
    setSaving(true);
    const aliasNorm = normalize(form.alias_norm);
    const { error } = await supabase.from("import_aliases").insert({
      kind: form.kind,
      alias_norm: aliasNorm,
      canonical_slug: form.canonical_slug.trim().toLowerCase(),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success(`Alias "${aliasNorm}" → ${form.canonical_slug} criado.`);
    setForm({ kind: tab, alias_norm: "", canonical_slug: "", notes: "" });
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este alias?")) return;
    const { error } = await supabase.from("import_aliases").delete().eq("id", id);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Alias excluído.");
    load();
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Sinônimos da Importação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dicionário editável usado pelo importador SIGECOM para reconhecer variações de nomes.
          </p>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm((f) => ({ ...f, kind: tab }))}>
                <Plus className="h-4 w-4 mr-1" /> Novo alias
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo alias</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as AliasKind }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABEL) as AliasKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alias (texto bruto da planilha)</Label>
                  <Input
                    placeholder='ex: "FUTEBOL DE SALAO"'
                    value={form.alias_norm}
                    onChange={(e) => setForm((f) => ({ ...f, alias_norm: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Será normalizado automaticamente: sem acento, maiúsculo, espaços simples.
                  </p>
                </div>
                <div>
                  <Label>Slug canônico</Label>
                  <Input
                    placeholder='ex: "futsal", "athlete", "deferida"'
                    value={form.canonical_slug}
                    onChange={(e) => setForm((f) => ({ ...f, canonical_slug: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Observação (opcional)</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Quando o importador encontra um nome novo que não está nesta lista, ele cai em
          <strong> pendências</strong> em vez de bloquear o lote inteiro. Cadastre o alias aqui
          e reprocesse a planilha.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Aliases cadastrados</CardTitle>
          <CardDescription>
            {rows.length} no total · sport: {counts.sport} · category: {counts.category} ·
            participant_type: {counts.participant_type} · status: {counts.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as AliasKind)}>
            <TabsList>
              {(Object.keys(KIND_LABEL) as AliasKind[]).map((k) => (
                <TabsTrigger key={k} value={k}>
                  {KIND_LABEL[k]} <Badge variant="secondary" className="ml-1.5">{counts[k]}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {(Object.keys(KIND_LABEL) as AliasKind[]).map((k) => (
              <TabsContent key={k} value={k} className="space-y-3">
                <div className="relative max-w-md">
                  <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2">Alias</th>
                        <th className="text-left px-3 py-2">→ Canônico</th>
                        <th className="text-left px-3 py-2">Escopo</th>
                        <th className="text-left px-3 py-2">Observação</th>
                        {canDelete && <th className="px-3 py-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loading && (
                        <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</td></tr>
                      )}
                      {!loading && filtered.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum alias encontrado.</td></tr>
                      )}
                      {filtered.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-xs">{r.alias_norm}</td>
                          <td className="px-3 py-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.canonical_slug}</code>
                          </td>
                          <td className="px-3 py-2">
                            {r.event_id
                              ? <Badge variant="outline">evento</Badge>
                              : <Badge variant="secondary">global</Badge>}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                          {canDelete && (
                            <td className="px-3 py-2">
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
