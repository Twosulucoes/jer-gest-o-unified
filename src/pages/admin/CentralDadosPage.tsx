import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import ModuleHeader from "@/components/admin/ModuleHeader";
import RequireActiveEvent from "@/components/admin/RequireActiveEvent";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Building2, Users, AlertTriangle, RefreshCw, Search, ExternalLink, Eye,
  XCircle, Loader2, ChevronRight, Database as DatabaseIcon
} from "lucide-react";

// ── Delegações Tab ──
function DelegacoesTab() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: delegations = [], isLoading } = useQuery({
    queryKey: ["central-dados-delegacoes", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, status, institution:institutions(id, name), notes")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["central-dados-deleg-stats", eventId],
    queryFn: async () => {
      // participants count per delegation
      const { data: parts } = await supabase
        .from("participants")
        .select("id, delegation_id")
        .eq("event_id", eventId);
      // pse count
      const { data: pses } = await supabase
        .from("participant_sport_events")
        .select("id, participant_id")
        .in("participant_id", (parts || []).map(p => p.id));
      // teams
      const { data: teams } = await supabase
        .from("teams")
        .select("id, delegation_id")
        .eq("event_id", eventId);
      // irregularities
      const { data: irregs } = await supabase
        .from("participation_irregularities")
        .select("id, participant_id, severity, status")
        .eq("event_id", eventId)
        .eq("status", "open")
        .eq("severity", "blocking");

      const partsByDel: Record<string, string[]> = {};
      (parts || []).forEach(p => {
        if (!partsByDel[p.delegation_id]) partsByDel[p.delegation_id] = [];
        partsByDel[p.delegation_id].push(p.id);
      });

      const pseByPart: Record<string, number> = {};
      (pses || []).forEach(p => {
        pseByPart[p.participant_id] = (pseByPart[p.participant_id] || 0) + 1;
      });

      const teamsByDel: Record<string, number> = {};
      (teams || []).forEach(t => {
        if (t.delegation_id) teamsByDel[t.delegation_id] = (teamsByDel[t.delegation_id] || 0) + 1;
      });

      const irregsByPart = new Set((irregs || []).map(i => i.participant_id));

      return { partsByDel, pseByPart, teamsByDel, irregsByPart };
    },
  });

  const { data: delegAthletes = [] } = useQuery({
    queryKey: ["central-dados-deleg-athletes", eventId, expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, status, participant_type, person:people(id, full_name, cpf)")
        .eq("event_id", eventId)
        .eq("delegation_id", expandedId);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instituição</TableHead>
            <TableHead className="text-center">Atletas</TableHead>
            <TableHead className="text-center">Inscrições</TableHead>
            <TableHead className="text-center">Equipes</TableHead>
            <TableHead className="text-center">Irregularidades</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {delegations.map((d: any) => {
            const partIds = stats?.partsByDel[d.id] || [];
            const pseCount = partIds.reduce((sum: number, pid: string) => sum + (stats?.pseByPart[pid] || 0), 0);
            const teamCount = stats?.teamsByDel[d.id] || 0;
            const irregCount = partIds.filter((pid: string) => stats?.irregsByPart.has(pid)).length;
            const isExpanded = expandedId === d.id;

            return (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                <TableCell className="font-medium">{d.institution?.name || "—"}</TableCell>
                <TableCell className="text-center">{partIds.length}</TableCell>
                <TableCell className="text-center">{pseCount}</TableCell>
                <TableCell className="text-center">{teamCount}</TableCell>
                <TableCell className="text-center">
                  {irregCount > 0 ? <Badge variant="destructive">{irregCount}</Badge> : <span className="text-muted-foreground">0</span>}
                </TableCell>
                <TableCell>
                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {expandedId && delegAthletes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Atletas da delegação</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegAthletes.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.person?.full_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.participant_type}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{a.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/admin/participantes/${a.id}`); }}>
                        <Eye className="h-3 w-3 mr-1" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Atletas Tab ──
function AtletasTab() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["central-dados-atletas", eventId, search],
    queryFn: async () => {
      let query = supabase
        .from("participants")
        .select("id, status, participant_type, delegation_id, person:people(id, full_name, cpf, birth_date, gender, email, phone), delegation:delegations(id, institution:institutions(name))")
        .eq("event_id", eventId)
        .order("created_at");
      if (search.trim()) {
        // search by person name
        query = query.ilike("person.full_name", `%${search.trim()}%`);
      }
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []).filter((p: any) => p.person !== null);
    },
  });

  // Detail data for selected participant
  const { data: detail } = useQuery({
    queryKey: ["central-dados-atleta-detail", selectedParticipant?.id],
    enabled: !!selectedParticipant,
    queryFn: async () => {
      const pid = selectedParticipant.id;
      // Inscriptions
      const { data: pses } = await supabase
        .from("participant_sport_events")
        .select("id, status, sport_event:sport_events(id, name, sport:sports(id, name, is_collective))")
        .eq("participant_id", pid);
      // Team memberships
      const { data: tms } = await supabase
        .from("team_members")
        .select("id, is_active, team:teams(id, name, sport_event:sport_events(name))")
        .eq("participant_id", pid);
      // Credentials
      const { data: creds } = await supabase
        .from("participant_credentials")
        .select("id, status, credential_code")
        .eq("participant_id", pid)
        .eq("event_id", eventId);
      // Irregularities
      const { data: irregs } = await supabase
        .from("participation_irregularities")
        .select("id, rule_code, severity, status, message")
        .eq("participant_id", pid)
        .eq("event_id", eventId)
        .eq("status", "open");
      return { pses: pses || [], teamMembers: tms || [], credentials: creds || [], irregularities: irregs || [] };
    },
  });

  const cancelPse = useMutation({
    mutationFn: async (pseId: string) => {
      const { error } = await supabase
        .from("participant_sport_events")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", pseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inscrição cancelada.");
      queryClient.invalidateQueries({ queryKey: ["central-dados-atleta-detail"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTeamMember = useMutation({
    mutationFn: async (tmId: string) => {
      const { error } = await supabase
        .from("team_members")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", tmId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atleta removido do time.");
      queryClient.invalidateQueries({ queryKey: ["central-dados-atleta-detail"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Escola</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.person?.full_name}</TableCell>
                <TableCell>{p.delegation?.institution?.name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{p.participant_type}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedParticipant(p)}>
                    <Eye className="h-3 w-3 mr-1" /> Detalhe
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/participantes/${p.id}`)}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {participants.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum participante encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedParticipant} onOpenChange={(o) => !o && setSelectedParticipant(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedParticipant?.person?.full_name}</DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-6">
              {/* Dados pessoais */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Dados Pessoais</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Gênero:</span> {selectedParticipant?.person?.gender}</div>
                  <div><span className="text-muted-foreground">Nascimento:</span> {selectedParticipant?.person?.birth_date}</div>
                  <div><span className="text-muted-foreground">CPF:</span> {selectedParticipant?.person?.cpf ? `***${selectedParticipant.person.cpf.slice(-4)}` : "—"}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedParticipant?.person?.email || "—"}</div>
                </div>
              </div>

              {/* Credenciamento */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Credenciamento</h4>
                {detail.credentials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma credencial emitida.</p>
                ) : (
                  detail.credentials.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                      <span className="text-xs text-muted-foreground">{c.credential_code}</span>
                    </div>
                  ))
                )}
                {detail.irregularities.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-semibold text-destructive">Irregularidades bloqueantes:</p>
                    {detail.irregularities.map((ir: any) => (
                      <div key={ir.id} className="text-xs text-destructive flex gap-2 items-center">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{ir.message}</span>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => navigate("/admin/irregularidades")}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Ir para Irregularidades
                    </Button>
                  </div>
                )}
              </div>

              {/* Inscrições */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Inscrições ({detail.pses.length})</h4>
                {detail.pses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem inscrições.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modalidade</TableHead>
                        <TableHead>Prova</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.pses.map((pse: any) => (
                        <TableRow key={pse.id}>
                          <TableCell className="text-sm">{pse.sport_event?.sport?.name || "—"}</TableCell>
                          <TableCell className="text-sm">{pse.sport_event?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={pse.status === "cancelled" ? "destructive" : "secondary"}>{pse.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {pse.status !== "cancelled" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <XCircle className="h-3 w-3 mr-1" /> Cancelar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      A inscrição em "{pse.sport_event?.name}" será marcada como cancelada. Esta ação pode ser revertida.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => cancelPse.mutate(pse.id)}>Confirmar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Equipes */}
              <div>
                <h4 className="font-semibold text-sm mb-2">Equipes ({detail.teamMembers.length})</h4>
                {detail.teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem equipes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Prova</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.teamMembers.map((tm: any) => (
                        <TableRow key={tm.id}>
                          <TableCell className="text-sm">{tm.team?.name || "—"}</TableCell>
                          <TableCell className="text-sm">{tm.team?.sport_event?.name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={tm.is_active ? "default" : "destructive"}>{tm.is_active ? "Sim" : "Não"}</Badge>
                          </TableCell>
                          <TableCell>
                            {tm.is_active && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <XCircle className="h-3 w-3 mr-1" /> Remover
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover do time?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O atleta será inativado na equipe "{tm.team?.name}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => removeTeamMember.mutate(tm.id)}>Confirmar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Pendências Tab ──
function PendenciasTab() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();

  const { data: irregularities = [], isLoading } = useQuery({
    queryKey: ["central-dados-pendencias", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participation_irregularities")
        .select("id, rule_code, severity, status, message, participant:participants(id, person:people(full_name), delegation:delegations(institution:institutions(name)))")
        .eq("event_id", eventId)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{irregularities.length} pendência(s) aberta(s).</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atleta</TableHead>
            <TableHead>Escola</TableHead>
            <TableHead>Regra</TableHead>
            <TableHead>Severidade</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {irregularities.map((ir: any) => (
            <TableRow key={ir.id}>
              <TableCell className="font-medium text-sm">{ir.participant?.person?.full_name || "—"}</TableCell>
              <TableCell className="text-sm">{ir.participant?.delegation?.institution?.name || "—"}</TableCell>
              <TableCell><Badge variant="outline">{ir.rule_code}</Badge></TableCell>
              <TableCell><Badge variant={ir.severity === "blocking" ? "destructive" : "secondary"}>{ir.severity}</Badge></TableCell>
              <TableCell className="text-xs max-w-[200px] truncate">{ir.message}</TableCell>
              <TableCell className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/participantes/${ir.participant?.id}`)}>
                  <Eye className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/admin/credenciamento")}>
                  <Users className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate("/admin/irregularidades")}>
                  <AlertTriangle className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {irregularities.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma pendência aberta.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Ações em Lote Tab ──
function AcoesLoteTab() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<any>(null);

  const refreshMap = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("refresh_sport_event_prova_map", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Mapa de provas atualizado.");
      setResult(data);
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recomputeIrregs = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recompute_participation_irregularities", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Irregularidades recalculadas.");
      setResult(data);
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reprocessAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_reprocess_event", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Reprocessamento completo.");
      setResult(data);
      queryClient.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isProcessing = refreshMap.isPending || recomputeIrregs.isPending || reprocessAll.isPending;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Mapa de Provas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Atualiza o mapa de normalização entre provas e slugs canônicos.</p>
            <Button size="sm" onClick={() => refreshMap.mutate()} disabled={isProcessing}>
              {refreshMap.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Atualizar mapa
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Irregularidades</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Recalcula todas as irregularidades de participação.</p>
            <Button size="sm" onClick={() => recomputeIrregs.mutate()} disabled={isProcessing}>
              {recomputeIrregs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Recalcular
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Reprocessar Tudo</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Executa mapa + irregularidades em sequência.</p>
            <Button size="sm" variant="default" onClick={() => reprocessAll.mutate()} disabled={isProcessing}>
              {reprocessAll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reprocessar tudo
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Resultado do processamento</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──
export default function CentralDadosPage() {
  return (
    <RequireActiveEvent>
      <div className="space-y-6">
        <ModuleHeader
          title="Central de Dados"
          description="Visão consolidada de delegações, atletas, pendências e ações de saneamento."
          icon={<DatabaseIcon className="h-5 w-5" />}
        />

        <Tabs defaultValue="delegacoes">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="delegacoes" className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Delegações</TabsTrigger>
            <TabsTrigger value="atletas" className="flex items-center gap-1"><Users className="h-3 w-3" /> Atletas</TabsTrigger>
            <TabsTrigger value="pendencias" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Pendências</TabsTrigger>
            <TabsTrigger value="acoes" className="flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Ações em lote</TabsTrigger>
          </TabsList>
          <TabsContent value="delegacoes"><DelegacoesTab /></TabsContent>
          <TabsContent value="atletas"><AtletasTab /></TabsContent>
          <TabsContent value="pendencias"><PendenciasTab /></TabsContent>
          <TabsContent value="acoes"><AcoesLoteTab /></TabsContent>
        </Tabs>
      </div>
    </RequireActiveEvent>
  );
}
