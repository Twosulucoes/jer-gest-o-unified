import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ASSIGNMENT_ROLES = [
  { value: "mesario", label: "Mesário" },
  { value: "arbitro_principal", label: "Árbitro Principal" },
  { value: "arbitro_auxiliar", label: "Árbitro Auxiliar" },
  { value: "fiscal", label: "Fiscal" },
  { value: "anotador", label: "Anotador" },
];

interface Props {
  matchId: string;
  eventId: string;
  canWrite: boolean;
}

export default function MatchUserAssignmentsCard({ matchId, eventId, canWrite }: Props) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  // RLS de match_user_assignments só permite INSERT/UPDATE/DELETE para
  // admin, coordenacao_tecnica e coordenador_modalidade. Secretaria tem
  // apenas leitura, então o botão Designar precisa ficar oculto pra ela
  // mesmo que `canWrite` (escopo geral da partida) seja verdadeiro.
  const canManageAssignments =
    canWrite &&
    (hasRole("admin") ||
      hasRole("coordenacao_tecnica") ||
      hasRole("coordenador_modalidade"));

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ["match_user_assignments", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const assignedUserIds = assignments.map((a: any) => a.user_id);
  const { data: assignedProfiles = [] } = useQuery({
    queryKey: ["profiles_for_assignments", assignedUserIds.length, assignedUserIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!assignedUserIds.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", assignedUserIds);
      if (error) throw error;
      return data;
    },
    enabled: assignedUserIds.length > 0,
  });
  const profileMap = new Map(assignedProfiles.map((p) => [p.id, p]));

  const {
    data: searchResults = [],
    isFetching: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ["search_users_for_assignment", search],
    queryFn: async () => {
      const term = search.trim();
      if (term.length < 2) return [];
      // Escapa caracteres especiais do PostgREST (% , _ , vírgula) para evitar
      // que o ilike quebre quando o usuário digita pontuação.
      const safe = term.replace(/[%_,()]/g, (c) => `\\${c}`);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${safe}%`)
        .order("full_name", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: search.trim().length >= 2,
  });

  const { data: assignmentCounts = [] } = useQuery({
    queryKey: ["assignment_counts", eventId, assignedUserIds.length],
    queryFn: async () => {
      if (!assignedUserIds.length) return [];
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select("user_id")
        .eq("event_id", eventId);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data as any[]).forEach((d: any) => {
        counts.set(d.user_id, (counts.get(d.user_id) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([uid, count]) => ({ user_id: uid, count }));
    },
    enabled: assignedUserIds.length > 0,
  });
  const countMap = new Map(assignmentCounts.map((c: any) => [c.user_id, c.count]));

  const addMut = useMutation({
    mutationFn: async () => {
      if (!canManageAssignments) {
        throw new Error(
          "Seu perfil não tem permissão para designar oficiais. Apenas Admin, Coordenação Técnica e Coordenador de Modalidade podem realizar essa ação.",
        );
      }
      if (!selectedUserId || !selectedRole) throw new Error("Selecione usuário e função");

      // Fetch the target match and validate status / scheduling
      const { data: match, error: mErr } = await supabase
        .from("competition_matches")
        .select("id, status, match_date, start_time, end_time, event_id")
        .eq("id", matchId)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!match) throw new Error("Partida não encontrada");
      if (match.event_id !== eventId) throw new Error("Partida fora do evento ativo");

      const BLOCKED = new Set(["cancelled", "canceled", "wo", "w_o", "draft"]);
      if (BLOCKED.has((match.status ?? "").toLowerCase())) {
        throw new Error(`Partida com status inválido (${match.status}) — não é permitido escalar.`);
      }
      if (!match.match_date || !match.start_time) {
        throw new Error("Partida sem data/hora — defina antes de escalar.");
      }

      // Conflict check: same user already assigned to an overlapping match in the same event/day
      const start = new Date(`${match.match_date}T${match.start_time}`);
      const end = match.end_time
        ? new Date(`${match.match_date}T${match.end_time}`)
        : new Date(start.getTime() + 90 * 60 * 1000);

      const { data: existing, error: eErr } = await supabase
        .from("match_user_assignments" as any)
        .select(
          "match_id, competition_matches!inner(id, match_date, start_time, end_time)",
        )
        .eq("event_id", eventId)
        .eq("user_id", selectedUserId)
        .eq("competition_matches.match_date", match.match_date)
        .neq("match_id", matchId);
      if (eErr) throw eErr;

      for (const row of (existing as any[]) ?? []) {
        const cm = row.competition_matches;
        if (!cm?.start_time) continue;
        const s = new Date(`${cm.match_date}T${cm.start_time}`);
        const e = cm.end_time
          ? new Date(`${cm.match_date}T${cm.end_time}`)
          : new Date(s.getTime() + 90 * 60 * 1000);
        if (start < e && s < end) {
          throw new Error(
            "Conflito de horário: este oficial já está escalado em outra partida no mesmo intervalo.",
          );
        }
      }

      const { error } = await supabase.from("match_user_assignments" as any).insert({
        match_id: matchId,
        user_id: selectedUserId,
        role: selectedRole,
        event_id: eventId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_user_assignments", matchId] });
      qc.invalidateQueries({ queryKey: ["assignment_counts", eventId] });
      toast.success("Designação adicionada");
      setSelectedUserId("");
      setSelectedRole("");
      setSearch("");
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error("Erro ao designar", { description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      if (!canManageAssignments) {
        throw new Error(
          "Seu perfil não tem permissão para remover designações.",
        );
      }
      const { error } = await supabase.from("match_user_assignments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_user_assignments", matchId] });
      toast.success("Designação removida");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const getRoleLabel = (role: string) => ASSIGNMENT_ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />Designações de Oficiais
          </CardTitle>
          {canManageAssignments && (
            <Button size="sm" variant="outline" onClick={() => { setSearch(""); setSelectedUserId(""); setSelectedRole(""); setAddOpen(true); }}>
              <Plus className="mr-1 h-3.5 w-3.5" />Designar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum oficial designado.</p>
          ) : (
            <div className="space-y-1.5">
              {assignments.map((a: any) => {
                const profile = profileMap.get(a.user_id);
                const count = countMap.get(a.user_id) || 0;
                return (
                  <div key={a.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-medium">{profile?.full_name ?? "Usuário"}</span>
                        <Badge variant="secondary" className="text-[10px]">{getRoleLabel(a.role)}</Badge>
                        {count > 1 && (
                          <Badge variant="outline" className="text-[10px]">{count} partidas no evento</Badge>
                        )}
                      </div>
                      {canManageAssignments && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setRemoveId(a.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 border-t pt-2 mt-1">
                      {a.acceptance_status === 'confirmed' ? (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmado
                        </div>
                      ) : a.acceptance_status === 'unavailable' ? (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Indisponível: {a.indisponibility_reason || "Não informado"}
                          {a.reported_at && (
                            <span className="text-[9px] text-muted-foreground ml-1">
                              ({format(parseISO(a.reported_at), "HH:mm")})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <Clock className="h-3.5 w-3.5" />
                          Pendente
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Designar oficial</DialogTitle>
            <DialogDescription>Busque por nome e selecione a função.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar usuário</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do usuário..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedUserId(""); }}
                  className="pl-9"
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="border rounded-md max-h-[180px] overflow-y-auto">
                  {searchLoading ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                  ) : searchError ? (
                    <p className="px-3 py-2 text-xs text-destructive">
                      Erro ao buscar usuários: {(searchError as Error).message}
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhum usuário encontrado para “{search.trim()}”.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${selectedUserId === u.id ? "bg-primary/10 font-medium" : ""}`}
                          onClick={() => setSelectedUserId(u.id)}
                        >
                          {u.full_name ?? "Sem nome"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {search.trim().length > 0 && search.trim().length < 2 && (
                <p className="text-[11px] text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Função</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !selectedUserId || !selectedRole}>
              {addMut.isPending ? "Salvando..." : "Designar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(open) => { if (!open) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover designação?</AlertDialogTitle>
            <AlertDialogDescription>O oficial será removido desta partida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (removeId) removeMut.mutate(removeId); setRemoveId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
