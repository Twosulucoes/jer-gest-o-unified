import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Key, LogOut as LogOutIcon, Plus, UserPlus, Link2, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("secretaria");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [sportLinksUser, setSportLinksUser] = useState<{ id: string; name: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const result = await callAdminUsers("list_users");
      return result.users || [];
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: (params: { user_id: string; role: string }) =>
      callAdminUsers("set_role", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Perfil atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setActiveMutation = useMutation({
    mutationFn: (params: { user_id: string; active: boolean }) =>
      callAdminUsers("set_active", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast.success("Status atualizado");
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
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => callAdminUsers("generate_reset_link", { email: resetEmail }),
    onSuccess: (data: any) => {
      setResetLink(data.action_link || "");
      if (data.action_link) toast.success("Link gerado!");
      else toast.error("Não foi possível gerar o link.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Gestão de Acessos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie usuários, convites e recuperação de senha.</p>
        </div>
      </div>

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="convites">Convites</TabsTrigger>
          <TabsTrigger value="recuperacao">Recuperação</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : !users.length ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={u.roles[0] || ""}
                          onValueChange={(role) => setRoleMutation.mutate({ user_id: u.user_id, role })}
                        >
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.active}
                          onCheckedChange={(active) => setActiveMutation.mutate({ user_id: u.user_id, active })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeMutation.mutate(u.user_id)}
                          title="Revogar sessões"
                        >
                          <LogOutIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="convites" className="space-y-4">
          <div className="max-w-md space-y-4 p-4 rounded-lg border bg-card">
            <h3 className="font-semibold text-foreground">Convidar novo usuário</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="usuario@email.com" />
              </div>
              <div className="space-y-1">
                <Label>Nome (opcional)</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1">
                <Label>Perfil</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => inviteMutation.mutate()} disabled={!inviteEmail || inviteMutation.isPending} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                {inviteMutation.isPending ? "Enviando..." : "Enviar convite"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recuperacao" className="space-y-4">
          <div className="max-w-md space-y-4 p-4 rounded-lg border bg-card">
            <h3 className="font-semibold text-foreground">Gerar link de recuperação</h3>
            <p className="text-sm text-muted-foreground">O link gerado permite ao usuário redefinir sua senha. Envie por canal institucional.</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Email do usuário</Label>
                <Input value={resetEmail} onChange={(e) => { setResetEmail(e.target.value); setResetLink(""); }} type="email" placeholder="usuario@email.com" />
              </div>
              <Button onClick={() => resetMutation.mutate()} disabled={!resetEmail || resetMutation.isPending} className="w-full">
                <Key className="mr-2 h-4 w-4" />
                {resetMutation.isPending ? "Gerando..." : "Gerar link"}
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
