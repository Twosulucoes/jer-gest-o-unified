import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Copy, Search, Loader2, Link2, Trash2,
  Info, Pencil, Bus, UtensilsCrossed, Building, Trophy, Users, Radio, Sparkles, Send,
  ShieldCheck, Gavel, IdCard, Award, History, MoreVertical,
} from "lucide-react";
import { slugify } from "@/lib/slug";
import { QrCodePreview } from "@/components/admin/links/QrCodePreview";

const getBaseUrl = () => window.location.origin;


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

export default function LinksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: ["public_content"] });
      const previous = queryClient.getQueryData<any[]>(["public_content"]);
      queryClient.setQueryData<any[]>(["public_content"], (old) =>
        (old || []).map((it) => (it.id === id ? { ...it, active } : it))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["public_content"], context.previous);
      toast.error("Erro ao atualizar status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
    },
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
    navigator.clipboard.writeText(`${getBaseUrl()}/go/${slug}`);
    toast.success("Link copiado!");
  };

  const handleCreate = async () => {
    if (!wizModule || !wizTitle) return;
    setWizCreating(true);
    const slug = wizSlug || slugify(wizTitle);
    const { error } = await supabase.from("public_content").insert({
      title: wizTitle,
      slug,
      kind: "redirect",
      destination_url: wizModule,
      active: true,
      visibility: "public",
      open_in_new_tab: false,
    });
    setWizCreating(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "Slug já existe. Escolha outro." : "Erro ao criar link.");
      return;
    }
    setWizCreated({ slug, url: `${getBaseUrl()}/go/${slug}` });
    queryClient.invalidateQueries({ queryKey: ["public_content"] });
  };

  const autoGenerateLinks = useMutation({
    mutationFn: async () => {
      // Upsert idempotente: cria os que faltam sem quebrar em colisão de slug.
      const payload = MODULE_OPTIONS.map((opt) => ({
        title: opt.title,
        slug: opt.slug,
        kind: "redirect",
        destination_url: opt.value,
        active: true,
        visibility: "public",
        open_in_new_tab: false,
      }));
      const { data, error } = await supabase
        .from("public_content")
        .upsert(payload, { onConflict: "kind,slug", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      if (count > 0) toast.success(`${count} link(s) gerados com sucesso!`);
      else toast.info("Todos os links padrão já existem");
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
    const url = `${getBaseUrl()}/go/${slug}`;
    const text = `*Instruções de Acesso - ${title}*\n\nOlá! Para acessar o sistema operacional, utilize o link abaixo:\n\n🔗 ${url}\n\nO acesso é automático após o login. Recomenda-se salvar este link nos seus favoritos.`;
    navigator.clipboard.writeText(text);
    toast.success("Instruções copiadas para a área de transferência!");
  };

  const filtered = useMemo(() => {
    return (items || []).filter((item) => {
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "inactive" && item.active) return false;
      if (moduleFilter !== "all") {
        const opt = MODULE_OPTIONS.find((o) => o.slug === moduleFilter);
        if (!opt || item.destination_url !== opt.value) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.slug.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, moduleFilter, search]);

  const counts = useMemo(() => {
    const total = (items || []).length;
    const active = (items || []).filter((i) => i.active).length;
    return { total, active, inactive: total - active };
  }, [items]);

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

      {/* Toolbar: search + filters + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-48"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({counts.total})</SelectItem>
              <SelectItem value="active">Ativos ({counts.active})</SelectItem>
              <SelectItem value="inactive">Inativos ({counts.inactive})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os módulos</SelectItem>
              {MODULE_OPTIONS.map((opt) => (
                <SelectItem key={opt.slug} value={opt.slug}>{opt.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <p className="text-muted-foreground">
            {(items || []).length === 0 ? "Nenhum link criado ainda." : "Nenhum link corresponde aos filtros."}
          </p>
          {(items || []).length === 0 && (
            <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Criar primeiro link
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card shadow-app-sm p-4 space-y-3 flex flex-col transition-opacity ${
                item.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">/go/{item.slug}</p>
                </div>
                <Switch
                  checked={item.active}
                  onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, active: checked })}
                  aria-label={item.active ? "Desativar link" : "Ativar link"}
                />
              </div>

              <QrCodePreview value={`${getBaseUrl()}/go/${item.slug}`} size={100} filename={`qr-${item.slug}`} showDownload />

              <div className="flex items-center gap-1 pt-1 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs flex-1"
                  onClick={() => copyLink(item.slug)}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs flex-1 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => copyInstructions(item.title, item.slug)}
                >
                  <Send className="h-3.5 w-3.5" /> Instruções
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Mais ações" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/admin/links/${item.id}`)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/admin/auditoria?table=public_content&search=${item.id}`)}>
                      <History className="h-4 w-4 mr-2" /> Histórico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteId(item.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover link?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Operadores que tenham o link salvo não conseguirão mais acessar o módulo por este endereço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Create Wizard Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetWizard(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{wizCreated ? "Link criado!" : "Novo Link Externo"}</DialogTitle>
          </DialogHeader>

          {wizCreated ? (
            <div className="space-y-4 py-2">
              <QrCodePreview value={wizCreated.url} size={140} />
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
                    placeholder={wizTitle ? slugify(wizTitle) : "ex: motoristas"}
                    value={wizSlug}
                    onChange={(e) => setWizSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  />
                </div>
                {(wizSlug || wizTitle) && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {getBaseUrl()}/go/{wizSlug || slugify(wizTitle)}
                  </p>
                )}
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
