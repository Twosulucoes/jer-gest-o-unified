import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy, Key, LogOut as LogOutIcon, UserPlus, Settings2, Search,
  Mail, ShieldCheck, ShieldX, Clock, User as UserIcon, RefreshCw,
} from "lucide-react";
import SportLinksDialog from "@/components/admin/SportLinksDialog";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "secretaria", label: "Secretaria" },
  { value: "coordenacao_tecnica", label: "Coord. Técnica" },
  { value: "coordenador_modalidade", label: "Coord. Modalidade" },
  { value: "transporte", label: "Transporte" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "alojamento", label: "Alojamento" },
  { value: "delegacao", label: "Delegação" },
  { value: "arbitragem", label: "Arbitragem" },
  { value: "mesario", label: "Mesário" },
  { value: "cde", label: "CDE" },
];

const OPERATIONAL_ROLES = ROLES.filter((r) => !["admin", "secretaria"].includes(r.value));

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "admin") return "default";
  if (role === "secretaria") return "secondary";
  return "outline";
}

function statusLabel(u: any): { text: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!u.last_sign_in_at && u.active) return { text: "Convite pendente", variant: "outline" };
  if (!u.active) return { text: "Inativo", variant: "destructive" };
  return { text: "Ativo", variant: "default" };
}

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AcessosUsuariosPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  // Filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("transporte");

  // User detail drawer
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Sport links
  const [sportLinksUser, setSportLinksUser] = useState<{ id: string; name: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const result = await callAdminUsers("list_users");
      return result.users || [];
    },
  });

  const filteredUsers = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u: any) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    }
    if (filterRole !== "all") {
      list = list.filter((u: any) => u.roles?.includes(filterRole));
    }
    if (filterStatus !== "all") {
      list = list.filter((u: any) => {
        const s = statusLabel(u);
        if (filterStatus === "ativo") return s.text === "Ativo";
        if (filterStatus === "inativo") return s.text === "Inativo";
        if (filterStatus === "pendente") return s.text === "Convite pendente";
        return true;
      });
    }
    return list;
  }, [users, search, filterRole, filterStatus]);

  const openDrawer = async (u: any) => {
    setSelectedUser(u);
    setDrawerOpen(true);
    setResetLink("");
    setLoadingAudit(true);
    try {
      const result = await callAdminUsers("get_user_audit", { user_id: u.user_id });
      setAuditEvents(result.events || []);
    } catch {
      setAuditEvents([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Mutations
  const setRoleMutation = useMutation({
    mutationFn: (params: { user_id: string; role: string }) =>
      callAdminUsers("set_role", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Perfil atualizado");
      if (selectedUser) {
        setSelectedUser((prev: any) => prev ? { ...prev, roles: [setRoleMutation.variables?.role] } : null);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setActiveMutation = useMutation({
    mutationFn: (params: { user_id: string; active: boolean }) =>
      callAdminUsers("set_active", params),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success(vars.active ? "Usuário ativado" : "Usuário desativado");
      if (selectedUser) {
        setSelectedUser((prev: any) => prev ? { ...prev, active: vars.active } : null);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (user_id: string) =>
      callAdminUsers("revoke_sessions", { user_id }),
    onSuccess: () => toast.success("Sessões revogadas"),
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      callAdminUsers("invite_user", { email: inviteEmail, full_name: inviteName || undefined, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Convite enviado!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("transporte");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resendInviteMutation = useMutation({
    mutationFn: (user_id: string) =>
      callAdminUsers("resend_invite", { user_id }),
    onSuccess: () => toast.success("Convite reenviado!"),
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (user_id: string) =>
      callAdminUsers("reset_password", { user_id }),
    onSuccess: (data: any) => {
      setResetLink(data.action_link || "");
      if (data.action_link) toast.success("Link de recuperação gerado!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const availableInviteRoles = isAdmin ? ROLES : OPERATIONAL_ROLES;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
            <SelectItem value="pendente">Convite pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !filteredUsers.length ? (
        <div className="flex flex-col items-center py-12 text-center">
          <UserIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {search || filterRole !== "all" || filterStatus !== "all"
              ? "Nenhum usuário encontrado com os filtros aplicados."
              : "Nenhum usuário cadastrado. Clique em 'Novo Usuário' para convidar."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u: any) => {
                const status = statusLabel(u);
                return (
                  <TableRow
                    key={u.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(u)}
                  >
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      {u.roles?.length > 0 ? (
                        <Badge variant={roleBadgeVariant(u.roles[0])}>
                          {ROLES.find((r) => r.value === u.roles[0])?.label || u.roles[0]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem perfil</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.text}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm") : "Nunca"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="usuario@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label>Perfil *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableInviteRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {inviteMutation.isPending ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedUser && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  {selectedUser.full_name || selectedUser.email}
                </SheetTitle>
              </SheetHeader>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedUser.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Criado em {selectedUser.created_at ? format(new Date(selectedUser.created_at), "dd/MM/yyyy HH:mm") : "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Último acesso: {selectedUser.last_sign_in_at ? format(new Date(selectedUser.last_sign_in_at), "dd/MM/yyyy HH:mm") : "Nunca"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusLabel(selectedUser).variant}>
                    {statusLabel(selectedUser).text}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Role */}
              <div className="space-y-2">
                <Label className="font-semibold">Perfil</Label>
                <Select
                  value={selectedUser.roles?.[0] || ""}
                  onValueChange={(role) => {
                    setRoleMutation.mutate({ user_id: selectedUser.user_id, role });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isAdmin ? ROLES : OPERATIONAL_ROLES).map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUser.roles?.includes("coordenador_modalidade") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSportLinksUser({ id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email })}
                  >
                    <Settings2 className="h-4 w-4 mr-2" />
                    Gerenciar modalidades vinculadas
                  </Button>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Label className="font-semibold">Ações</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{selectedUser.active ? "Desativar usuário" : "Ativar usuário"}</span>
                  <Switch
                    checked={selectedUser.active}
                    onCheckedChange={(active) =>
                      setActiveMutation.mutate({ user_id: selectedUser.user_id, active })
                    }
                  />
                </div>

                {statusLabel(selectedUser).text === "Convite pendente" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={resendInviteMutation.isPending}
                    onClick={() => resendInviteMutation.mutate(selectedUser.user_id)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {resendInviteMutation.isPending ? "Reenviando..." : "Reenviar Convite"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                  onClick={() => resetPasswordMutation.mutate(selectedUser.user_id)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  {resetPasswordMutation.isPending ? "Gerando..." : "Gerar Link de Recuperação"}
                </Button>

                {resetLink && (
                  <div className="p-3 rounded-md bg-muted text-xs break-all space-y-2">
                    <p className="font-mono">{resetLink}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard.writeText(resetLink); toast.success("Link copiado!"); }}
                    >
                      <Copy className="mr-2 h-3 w-3" /> Copiar
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(selectedUser.user_id)}
                >
                  <LogOutIcon className="h-4 w-4 mr-2" />
                  Revogar Sessões Ativas
                </Button>
              </div>

              <Separator />

              {/* Audit History */}
              <div className="space-y-2">
                <Label className="font-semibold">Histórico de Ações</Label>
                {loadingAudit ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : auditEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
                ) : (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {auditEvents.map((ev: any, i: number) => (
                        <div key={i} className="text-xs p-2 rounded bg-muted/50 space-y-1">
                          <div className="flex justify-between">
                            <Badge variant="outline" className="text-[10px]">{ev.action}</Badge>
                            <span className="text-muted-foreground">
                              {ev.created_at ? format(new Date(ev.created_at), "dd/MM HH:mm") : ""}
                            </span>
                          </div>
                          {ev.payload && (
                            <p className="text-muted-foreground truncate">
                              {typeof ev.payload === "string" ? ev.payload : JSON.stringify(ev.payload)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {sportLinksUser && (
        <SportLinksDialog
          open={!!sportLinksUser}
          onOpenChange={(open) => { if (!open) setSportLinksUser(null); }}
          userId={sportLinksUser.id}
          userName={sportLinksUser.name}
        />
      )}
    </div>
  );
}
