import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, UtensilsCrossed, Search, Copy, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MealTypeFormDialog, { type MealTypeFormValues } from "@/components/admin/MealTypeFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AlimentacaoTiposPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const selectedEventId = useActiveEventId();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: mealTypes, isLoading } = useQuery({
    queryKey: ["meal_types", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("meal_types").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const filteredMealTypes = useMemo(() => {
    return (mealTypes || []).filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "active" ? m.is_active : !m.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [mealTypes, searchTerm, statusFilter]);

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const createMut = useMutation({
    mutationFn: async (v: MealTypeFormValues) => {
      const { error } = await supabase.from("meal_types").insert({
        event_id: v.event_id, name: v.name, slug: v.slug,
        sort_order: v.sort_order, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MealTypeFormValues & { id: string }) => {
      const { error } = await supabase.from("meal_types").update({
        name: v.name, slug: v.slug, sort_order: v.sort_order, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo excluído"); setDeletingId(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string, is_active: boolean }) => {
      const { error } = await supabase.from("meal_types").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal_types"] }),
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const duplicateMut = useMutation({
    mutationFn: async (m: any) => {
      const { id, created_at, updated_at, ...rest } = m;
      const { error } = await supabase.from("meal_types").insert({
        ...rest,
        name: `${m.name} (Cópia)`,
        slug: `${m.slug}-copia-${Math.floor(Math.random() * 1000)}`,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo duplicado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: MealTypeFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Tipos de Refeição</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de tipos de refeição do evento</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />Novo tipo
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filteredMealTypes?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">
            {searchTerm || statusFilter !== "all" ? "Nenhum tipo encontrado com esses filtros" : "Nenhum tipo cadastrado"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead className="w-[80px]">Ordem</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {canWrite && <TableHead className="w-[120px] text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMealTypes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{m.name}</span>
                      <span className="md:hidden text-[10px] font-mono text-muted-foreground uppercase">{m.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">{m.slug}</TableCell>
                  <TableCell className="text-center font-medium">{m.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                      {m.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMut.mutate(m)} title="Duplicar">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={() => toggleStatusMut.mutate({ id: m.id, is_active: !m.is_active })}
                          title={m.is_active ? "Desativar" : "Ativar"}
                        >
                          {m.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(m); setDialogOpen(true); }} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(m.id)} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
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

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tipo de Refeição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Certifique-se de que este tipo não está sendo usado em janelas de serviço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingId && deleteMut.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MealTypeFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        mealType={editing}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
