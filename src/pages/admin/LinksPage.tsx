import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Copy, Download, Search, Loader2, Link2, ExternalLink, Trash2,
  QrCode, Info, Pencil, Bus, UtensilsCrossed, Building, Trophy, Users, Radio, Sparkles, Send, MessageSquare,
  ShieldCheck, Gavel, IdCard, Award, History
} from "lucide-react";

const BASE_URL = window.location.origin;

const MODULE_OPTIONS = [
  { value: "/pwa/transporte", label: "Módulo Transporte", icon: Bus, slug: "transporte", title: "Transporte" },
  { value: "/pwa/alimentacao", label: "Módulo Alimentação", icon: UtensilsCrossed, slug: "alimentacao", title: "Alimentação" },
  { value: "/pwa/alojamento", label: "Módulo Alojamento", icon: Building, slug: "alojamento", title: "Alojamento" },
  { value: "/pwa/coordenacao-tecnica", label: "Módulo Coordenação Técnica", icon: Trophy, slug: "coordenacao", title: "Coordenação Técnica" },
  { value: "/pwa/resultados", label: "Módulo Resultados (Coord. Modalidade)", icon: Award, slug: "resultados", title: "Resultados" },
  { value: "/pwa/delegacao", label: "Módulo Delegação", icon: Users, slug: "delegacao", title: "Delegação" },
  { value: "/pwa/arbitragem", label: "Módulo Arbitragem", icon: ShieldCheck, slug: "arbitragem", title: "Arbitragem" },
  { value: "/pwa/cde", label: "Módulo CDE (Protestos)", icon: Gavel, slug: "cde", title: "CDE" },
  { value: "/pwa/credenciamento", label: "Módulo Credenciamento", icon: IdCard, slug: "credenciamento", title: "Credenciamento" },
  { value: "/aovivo", label: "Módulo Ao Vivo / Mesário", icon: Radio, slug: "aovivo", title: "Ao Vivo" },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function QrCodeCanvas({ value, size = 120 }: { value: string; size?: number }) {
  // Simple QR placeholder using a data URL approach
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-lg border bg-white p-2 flex items-center justify-center"
        style={{ width: size + 16, height: size + 16 }}
      >
        <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ width: size, height: size }}>
          <QrCode className="h-12 w-12 text-primary/60" />
          <span className="text-[10px] mt-1 text-center break-all leading-tight max-w-[100px]">{value}</span>
        </div>
      </div>
    </div>
  );
}

export default function LinksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Wizard state
  const [wizModule, setWizModule] = useState("");
  const [wizTitle, setWizTitle] = useState("");
  const [wizSlug, setWizSlug] = useState("");
  const [wizCreating, setWizCreating] = useState(false);
  const [wizCreated, setWizCreated] = useState<{ slug: string; url: string } | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["public_content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_content")
        .select("*")
        .in("kind", ["external_link", "redirect"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("public_content").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_content").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      toast.success("Link removido");
    },
    onError: () => toast.error("Erro ao remover link"),
  });

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${BASE_URL}/go/${slug}`);
    toast.success("Link copiado!");
  };

  const handleCreate = async () => {
    if (!wizModule || !wizTitle) return;
    setWizCreating(true);
    const slug = wizSlug || generateSlug(wizTitle);
    const { error } = await supabase.from("public_content").insert({
      title: wizTitle,
      slug,
      kind: "redirect",
      destination_url: `${BASE_URL}${wizModule}`,
      active: true,
      visibility: "public",
      open_in_new_tab: false,
    });
    setWizCreating(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "Slug já existe. Escolha outro." : "Erro ao criar link.");
      return;
    }
    setWizCreated({ slug, url: `${BASE_URL}/go/${slug}` });
    queryClient.invalidateQueries({ queryKey: ["public_content"] });
  };

  const autoGenerateLinks = useMutation({
    mutationFn: async () => {
      const existingSlugs = new Set((items || []).map(i => i.slug));
      const toCreate = MODULE_OPTIONS.filter(opt => !existingSlugs.has(opt.slug));
      
      if (toCreate.length === 0) {
        toast.info("Todos os links padrão já existem");
        return;
      }

      const { error } = await supabase.from("public_content").insert(
        toCreate.map(opt => ({
          title: opt.title,
          slug: opt.slug,
          kind: "redirect",
          destination_url: `${BASE_URL}${opt.value}`,
          active: true,
          visibility: "public",
          open_in_new_tab: false,
        }))
      );
      if (error) throw error;
      return toCreate.length;
    },
    onSuccess: (count) => {
      if (count) {
        queryClient.invalidateQueries({ queryKey: ["public_content"] });
        toast.success(`${count} links gerados com sucesso!`);
      }
    },
    onError: (err: any) => {
      toast.error("Erro ao gerar links: " + err.message);
    }
  });

  const resetWizard = () => {
    setWizModule("");
    setWizTitle("");
    setWizSlug("");
    setWizCreated(null);
    setShowCreate(false);
  };

  const copyInstructions = (title: string, slug: string) => {
    const url = `${BASE_URL}/go/${slug}`;
    const text = `*Instruções de Acesso - ${title}*\n\nOlá! Para acessar o sistema operacional, utilize o link abaixo:\n\n🔗 ${url}\n\nO acesso é automático após o login. Recomenda-se salvar este link nos seus favoritos.`;
    navigator.clipboard.writeText(text);
    toast.success("Instruções copiadas para a área de transferência!");
  };

  const filtered = (items || []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1 mb-2">
        <h1 className="text-2xl font-bold text-foreground">Links Externos</h1>
        <p className="text-sm text-muted-foreground">
          Crie e compartilhe links diretos para os módulos PWA operacionais via WhatsApp, email ou SMS.
        </p>
      </div>

      {/* Help section */}
      <div className="rounded-xl border bg-muted/30 p-4 flex gap-3 items-start">
        <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Como funciona?</p>
          <p>Cada link direciona o operador ao módulo correto do aplicativo. Ao clicar, ele faz login (se necessário) e acessa diretamente seu módulo de trabalho.</p>
          <p>Ideal para distribuir acessos via <strong>WhatsApp</strong>, <strong>email</strong> ou <strong>SMS</strong>.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar links..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            onClick={() => autoGenerateLinks.mutate()} 
            disabled={autoGenerateLinks.isPending}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            {autoGenerateLinks.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar Links Padrão
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/auditoria?table=public_content")} className="gap-2">
            <History className="h-4 w-4" /> Auditoria
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Link
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum link criado ainda.</p>
          <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar primeiro link
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border bg-card shadow-app-sm p-4 space-y-3 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">/go/{item.slug}</p>
                </div>
                <Switch
                  checked={item.active}
                  onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, active: checked })}
                />
              </div>

              <QrCodeCanvas value={`/go/${item.slug}`} size={100} />

              <div className="flex items-center gap-1 pt-1 border-t">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => copyLink(item.slug)}>
                  <Link2 className="h-3.5 w-3.5" /> Link
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs flex-1 text-primary hover:text-primary hover:bg-primary/10" onClick={() => copyInstructions(item.title, item.slug)}>
                  <Send className="h-3.5 w-3.5" /> Instruções
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/admin/links/${item.id}`)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Remover este link?")) deleteMutation.mutate(item.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Badge variant={item.active ? "default" : "secondary"} className="text-xs w-fit">
                {item.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Create Wizard Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetWizard(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{wizCreated ? "Link criado!" : "Novo Link Externo"}</DialogTitle>
          </DialogHeader>

          {wizCreated ? (
            <div className="space-y-4 py-2">
              <QrCodeCanvas value={wizCreated.url} size={140} />
              <div className="text-center space-y-1">
                <p className="text-sm font-mono text-muted-foreground break-all">{wizCreated.url}</p>
              </div>
              <Button className="w-full gap-2" onClick={() => { navigator.clipboard.writeText(wizCreated.url); toast.success("Link copiado!"); }}>
                <Copy className="h-4 w-4" /> Copiar Link
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Envie este link via WhatsApp para os operadores acessarem o módulo diretamente.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={resetWizard}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Módulo destino</Label>
                <Select value={wizModule} onValueChange={setWizModule}>
                  <SelectTrigger><SelectValue placeholder="Selecione o módulo..." /></SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Título descritivo</Label>
                <Input
                  placeholder="Ex: Acesso Motoristas JER 2026"
                  value={wizTitle}
                  onChange={(e) => setWizTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug personalizado <span className="text-muted-foreground">(opcional)</span></Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/go/</span>
                  <Input
                    placeholder={wizTitle ? generateSlug(wizTitle) : "ex: motoristas"}
                    value={wizSlug}
                    onChange={(e) => setWizSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetWizard}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={!wizModule || !wizTitle || wizCreating}>
                  {wizCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Link"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
