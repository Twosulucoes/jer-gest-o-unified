import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy, Key, LogOut as LogOutIcon, UserPlus, Settings2, Search,
  Mail, ShieldCheck, Clock, User as UserIcon, RefreshCw, Trophy, AlertTriangle, Layers,
} from "lucide-react";
import SportLinksDialog from "@/components/admin/SportLinksDialog";
import StageLinksDialog from "@/components/admin/StageLinksDialog";

const ROLES = [
  { 
    value: "super_admin", 
    label: "Super Admin", 
    description: "Acesso total e irrestrito a todas as funções, configurações e logs do sistema.",
    areas: ["Global", "Sistema", "Admin", "PWA"]
  },
  { 
    value: "admin", 
    label: "Administrador", 
    description: "Gestão completa do evento, participantes, delegações e usuários.",
    areas: ["Admin Global", "Etapas", "Relatórios"]
  },
  { 
    value: "secretaria", 
    label: "Secretaria", 
    description: "Operação de cadastros, inscrições, documentos e suporte aos usuários.",
    areas: ["Cadastro", "Participantes", "Documentos"]
  },
  { 
    value: "coordenacao_tecnica", 
    label: "Coord. Técnica", 
    description: "Gestão técnica de competições, chaves, resultados e classificação.",
    areas: ["Competição", "Resultados", "Técnica"]
  },
  { 
    value: "coordenador_modalidade", 
    label: "Coord. Modalidade", 
    description: "Gestão específica de uma modalidade e suas provas vinculadas.",
    areas: ["Modalidade", "Súmulas", "Resultados"]
  },
  { 
    value: "transporte", 
    label: "Transporte (PWA)", 
    description: "Gestão operacional de frotas, rotas e horários via aplicativo.",
    areas: ["Logística", "Transporte App"]
  },
  { 
    value: "alimentacao", 
    label: "Alimentação (PWA)", 
    description: "Controle de acesso a refeitórios e consumo de refeições via QR Code.",
    areas: ["Refeitório", "Consumo App"]
  },
  { 
    value: "alojamento", 
    label: "Alojamento (PWA)", 
    description: "Gestão de ocupação, check-in e check-out em unidades de alojamento.",
    areas: ["Alojamento App", "Ocupação"]
  },
  { 
    value: "delegacao", 
    label: "Delegação (PWA)", 
    description: "Consulta de inscritos e documentos da delegação pelo aplicativo.",
    areas: ["Delegado App", "Inscrições"]
  },
  { 
    value: "arbitragem", 
    label: "Arbitragem (PWA)", 
    description: "Registro de ocorrências e súmulas simplificadas em tempo real.",
    areas: ["Súmula App", "Arbitragem"]
  },
  { 
    value: "mesario", 
    label: "Mesário / Ao Vivo (PWA)", 
    description: "Controle de placar, tempo e estatísticas das partidas ao vivo.",
    areas: ["Live Streaming", "Placar App"]
  },
  { 
    value: "cde", 
    label: "CDE (Protestos)", 
    description: "Análise e parecer técnico sobre protestos e irregularidades.",
    areas: ["Jurídico", "Protestos"]
  },
];

const OPERATIONAL_ROLES = ROLES.filter((r) => !["super_admin", "admin", "secretaria"].includes(r.value));

function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
  if (role === "super_admin" || role === "admin") return "default";
  if (role === "secretaria") return "secondary";
  return "outline";
}

function statusLabel(u: any): {
  text: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  tooltip?: string;
} {
  if (!u.active) return { text: "Inativo", variant: "destructive", tooltip: "Conta desativada — sessões revogadas." };
  if (!u.last_sign_in_at) {
    return {
      text: "Convite enviado",
      variant: "outline",
      tooltip: "Convite criado, mas o usuário ainda não definiu senha nem fez o primeiro login. Reenvie o convite se necessário.",
    };
  }
  return { text: "Ativo", variant: "default", tooltip: "Usuário já concluiu o primeiro login." };
}

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function RoleLabel({ value }: { value: string }) {
  return ROLES.find((r) => r.value === value)?.label || value;
}

export default function AcessosUsuariosPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const { activeEvent } = useEventContext();
  const isSuperAdmin = hasRole("super_admin");
  const isAdmin = hasRole("admin");
  const canManageAllRoles = isSuperAdmin || isAdmin;
  const eventId = activeEvent?.id;

  // Filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRoles, setInviteRoles] = useState<string[]>([]);

  // User detail drawer
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRoles, setDrawerRoles] = useState<string[]>([]);
  const [drawerRolesDirty, setDrawerRolesDirty] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Sport & Stage links
  const [sportLinksUser, setSportLinksUser] = useState<{ id: string; name: string } | null>(null);
  const [stageLinksUser, setStageLinksUser] = useState<{ id: string; name: string } | null>(null);

  // Deactivation confirmation
  const [deactivateConfirm, setDeactivateConfirm] = useState<{ user_id: string; name: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const result = await callAdminUsers("list_users");
      return result.users || [];
    },
  });

  // Fetch sport links for all coordenador_modalidade users
  const coordUserIds = useMemo(() =>
    users.filter((u: any) => u.roles?.includes("coordenador_modalidade")).map((u: any) => u.user_id),
    [users]
  );

  const { data: allSportLinks = [] } = useQuery({
    queryKey: ["user-sport-links-all", eventId, coordUserIds],
    queryFn: async () => {
      if (!eventId || coordUserIds.length === 0) return [];
      const { data } = await supabase
        .from("user_sport_links")
        .select("id, user_id, sport_id, sports(name)")
        .eq("event_id", eventId)
        .in("user_id", coordUserIds);
      return data || [];
    },
    enabled: !!eventId && coordUserIds.length > 0,
  });

  // Group sport links by user_id for quick lookup
  const sportLinksByUser = useMemo(() => {
    const map: Record<string, { sport_id: string; name: string }[]> = {};
    for (const link of allSportLinks) {
      const uid = (link as any).user_id;
      if (!map[uid]) map[uid] = [];
      map[uid].push({ sport_id: (link as any).sport_id, name: (link as any).sports?.name || "—" });
    }
    return map;
  }, [allSportLinks]);

  // Fetch stage links for all users
  const { data: allStageLinks = [] } = useQuery({
    queryKey: ["user-stage-links-all", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data } = await supabase
        .from("user_stage_assignments")
        .select("id, user_id, event_stage_id, event_stages(name)")
        .eq("event_stages.event_id", eventId);
      return data || [];
    },
    enabled: !!eventId,
  });

  const stageLinksByUser = useMemo(() => {
    const map: Record<string, { stage_id: string; name: string }[]> = {};
    for (const link of allStageLinks) {
      const uid = (link as any).user_id;
      if (!uid) continue;
      if (!map[uid]) map[uid] = [];
      map[uid].push({ stage_id: (link as any).event_stage_id, name: (link as any).event_stages?.name || "—" });
    }
    return map;
  }, [allStageLinks]);

  // Drawer-specific sport links query
  const selectedUserIsCoord = drawerRoles.includes("coordenador_modalidade");
  const { data: drawerSportLinks = [], isLoading: loadingDrawerLinks } = useQuery({
    queryKey: ["user-sport-links", selectedUser?.user_id, eventId],
    queryFn: async () => {
      if (!eventId || !selectedUser?.user_id) return [];
      const { data } = await supabase
        .from("user_sport_links")
        .select("id, sport_id, sports(name)")
        .eq("user_id", selectedUser.user_id)
        .eq("event_id", eventId);
      return data || [];
    },
    enabled: drawerOpen && !!eventId && !!selectedUser?.user_id && !!selectedUserIsCoord,
  });

  const filteredUsers = useMemo(() => {
    let list = isSuperAdmin
      ? users
      : users.filter((u: any) => !u.roles?.includes("super_admin"));
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
        if (filterStatus === "pendente") return s.text === "Convite enviado";
        return true;
      });
    }
    return list;
  }, [users, isSuperAdmin, search, filterRole, filterStatus]);

  const openDrawer = async (u: any) => {
    setSelectedUser(u);
    setDrawerRoles(u.roles || []);
    setDrawerRolesDirty(false);
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

  const toggleDrawerRole = (role: string) => {
    setDrawerRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      return next;
    });
    setDrawerRolesDirty(true);
  };

  const toggleInviteRole = (role: string) => {
    setInviteRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  // Mutations
  const setRolesMutation = useMutation({
    mutationFn: (params: { user_id: string; roles: string[] }) =>
      callAdminUsers("set_roles", params),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Perfis atualizados com sucesso");
      setDrawerRolesDirty(false);
      if (selectedUser) {
        setSelectedUser((prev: any) => prev ? { ...prev, roles: vars.roles } : null);
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
      callAdminUsers("invite_user", {
        email: inviteEmail,
        full_name: inviteName || undefined,
        roles: inviteRoles,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Convite enviado!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRoles([]);
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

  const visibleRoles = isSuperAdmin ? ROLES : ROLES.filter((r) => r.value !== "super_admin");
  const availableRoles = canManageAllRoles ? visibleRoles : OPERATIONAL_ROLES;

  const handleSaveDrawerRoles = () => {
    if (!selectedUser) return;
    if (drawerRoles.length === 0) {
      toast.error("Selecione pelo menos um perfil");
      return;
    }
    if (selectedUser.user_id === user?.id && drawerRoles.length === 0) {
      toast.error("Você não pode remover todos os seus próprios perfis");
      return;
    }
    setRolesMutation.mutate({ user_id: selectedUser.user_id, roles: drawerRoles });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de acessos e permissões do sistema
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
            {visibleRoles.map((r) => (
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
            <SelectItem value="pendente">Convite enviado</SelectItem>
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
                <TableHead>Perfis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u: any) => {
                const status = statusLabel(u);
                const userRoles: string[] = u.roles || [];
                const isCoord = userRoles.includes("coordenador_modalidade");
                const userSports = isCoord ? (sportLinksByUser[u.user_id] || []) : [];
                const userStages = stageLinksByUser[u.user_id] || [];
                return (
                  <TableRow
                    key={u.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(u)}
                  >
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {userRoles.length === 0 ? (
                          <span className="text-muted-foreground text-xs">Sem perfil</span>
                        ) : userRoles.length === 1 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={roleBadgeVariant(userRoles[0])} className="cursor-help">
                                  <RoleLabel value={userRoles[0]} />
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{ROLES.find(r => r.value === userRoles[0])?.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Badge variant={roleBadgeVariant(userRoles[0])}>
                                    <RoleLabel value={userRoles[0]} />
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    +{userRoles.length - 1} mais
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-2 p-1">
                                  {userRoles.map((r: string) => {
                                    const roleData = ROLES.find(rd => rd.value === r);
                                    return (
                                      <div key={r} className="space-y-0.5">
                                        <div className="text-xs font-bold">{roleData?.label || r}</div>
                                        <div className="text-[10px] text-muted-foreground leading-tight max-w-[180px]">
                                          {roleData?.description}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {(userSports.length > 0 || userStages.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {userSports.map((s) => (
                              <Badge key={s.sport_id} variant="secondary" className="text-[10px] px-1.5 py-0 border-primary/20">
                                <Trophy className="h-2.5 w-2.5 mr-1" />
                                {s.name}
                              </Badge>
                            ))}
                            {userStages.map((s) => (
                              <Badge key={s.stage_id} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary bg-primary/5">
                                <Layers className="h-2.5 w-2.5 mr-1" />
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {isCoord && userSports.length === 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse mt-1">
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                            Sem modalidade
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant={status.variant} className="cursor-help">{status.text}</Badge>
                          </TooltipTrigger>
                          {status.tooltip && (
                            <TooltipContent className="max-w-xs">
                              <p className="text-xs">{status.tooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at ? (
                        format(new Date(u.last_sign_in_at), "dd/MM/yyyy HH:mm")
                      ) : (
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">Nunca</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  O usuário ainda não concluiu o primeiro login. O link do convite precisa ser finalizado (definir senha) para o acesso ser ativado.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {u.active && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                resendInviteMutation.mutate(u.user_id);
                              }}
                              disabled={resendInviteMutation.isPending}
                            >
                              <Mail className="mr-1 h-3 w-3" />
                              Reenviar
                            </Button>
                          )}
                        </div>
                      )}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar novo usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="usuario@email.com" />
            </div>
            <div className="space-y-1">
              <Label>Nome completo *</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo (mín. 3 caracteres)" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Perfis de Acesso *</Label>
              <p className="text-xs text-muted-foreground">Selecione todos os módulos que este usuário pode acessar</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {availableRoles.map((r) => (
                  <TooltipProvider key={r.value}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/50 transition-colors">
                          <Checkbox
                            checked={inviteRoles.includes(r.value)}
                            onCheckedChange={() => toggleInviteRole(r.value)}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium leading-none">{r.label}</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.areas.map((area) => (
                                <span key={area} className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        <p className="text-xs">{r.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              {inviteRoles.length === 0 && (
                <p className="text-xs text-destructive">Selecione pelo menos um perfil</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || !inviteName || inviteName.trim().length < 3 || inviteRoles.length === 0 || inviteMutation.isPending}
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

              {/* Vínculos Operacionais Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Vínculos Operacionais
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {drawerRoles.includes("coordenador_modalidade") && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="justify-start h-auto py-2 px-3"
                      onClick={() => setSportLinksUser({ id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email })}
                    >
                      <Trophy className="h-4 w-4 mr-2 text-primary" />
                      <div className="text-left">
                        <div className="font-medium text-xs">Vincular Modalidades</div>
                        <p className="text-[10px] text-muted-foreground">Define quais esportes o coordenador gerencia</p>
                      </div>
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="justify-start h-auto py-2 px-3"
                    onClick={() => setStageLinksUser({ id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email })}
                  >
                    <Layers className="h-4 w-4 mr-2 text-primary" />
                    <div className="text-left">
                      <div className="font-medium text-xs">Vínculo de Credenciamento (Etapas)</div>
                      <p className="text-[10px] text-muted-foreground">Restringe o acesso a etapas específicas</p>
                    </div>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Profiles */}
              <div className="space-y-3">
                <div>
                  <Label className="font-semibold text-base">Perfis de Acesso</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Selecione todos os módulos que este usuário pode acessar</p>
                </div>
                  <div className="space-y-1.5">
                    {availableRoles.map((r) => (
                      <TooltipProvider key={r.value}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <label className="flex items-start gap-2 cursor-pointer rounded-md border p-2.5 hover:bg-muted/50 transition-colors">
                              <Checkbox
                                checked={drawerRoles.includes(r.value)}
                                onCheckedChange={() => toggleDrawerRole(r.value)}
                                className="mt-0.5"
                              />
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium leading-none">{r.label}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {r.areas.map((area) => (
                                    <span key={area} className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                      {area}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </label>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[200px]">
                            <p className="text-xs">{r.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                {drawerRoles.length === 0 && (
                  <p className="text-xs text-destructive">Selecione pelo menos um perfil</p>
                )}
                {drawerRolesDirty && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={drawerRoles.length === 0 || setRolesMutation.isPending}
                    onClick={handleSaveDrawerRoles}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {setRolesMutation.isPending ? "Salvando..." : "Salvar Perfis"}
                  </Button>
                )}
                {selectedUserIsCoord && (
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

              {/* Modalidades Vinculadas */}
              {selectedUserIsCoord && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Modalidades Vinculadas
                    </Label>
                    {!eventId ? (
                      <p className="text-xs text-muted-foreground">Selecione um evento ativo para ver modalidades.</p>
                    ) : loadingDrawerLinks ? (
                      <div className="space-y-1">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-6 w-1/2" />
                      </div>
                    ) : drawerSportLinks.length === 0 ? (
                      <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 space-y-2">
                        <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Nenhuma modalidade vinculada
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Coordenadores de modalidade precisam de pelo menos uma modalidade vinculada para acessar o painel e gerenciar resultados.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full h-8 text-[10px]"
                          onClick={() => setSportLinksUser({ id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email })}
                        >
                          Vincular agora
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {drawerSportLinks.map((l: any) => (
                          <Badge key={l.id} variant="secondary" className="gap-1">
                            <Trophy className="h-3 w-3" />
                            {l.sports?.name || "—"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="space-y-2">
                <Label className="font-semibold">Ações</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{selectedUser.active ? "Desativar usuário" : "Ativar usuário"}</span>
                  <Switch
                    checked={selectedUser.active}
                    onCheckedChange={(active) => {
                      if (!active) {
                        setDeactivateConfirm({ user_id: selectedUser.user_id, name: selectedUser.full_name || selectedUser.email });
                      } else {
                        setActiveMutation.mutate({ user_id: selectedUser.user_id, active: true });
                      }
                    }}
                  />
                </div>

                {statusLabel(selectedUser).text === "Convite enviado" && (
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

      {/* Linked Resources Dialogs */}
      <SportLinksDialog
        open={!!sportLinksUser}
        onOpenChange={(open) => !open && setSportLinksUser(null)}
        userId={sportLinksUser?.id || ""}
        userName={sportLinksUser?.name || ""}
      />

      <StageLinksDialog
        open={!!stageLinksUser}
        onOpenChange={(open) => !open && setStageLinksUser(null)}
        userId={stageLinksUser?.id || ""}
        userName={stageLinksUser?.name || ""}
      />

      {/* Deactivation Confirmation */}
      <AlertDialog open={!!deactivateConfirm} onOpenChange={(open) => { if (!open) setDeactivateConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deactivateConfirm?.name}</strong> será desativado e todas as sessões ativas serão invalidadas. Ele não conseguirá acessar o sistema até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deactivateConfirm) {
                  setActiveMutation.mutate({ user_id: deactivateConfirm.user_id, active: false });
                  setDeactivateConfirm(null);
                }
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
