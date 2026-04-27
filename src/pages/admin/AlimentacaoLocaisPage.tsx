import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import { Plus, Pencil, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MealLocationFormDialog, { type MealLocationFormValues } from "@/components/admin/MealLocationFormDialog";

export default function AlimentacaoLocaisPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");

  const { data: locations, isLoading } = useQuery({
    queryKey: ["meal_locations", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await (supabase as any).from("meal_locations")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedEventId,
  });

  const createMut = useMutation({
    mutationFn: async (v: MealLocationFormValues) => {
      const { error } = await (supabase as any).from("meal_locations").insert({
        event_id: selectedEventId!,
        name: v.name,
        address: v.address || null,
        capacity: v.capacity || null,
        is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal_locations"] });
      toast.success("Local de refeição criado");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MealLocationFormValues & { id: string }) => {
      const { error } = await (supabase as any).from("meal_locations")
        .update({
          name: v.name,
          address: v.address || null,
          capacity: v.capacity || null,
          is_active: v.is_active,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal_locations"] });
      toast.success("Local de refeição atualizado");
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const filteredLocations = locations?.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Locais de Refeição</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de refeitórios e pontos de distribuição</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo local
          </Button>
        )}
      </div>

      <div className="flex items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou endereço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filteredLocations?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum local encontrado</p>
          {canWrite && (
            <Button size="sm" className="mt-3" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Cadastrar local
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-semibold text-primary">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.address || "—"}</TableCell>
                  <TableCell>{l.capacity || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.is_active ? "default" : "secondary"}>
                      {l.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MealLocationFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        location={editing}
        onSubmit={(v) => editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v)}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
