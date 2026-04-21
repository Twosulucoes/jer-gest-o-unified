import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Settings, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { brand } from "@/theme/brand";
import { dispatchGlobalRefresh } from "@/lib/systemRefresh";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export default function SuperConfigPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [brandingForm, setBrandingForm] = useState({
    system_name: "",
    subtitle: "",
    footer_text: "",
    developer_name: "",
    developer_role: "",
    developer_logo_url: "",
    version: "",
  });

  const { data: configs, isLoading } = useQuery({
    queryKey: ["super-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .order("key");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, key, value }: { id: string | null; key: string; value: string }) => {
      const parsed = JSON.parse(value);
      if (id) {
        const { error } = await supabase.from("system_config").update({ key, value: parsed }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_config").insert({ key, value: parsed });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-config"] });
      setDialogOpen(false);
      toast({ title: "Configuração salva" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-config"] });
      toast({ title: "Configuração removida" });
    },
  });

  const saveBrandingMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...brandingForm,
        updated_at: new Date().toISOString(),
      };
      const existing = (configs ?? []).find((c) => c.key === "system_branding");
      if (existing) {
        const { error } = await supabase.from("system_config").update({ value: payload }).eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("system_config").insert({ key: "system_branding", value: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-config"] });
      toast({ title: "Branding global salvo" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar branding", description: e.message, variant: "destructive" });
    },
  });

  const refreshAllMutation = useMutation({
    mutationFn: dispatchGlobalRefresh,
    onSuccess: () => {
      toast({ title: "Refresh global enviado", description: "Todas as máquinas conectadas irão recarregar." });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao enviar refresh", description: e.message, variant: "destructive" });
    },
  });

  const openNew = () => {
    setEditId(null);
    setEditKey("");
    setEditValue("{}");
    setDialogOpen(true);
  };

  const openEdit = (config: { id: string; key: string; value: unknown }) => {
    setEditId(config.id);
    setEditKey(config.key);
    setEditValue(JSON.stringify(config.value, null, 2));
    setDialogOpen(true);
  };

  const applyInstitutionalPreset = () => {
    setBrandingForm({
      system_name: brand.brandName,
      subtitle: "Plataforma de Gestão do JERs",
      footer_text: `${brand.brandName} • Plataforma de Gestão do JERs • Desenvolvido por ${brand.developer.name}`,
      developer_name: brand.developer.name,
      developer_role: brand.developer.role,
      developer_logo_url: "",
      version: "1.0.0",
    });
  };

  const handleSave = () => {
    try {
      JSON.parse(editValue);
    } catch {
      toast({ title: "JSON inválido", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: editId, key: editKey, value: editValue });
  };

  const applySystemBrandingIntoForm = () => {
    const cfg = (configs ?? []).find((c) => c.key === "system_branding");
    const raw = (cfg?.value ?? {}) as Record<string, unknown>;
    setBrandingForm({
      system_name: String(raw.system_name ?? ""),
      subtitle: String(raw.subtitle ?? ""),
      footer_text: String(raw.footer_text ?? ""),
      developer_name: String(raw.developer_name ?? ""),
      developer_role: String(raw.developer_role ?? ""),
      developer_logo_url: String(raw.developer_logo_url ?? ""),
      version: String(raw.version ?? ""),
    });
  };

  useEffect(() => {
    if (!configs) return;
    const isEmpty =
      !brandingForm.system_name &&
      !brandingForm.subtitle &&
      !brandingForm.footer_text &&
      !brandingForm.developer_name &&
      !brandingForm.developer_role &&
      !brandingForm.developer_logo_url &&
      !brandingForm.version;
    if (!isEmpty) return;
    const cfg = configs.find((c) => c.key === "system_branding");
    if (!cfg) return;
    const raw = (cfg.value ?? {}) as Record<string, unknown>;
    setBrandingForm({
      system_name: String(raw.system_name ?? ""),
      subtitle: String(raw.subtitle ?? ""),
      footer_text: String(raw.footer_text ?? ""),
      developer_name: String(raw.developer_name ?? ""),
      developer_role: String(raw.developer_role ?? ""),
      developer_logo_url: String(raw.developer_logo_url ?? ""),
      version: String(raw.version ?? ""),
    });
  }, [configs, brandingForm.system_name, brandingForm.subtitle, brandingForm.footer_text, brandingForm.developer_name, brandingForm.developer_role, brandingForm.developer_logo_url, brandingForm.version]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurações Globais</h1>
          <p className="text-sm text-zinc-400 mt-1">Feature flags, limites e parâmetros do sistema.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshAllMutation.mutate()}
              disabled={refreshAllMutation.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh global
            </Button>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew} className="bg-amber-500 text-black hover:bg-amber-400">
                <Plus className="mr-2 h-4 w-4" />
                Nova Config
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Configuração" : "Nova Configuração"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Chave</Label>
                <Input value={editKey} onChange={(e) => setEditKey(e.target.value)} placeholder="ex: feature_flags" />
              </div>
              <div>
                <Label>Valor (JSON)</Label>
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder='{"enabled": true}'
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={!editKey || saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personalização do Sistema (Super Admin)</CardTitle>
          <CardDescription>
            Configure nome, propriedade/desenvolvedora, versão e logo da Two Soluções em uma chave global
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">system_branding</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do sistema</Label>
              <Input
                value={brandingForm.system_name}
                onChange={(e) => setBrandingForm((v) => ({ ...v, system_name: e.target.value }))}
                placeholder="Ex: JER Gestão"
              />
            </div>
            <div className="space-y-2">
              <Label>Versão</Label>
              <Input
                value={brandingForm.version}
                onChange={(e) => setBrandingForm((v) => ({ ...v, version: e.target.value }))}
                placeholder="Ex: 1.0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Input
              value={brandingForm.subtitle}
              onChange={(e) => setBrandingForm((v) => ({ ...v, subtitle: e.target.value }))}
              placeholder="Ex: Plataforma oficial de gestão dos Jogos Escolares"
            />
          </div>

          <div className="space-y-2">
            <Label>Rodapé</Label>
            <Textarea
              rows={2}
              value={brandingForm.footer_text}
              onChange={(e) => setBrandingForm((v) => ({ ...v, footer_text: e.target.value }))}
              placeholder="Texto exibido no rodapé dos materiais."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Desenvolvedora (Nome)</Label>
              <Input
                value={brandingForm.developer_name}
                onChange={(e) => setBrandingForm((v) => ({ ...v, developer_name: e.target.value }))}
                placeholder="Ex: Two Soluções"
              />
            </div>
            <div className="space-y-2">
              <Label>Desenvolvedora (Cargo)</Label>
              <Input
                value={brandingForm.developer_role}
                onChange={(e) => setBrandingForm((v) => ({ ...v, developer_role: e.target.value }))}
                placeholder="Ex: Desenvolvedora da Plataforma"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo da desenvolvedora (URL)</Label>
            <Input
              value={brandingForm.developer_logo_url}
              onChange={(e) => setBrandingForm((v) => ({ ...v, developer_logo_url: e.target.value }))}
              placeholder="https://.../logo-two-solucoes.png"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={applySystemBrandingIntoForm}>
              Carregar atual
            </Button>
            <Button type="button" variant="outline" onClick={applyInstitutionalPreset}>
              Aplicar preset institucional
            </Button>
            <Button type="button" onClick={() => saveBrandingMutation.mutate()} disabled={saveBrandingMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Salvar personalização
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-zinc-800 rounded-lg" />
          ))}
        </div>
      ) : (configs ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <Settings className="h-12 w-12 mb-3 text-zinc-600" />
          <p className="text-lg font-medium">Nenhuma configuração definida</p>
          <p className="text-sm mt-1">Crie a primeira configuração global do sistema.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(configs ?? []).map((config) => (
            <div key={config.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-semibold text-amber-400">{config.key}</p>
                  <pre className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                    {JSON.stringify(config.value, null, 2)}
                  </pre>
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Atualizado: {new Date(config.updated_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1 ml-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(config)} className="text-zinc-400 hover:text-zinc-200">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(config.id)}
                    className="text-zinc-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
