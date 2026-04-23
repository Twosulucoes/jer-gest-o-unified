import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import { Plus, Pencil, Power, PowerOff, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface EventStage {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  kind: string;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

const KIND_OPTIONS = [
  { value: "classificatoria", label: "Classificatória" },
  { value: "regional", label: "Regional" },
  { value: "final", label: "Final" },
  { value: "geral", label: "Geral" },
];

function slugify(text: string): string {
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function EventStagesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { activeEvent } = useEventContext();
  const eventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventStage | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", kind: "classificatoria", sort_order: 0,
    starts_at: "", ends_at: "", status: "active",
  });

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["event_stages_admin", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages" as never)
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventStage[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: Partial<EventStage> & { event_id: string; name: string; slug: string }) => {
      if (editing) {
        const { error } = await supabase
          .from("event_stages" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_stages" as never).insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_stages_admin", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event_stages", eventId] });
      toast.success(editing ? "Etapa atualizada" : "Etapa criada");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      if (e.message?.includes("event_stages_event_slug_uniq")) {
        toast.error("Já existe uma etapa com este slug neste evento.");
      } else {
        toast.error("Erro: " + e.message);
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (s: EventStage) => {
      const newStatus = s.status === "active" ? "archived" : "active";
      const { error } = await supabase
        .from("event_stages" as never)
        .update({ status: newStatus } as never)
        .eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_stages_admin", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event_stages", eventId] });
      toast.success("Status alterado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", kind: "classificatoria", sort_order: stages.length, starts_at: "", ends_at: "", status: "active" });
    setDialogOpen(true);
  };

  const openEdit = (s: EventStage) => {
    setEditing(s);
    setForm({
      name: s.name, slug: s.slug, kind: s.kind, sort_order: s.sort_order,
      starts_at: s.starts_at ?? "", ends_at: s.ends_at ?? "", status: s.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nome e slug são obrigatórios.");
      return;
    }
    upsertMutation.mutate({
      event_id: eventId,
      name: form.name.trim(),
      slug: form.slug.trim(),
      kind: form.kind,
      sort_order: Number(form.sort_order) || 0,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      status: form.status,
    });
  };

  if (!eventId) {
    return <p className="text-muted-foreground">Selecione um evento ativo no seletor global.</p>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Etapas do evento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as etapas administrativas internas (ex.: Caracaraí, Bonfim, Final).
          </p>
        </div>
        {canWrite && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nova etapa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar etapa" : "Nova etapa"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                    }}
                    placeholder="Ex.: Caracaraí Classificatória"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} placeholder="caracarai-classificatoria" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo (kind)</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KIND_OPTIONS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Ordem</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Início</Label>
                    <Input type="date" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fim</Label>
                    <Input type="date" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="archived">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={upsertMutation.isPending}>
                  {editing ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada para este evento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stages.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.sort_order}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{s.slug}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{s.kind}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.starts_at ?? "—"} → {s.ends_at ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>
                        {s.status === "active" ? "Ativa" : "Arquivada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggleStatusMutation.mutate(s)} title={s.status === "active" ? "Arquivar" : "Reativar"}>
                            {s.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
