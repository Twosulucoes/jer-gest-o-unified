import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Plus, Trash2, Link2, Search, AlertTriangle, UserPlus, Trophy, Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppPageHeader } from "@/components/app/AppPageHeader";
import SportLinksDialog from "@/components/admin/SportLinksDialog";

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AcessosDelegacoesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const { activeEvent, activeEventId } = useEventContext();
  const canManage = hasRole("admin") || hasRole("secretaria");

  // ---- Tab state ----
  const [tab, setTab] = useState<"delegacao" | "modalidades">("delegacao");

  // ---- Delegação tab ----
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; user: string; institution: string } | null>(null);

  // Users list (with emails) via admin-users edge fn
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const result = await callAdminUsers("list_users");
      return result.users || [];
    },
  });

  // Vínculos delegação (filtrados por evento ativo via join lógico)
  const { data: links = [], isLoading: loadingLinks } = useQuery({
    queryKey: ["user_delegations", activeEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_delegations")
        .select("id, user_id, delegation_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations_for_link", activeEventId],
    queryFn: async () => {
      let q = supabase.from("delegations").select("id, event_id, institution_id, status").order("created_at", { ascending: false });
      if (activeEventId) q = q.eq("event_id", activeEventId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeEventId,
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Maps ----
  const institutionsMap = useMemo(
    () => new Map(institutions.map((i) => [i.id, i.name])),
    [institutions]
  );
  const usersMap = useMemo(
    () => new Map(users.map((u: any) => [u.user_id, u])),
    [users]
  );

  // Apenas delegações deste evento
  const delegationIdsThisEvent = useMemo(
    () => new Set(delegations.map((d) => d.id)),
    [delegations]
  );

  // Vínculos restritos ao evento ativo
  const linksThisEvent = useMemo(
    () => links.filter((l) => delegationIdsThisEvent.has(l.delegation_id)),
    [links, delegationIdsThisEvent]
  );

  // Conta vínculos por delegação (alerta de duplicado)
  const linksByDelegation = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linksThisEvent) m.set(l.delegation_id, (m.get(l.delegation_id) || 0) + 1);
    return m;
  }, [linksThisEvent]);

  // Usuários com perfil delegação (a partir do list_users)
  const delegationUsers = useMemo(
    () => users.filter((u: any) => u.roles?.includes("delegacao")),
    [users]
  );

  const linkedUserIds = new Set(linksThisEvent.map((l) => l.user_id));
  const availableUsers = delegationUsers.filter((u: any) => !linkedUserIds.has(u.user_id));

  // Coord. modalidade users (para aba Modalidades)
  const coordUsers = useMemo(
    () => users.filter((u: any) => u.roles?.includes("coordenador_modalidade")),
    [users]
  );

  // Sport links (pré-carrega contagem)
  const coordUserIds = useMemo(() => coordUsers.map((u: any) => u.user_id), [coordUsers]);
  const { data: sportLinks = [] } = useQuery({
    queryKey: ["user-sport-links-all", activeEventId, coordUserIds],
    queryFn: async () => {
      if (!activeEventId || coordUserIds.length === 0) return [];
      const { data } = await supabase
        .from("user_sport_links")
        .select("id, user_id, sport_id, sports(name)")
        .eq("event_id", activeEventId)
        .in("user_id", coordUserIds);
      return data || [];
    },
    enabled: !!activeEventId && coordUserIds.length > 0,
  });

  const sportsByUser = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const l of sportLinks as any[]) {
      const uid = l.user_id as string;
      if (!m[uid]) m[uid] = [];
      m[uid].push(l.sports?.name || "—");
    }
    return m;
  }, [sportLinks]);

  // ---- Filter (search) ----
  const filteredDelegationUsers = useMemo(() => {
    if (!search.trim()) return delegationUsers;
    const q = search.toLowerCase();
    return delegationUsers.filter((u: any) => {
      const name = u.full_name || "";
      const email = u.email || "";
      // Procura também na delegação vinculada
      const link = linksThisEvent.find((l) => l.user_id === u.user_id);
      const delegation = link ? delegations.find((d) => d.id === link.delegation_id) : null;
      const inst = delegation ? institutionsMap.get(delegation.institution_id) || "" : "";

      return (
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        inst.toLowerCase().includes(q)
      );
    });
  }, [delegationUsers, search, linksThisEvent, delegations, institutionsMap]);

  // ---- Mutations ----
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_delegations").insert({
        user_id: selectedUserId,
        delegation_id: selectedDelegationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_delegations"] });
      toast.success("Vínculo criado com sucesso");
      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedDelegationId("");
    },
    onError: (err: Error) => {
      if (err.message?.includes("uq_user_delegations_user")) {
        toast.error("Este usuário já possui um vínculo de delegação.");
      } else {
        toast.error(`Erro ao criar vínculo: ${err.message}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_delegations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_delegations"] });
      toast.success("Vínculo removido");
      setConfirmDelete(null);
    },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });

  // ---- Modalidades tab ----
  const [sportLinksUser, setSportLinksUser] = useState<{ id: string; name: string } | null>(null);
  const [coordSearch, setCoordSearch] = useState("");

  const filteredCoords = useMemo(() => {
    if (!coordSearch.trim()) return coordUsers;
    const q = coordSearch.toLowerCase();
    return coordUsers.filter((u: any) =>
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  }, [coordUsers, coordSearch]);

  // ---- Render ----
  return (
    <div className="animate-fade-in space-y-6">
      <AppPageHeader
        title="Acessos e Vínculos"
        description="Gerencie os vínculos de acesso entre usuários e as delegações ou modalidades."

      >
        {canManage && (
          <Button asChild variant="outline" size="sm">
            <RouterLink to="/admin/acessos/usuarios">
              <UserPlus className="mr-2 h-4 w-4" />
              Gerenciar usuários
            </RouterLink>
          </Button>
        )}
      </AppPageHeader>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "delegacao" | "modalidades")}>
        <TabsList>
          <TabsTrigger value="delegacao">
            <Shield className="mr-2 h-4 w-4" />
            Delegação
          </TabsTrigger>
          <TabsTrigger value="modalidades">
            <Trophy className="mr-2 h-4 w-4" />
            Modalidades
          </TabsTrigger>
        </TabsList>

        {/* ---------------- TAB: DELEGAÇÃO ---------------- */}
        <TabsContent value="delegacao" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, e-mail ou instituição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {canManage && (
              <Button
                onClick={() => setDialogOpen(true)}
                disabled={!availableUsers.length || !delegations.length || !activeEventId}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo vínculo
              </Button>
            )}
          </div>

          {!activeEventId ? (
            <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Selecione um evento ativo para listar vínculos.</p>
            </div>
          ) : loadingLinks ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : !filteredDelegationUsers.length ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
              <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">
                {delegationUsers.length === 0 ? "Nenhum usuário com perfil 'Delegação'" : "Nenhum resultado para sua busca"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {delegationUsers.length === 0
                  ? "Crie usuários com este perfil para poder vinculá-los a delegações."
                  : "Ajuste o termo de busca ou limpe o filtro."}
              </p>
              {delegationUsers.length === 0 && (
                <Button asChild variant="link" size="sm" className="mt-2">
                  <RouterLink to="/admin/acessos/usuarios">Criar usuário</RouterLink>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Delegação Vinculada (Evento Atual)</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDelegationUsers.map((u: any) => {
                    const linksForUser = linksThisEvent.filter((l) => l.user_id === u.user_id);
                    const isLinked = linksForUser.length > 0;
                    
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{u.full_name || "—"}</span>
                            {!u.active && <Badge variant="destructive" className="text-[10px] h-4 px-1">Inativo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.email || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {linksForUser.length === 0 ? (
                              <span className="text-sm text-muted-foreground italic">Não vinculado</span>
                            ) : (
                              linksForUser.map((link) => {
                                const delegation = delegations.find((d) => d.id === link.delegation_id);
                                const instName = delegation ? institutionsMap.get(delegation.institution_id) || "—" : "—";
                                const isInactiveDelegation = delegation?.status === "inactive";
                                return (
                                  <div key={link.id} className="flex items-center gap-2">
                                    <Badge variant={isInactiveDelegation ? "outline" : "secondary"} className="font-normal gap-1">
                                      {instName}
                                      {isInactiveDelegation && <span className="text-[10px] text-muted-foreground">(Inativa)</span>}
                                    </Badge>
                                    {canManage && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          setConfirmDelete({
                                            id: link.id,
                                            user: u.full_name || u.email,
                                            institution: instName,
                                          })
                                        }
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUserId(u.user_id);
                                setDialogOpen(true);
                              }}
                            >
                              <Plus className="mr-2 h-3 w-3" />
                              Vincular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---------------- TAB: MODALIDADES ---------------- */}
        <TabsContent value="modalidades" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar coordenador..."
                value={coordSearch}
                onChange={(e) => setCoordSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Vincule cada Coordenador de Modalidade às modalidades que ele opera.
            </p>
          </div>

          {!activeEventId ? (
            <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Selecione um evento ativo para listar coordenadores.</p>
            </div>
          ) : !filteredCoords.length ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">
                {coordUsers.length === 0
                  ? "Nenhum usuário com perfil 'Coord. Modalidade'"
                  : "Nenhum resultado para sua busca"}
              </p>
              {coordUsers.length === 0 && (
                <Button asChild variant="link" size="sm" className="mt-2">
                  <RouterLink to="/admin/acessos/usuarios">Criar usuário</RouterLink>
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coordenador</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Modalidades vinculadas</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoords.map((u: any) => {
                    const modas = sportsByUser[u.user_id] || [];
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{u.full_name || "—"}</span>
                            {!u.active && <Badge variant="destructive" className="text-[10px] h-4 px-1">Inativo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell>
                          {modas.length === 0 ? (
                            <span className="text-sm text-muted-foreground">Nenhuma</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {modas.map((n, i) => (
                                <Badge key={i} variant="secondary">{n}</Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSportLinksUser({ id: u.user_id, name: u.full_name || u.email || "Coord." })}
                            >
                              Gerenciar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo: novo vínculo delegação */}
      <Dialog open={dialogOpen} onOpenChange={(o) => {
        setDialogOpen(o);
        if (!o) setSelectedUserId("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Usuário à Delegação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Usuário (perfil delegação)</Label>
              <Select 
                value={selectedUserId} 
                onValueChange={setSelectedUserId}
                disabled={!!selectedUserId && filteredDelegationUsers.some(u => u.user_id === selectedUserId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {delegationUsers.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email || u.user_id.slice(0, 8) + "…"}
                      {u.email && <span className="text-muted-foreground ml-2 text-xs">({u.email})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Delegação</Label>
              <Select value={selectedDelegationId} onValueChange={setSelectedDelegationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma delegação" />
                </SelectTrigger>
                <SelectContent>
                  {delegations.map((d) => {
                    const count = linksByDelegation.get(d.id) || 0;
                    return (
                      <SelectItem key={d.id} value={d.id}>
                        {institutionsMap.get(d.institution_id) || "—"}
                        {count > 0 && (
                          <span className="text-amber-600 ml-2 text-xs">⚠ {count} já vinculado(s)</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedUserId || !selectedDelegationId || createMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  O usuário <strong>{confirmDelete.user}</strong> perderá o acesso à delegação{" "}
                  <strong>{confirmDelete.institution}</strong>. Esta ação pode ser desfeita criando o vínculo novamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de modalidades */}
      {sportLinksUser && (
        <SportLinksDialog
          open={!!sportLinksUser}
          onOpenChange={(o) => !o && setSportLinksUser(null)}
          userId={sportLinksUser.id}
          userName={sportLinksUser.name}
        />
      )}
    </div>
  );
}
