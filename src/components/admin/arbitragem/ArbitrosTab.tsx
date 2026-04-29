import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Search, Trash2, Upload, Users } from "lucide-react";
import ArbitrosImportDialog from "./ArbitrosImportDialog";

interface Arbitro {
  user_id: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
  assignments_count: number;
}

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export function ArbitrosTab() {
  const { activeEventId } = useEventContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<Arbitro | null>(null);

  const { data: arbitros = [], isLoading } = useQuery({
    queryKey: ["arbitros-list", activeEventId],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "arbitragem" as any);
      if (rolesErr) throw rolesErr;

      const userIds = (roles ?? []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profilesData, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, active")
        .in("id", userIds);
      if (profErr) throw profErr;

      const assignmentCounts: Record<string, number> = {};
      if (activeEventId) {
        const { data: assignments } = await (supabase as any)
          .from("match_user_assignments")
          .select("user_id")
          .eq("event_id", activeEventId)
          .in("user_id", userIds);
        (assignments || []).forEach((a: any) => {
          assignmentCounts[a.user_id] = (assignmentCounts[a.user_id] || 0) + 1;
        });
      }

      const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.created_at]));
      return (profilesData ?? []).map((p: any) => ({
        user_id: p.id,
        full_name: p.full_name,
        active: p.active,
        created_at: roleMap.get(p.id) || "",
        assignments_count: assignmentCounts[p.id] || 0,
      })) as Arbitro[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return arbitros;
    return arbitros.filter(a => a.full_name?.toLowerCase().includes(term));
  }, [arbitros, search]);

  async function toggleActive(a: Arbitro) {
    const { error } = await supabase
      .from("profiles")
      .update({ active: !a.active })
      .eq("id", a.user_id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success(a.active ? "Árbitro desativado" : "Árbitro ativado");
    queryClient.invalidateQueries({ queryKey: ["arbitros-list"] });
  }

  async function removeArbitro(a: Arbitro) {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", a.user_id)
      .eq("role", "arbitragem" as any);
    if (error) { toast.error("Erro ao remover árbitro"); return; }
    toast.success("Árbitro removido da equipe");
    queryClient.invalidateQueries({ queryKey: ["arbitros-list"] });
    setRemoveConfirm(null);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) { toast.error("E-mail obrigatório"); return; }
    setInviting(true);
    try {
      await callAdminUsers("invite_user", {
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || undefined,
        roles: ["arbitragem"],
      });
      toast.success("Convite enviado para " + inviteEmail.trim());
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      queryClient.invalidateQueries({ queryKey: ["arbitros-list"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar convite");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar árbitro pelo nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-2" /> Importar CSV
        </Button>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Convidar Árbitro
        </Button>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span><strong className="text-foreground">{arbitros.length}</strong> árbitros cadastrados</span>
        <span>•</span>
        <span><strong className="text-foreground">{arbitros.filter(a => a.active).length}</strong> ativos</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="font-medium">{search ? "Nenhum árbitro encontrado" : "Nenhum árbitro cadastrado"}</p>
              <p className="text-xs mt-1">Use "Convidar Árbitro" ou "Importar CSV" para adicionar</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" /> Convidar primeiro árbitro
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center w-40">Designações no evento</TableHead>
                  <TableHead className="text-center w-28">Ativo</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => (
                  <TableRow key={a.user_id}>
                    <TableCell className="font-medium">{a.full_name || <span className="text-muted-foreground italic">Sem nome</span>}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.assignments_count > 0 ? "secondary" : "outline"}>
                        {a.assignments_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setRemoveConfirm(a)}
                        disabled={a.assignments_count > 0}
                        title={a.assignments_count > 0 ? "Possui designações ativas — remova-as primeiro" : "Remover da equipe"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convidar Árbitro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                placeholder="Nome completo"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="arbitro@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleInvite()}
              />
              <p className="text-xs text-muted-foreground">O árbitro receberá um link para definir a senha.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <AlertDialog open={!!removeConfirm} onOpenChange={open => { if (!open) setRemoveConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover árbitro da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removeConfirm?.full_name}</strong> perderá o acesso ao módulo de arbitragem.
              O usuário não será excluído do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeConfirm && removeArbitro(removeConfirm)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArbitrosImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["arbitros-list"] })}
      />
    </div>
  );
}
