import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MatchConfig } from "./MatchConfigEditor";

const ROLE_OPTIONS = [
  { value: "referee", label: "Árbitro" },
  { value: "assistant_referee", label: "Árbitro assistente" },
  { value: "table_official", label: "Mesa / Apoio" },
  { value: "coordinator", label: "Coordenador" },
  { value: "other", label: "Outro" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

interface MatchOfficialsCardProps {
  matchId: string;
  matchConfig: MatchConfig;
  canWrite: boolean;
}

export default function MatchOfficialsCard({ matchId, matchConfig, canWrite }: MatchOfficialsCardProps) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "referee", notes: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: officials = [], isLoading } = useQuery({
    queryKey: ["match_officials", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_officials" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("role")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (editingId) {
        const { error } = await supabase.from("match_officials" as any)
          .update({ name: form.name, role: form.role, notes: form.notes || null })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("match_officials" as any)
          .insert({ match_id: matchId, name: form.name, role: form.role, notes: form.notes || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_officials", matchId] });
      toast.success(editingId ? "Oficial atualizado" : "Oficial adicionado");
      setDialogOpen(false);
      setEditingId(null);
      setForm({ name: "", role: "referee", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_officials" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_officials", matchId] });
      toast.success("Oficial removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "", role: "referee", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (official: any) => {
    setEditingId(official.id);
    setForm({ name: official.name, role: official.role, notes: official.notes ?? "" });
    setDialogOpen(true);
  };

  // Requirement checks
  const refereeCount = officials.filter((o: any) => o.role === "referee" || o.role === "assistant_referee").length;
  const tableCount = officials.filter((o: any) => o.role === "table_official").length;
  const requiresReferees = matchConfig.requires_referees ?? false;
  const minReferees = matchConfig.min_referees ?? 1;
  const requiresTable = matchConfig.requires_table_officials ?? false;
  const refereeMissing = requiresReferees && refereeCount < minReferees;
  const tableMissing = requiresTable && tableCount === 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Oficiais da partida</CardTitle>
            <Badge variant="outline" className="text-xs">{officials.length}</Badge>
          </div>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-2 h-3 w-3" />Adicionar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Requirement warnings */}
          {(refereeMissing || tableMissing) && (
            <div className="space-y-1">
              {refereeMissing && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Esta modalidade exige no mínimo {minReferees} árbitro(s). Cadastrados: {refereeCount}.</span>
                </div>
              )}
              {tableMissing && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Esta modalidade exige equipe de mesa/apoio. Nenhum cadastrado ainda.</span>
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : officials.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum oficial registrado.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Observação</TableHead>
                    {canWrite && <TableHead className="w-[80px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officials.map((official: any) => (
                    <TableRow key={official.id}>
                      <TableCell className="font-medium text-sm">{official.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {ROLE_LABEL[official.role] ?? official.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{official.notes ?? "—"}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(official)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDeleteId(official.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar oficial" : "Adicionar oficial"}</DialogTitle>
            <DialogDescription>Registre o nome e a função do oficial da partida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome</label>
              <Input placeholder="Nome completo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Função</label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observação</label>
              <Textarea placeholder="Opcional" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name.trim()}>
              {saveMut.isPending ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover oficial</AlertDialogTitle>
            <AlertDialogDescription>O oficial será removido do registro desta partida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDeleteId) deleteMut.mutate(confirmDeleteId); setConfirmDeleteId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
