import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";

interface ProvaAlias {
  id: string;
  event_id: string;
  sport_id: string | null;
  prova_raw_normalized: string;
  prova_slug_override: string;
  prova_display_override: string | null;
  created_at: string;
}

interface Sport {
  id: string;
  name: string;
}

export default function NormalizacaoProvasPage() {
  const activeEventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria");

  const [filterSportId, setFilterSportId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlias, setEditingAlias] = useState<ProvaAlias | null>(null);
  const [form, setForm] = useState({
    sport_id: "" as string,
    prova_raw_normalized: "",
    prova_slug_override: "",
    prova_display_override: "",
  });

  // Fetch sports for this event
  const { data: sports = [] } = useQuery({
    queryKey: ["sports-for-event", activeEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id, name")
        .eq("event_id", activeEventId)
        .order("name");
      if (error) throw error;
      return data as Sport[];
    },
  });

  // Fetch aliases
  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ["prova-aliases", activeEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prova_aliases")
        .select("*")
        .eq("event_id", activeEventId)
        .order("prova_raw_normalized");
      if (error) throw error;
      return data as ProvaAlias[];
    },
  });

  const filtered = aliases.filter((a) => {
    if (filterSportId !== "all" && a.sport_id !== filterSportId) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        event_id: activeEventId,
        sport_id: form.sport_id || null,
        prova_raw_normalized: form.prova_raw_normalized.trim(),
        prova_slug_override: form.prova_slug_override.trim(),
        prova_display_override: form.prova_display_override.trim() || null,
      };

      if (editingAlias) {
        const { error } = await supabase
          .from("prova_aliases")
          .update(payload)
          .eq("id", editingAlias.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("prova_aliases")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAlias ? "Alias atualizado" : "Alias criado");
      queryClient.invalidateQueries({ queryKey: ["prova-aliases", activeEventId] });
      closeDialog();
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prova_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alias removido");
      queryClient.invalidateQueries({ queryKey: ["prova-aliases", activeEventId] });
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      // 1) Atualizar mapa de provas canônicas
      const { error: mapError } = await supabase.rpc("refresh_sport_event_prova_map", {
        p_event_id: activeEventId,
      });
      if (mapError) throw mapError;

      // 2) Reprocessar irregularidades usando o mapa atualizado
      const { error } = await supabase.rpc("recompute_participation_irregularities", {
        p_event_id: activeEventId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mapa de provas atualizado e irregularidades reprocessadas");
      queryClient.invalidateQueries({ queryKey: ["participation-irregularities", activeEventId] });
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const openCreate = () => {
    setEditingAlias(null);
    setForm({ sport_id: "", prova_raw_normalized: "", prova_slug_override: "", prova_display_override: "" });
    setDialogOpen(true);
  };

  const openEdit = (alias: ProvaAlias) => {
    setEditingAlias(alias);
    setForm({
      sport_id: alias.sport_id ?? "",
      prova_raw_normalized: alias.prova_raw_normalized,
      prova_slug_override: alias.prova_slug_override,
      prova_display_override: alias.prova_display_override ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAlias(null);
  };

  const getSportName = (sportId: string | null) => {
    if (!sportId) return "Todas";
    return sports.find((s) => s.id === sportId)?.name ?? sportId;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/normalizacao-provas"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => recomputeMutation.mutate()} disabled={recomputeMutation.isPending}>
              <RefreshCw className={`mr-2 h-4 w-4 ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
              Reprocessar irregularidades
            </Button>
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo alias
              </Button>
            )}
          </div>
        }
      />

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterSportId} onValueChange={setFilterSportId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas as modalidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as modalidades</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aliases cadastrados ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum alias cadastrado.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Texto normalizado (chave)</TableHead>
                    <TableHead>Slug canônico</TableHead>
                    <TableHead>Display</TableHead>
                    <TableHead>Modalidade</TableHead>
                    {canEdit && <TableHead className="w-[100px]">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((alias) => (
                    <TableRow key={alias.id}>
                      <TableCell className="font-mono text-xs">{alias.prova_raw_normalized}</TableCell>
                      <TableCell className="font-mono text-xs">{alias.prova_slug_override}</TableCell>
                      <TableCell>{alias.prova_display_override ?? "—"}</TableCell>
                      <TableCell className="text-sm">{getSportName(alias.sport_id)}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(alias)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Remover este alias?")) deleteMutation.mutate(alias.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAlias ? "Editar alias" : "Novo alias"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texto normalizado (chave de busca)</Label>
              <Input
                value={form.prova_raw_normalized}
                onChange={(e) => setForm((f) => ({ ...f, prova_raw_normalized: e.target.value }))}
                placeholder="Ex.: 100M RASOS"
                disabled={!!editingAlias}
              />
              <p className="text-xs text-muted-foreground">Texto em MAIÚSCULAS sem acentos, como apareceria após normalização.</p>
            </div>
            <div className="space-y-2">
              <Label>Slug canônico (resultado final)</Label>
              <Input
                value={form.prova_slug_override}
                onChange={(e) => setForm((f) => ({ ...f, prova_slug_override: e.target.value }))}
                placeholder="Ex.: 100m-rasos"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome de exibição (opcional)</Label>
              <Input
                value={form.prova_display_override}
                onChange={(e) => setForm((f) => ({ ...f, prova_display_override: e.target.value }))}
                placeholder="Ex.: 100m Rasos"
              />
            </div>
            <div className="space-y-2">
              <Label>Modalidade (opcional)</Label>
              <Select value={form.sport_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, sport_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as modalidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todas as modalidades</SelectItem>
                  {sports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.prova_raw_normalized.trim() || !form.prova_slug_override.trim()}
            >
              {editingAlias ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
