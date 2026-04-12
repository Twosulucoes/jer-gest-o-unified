import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Trophy, Users, Search, RefreshCw, Award } from "lucide-react";

type ValidationStatus = "APTA" | "INAPTA" | "INDIVIDUAL_UNICO";

interface SportEventRow {
  id: string;
  name: string;
  sport_name: string;
  sport_id: string;
  is_collective: boolean;
  category_name: string;
  gender_scope: string;
  confirmed_count: number;
  team_count: number;
  max_team_members: number;
  minimo: number;
  status: ValidationStatus;
  reason: string;
  released_at: string | null;
  rules_id: string | null;
  // For individual único
  solo_athlete_name?: string;
  solo_athlete_school?: string;
  solo_participant_id?: string;
  solo_pse_id?: string;
  family?: string;
}

export default function PreValidacaoPage() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmDialog, setConfirmDialog] = useState<{ type: "release" | "champion"; row: SportEventRow } | null>(null);
  const [championMark, setChampionMark] = useState("");

  // Step 1: Auto-sync collective teams
  const syncMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_collective_teams", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
    onError: (e: any) => {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    },
  });

  // Auto-trigger sync on mount
  useEffect(() => {
    if (eventId) {
      syncMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Step 2: Fetch all sport_events with counts
  const { data: rows = [], isLoading: loadingData, refetch } = useQuery({
    queryKey: ["pre-validacao", eventId],
    enabled: !!eventId && !syncMut.isPending,
    queryFn: async () => {
      // Fetch sport_events
      const { data: sportEvents, error: seErr } = await supabase
        .from("sport_events")
        .select("id, name, slug, sport_id, category_id, sports(name, is_collective), categories(name, gender_scope)")
        .eq("event_id", eventId!)
        .eq("is_active", true)
        .order("name");
      if (seErr) throw seErr;

      // Fetch rules
      const { data: rules, error: rulesErr } = await supabase
        .from("sport_event_rules")
        .select("id, sport_event_id, rules, released_at, released_by")
        .eq("event_id", eventId!);
      if (rulesErr) throw rulesErr;

      const rulesMap = new Map(rules?.map((r: any) => [r.sport_event_id, r]) ?? []);

      // Fetch confirmed PSE counts per sport_event
      const { data: pseCounts, error: pseErr } = await supabase
        .from("participant_sport_events")
        .select("sport_event_id, participant_id, status")
        .in("sport_event_id", sportEvents?.map((se: any) => se.id) ?? []);
      if (pseErr) throw pseErr;

      // Group confirmed by sport_event
      const confirmedMap = new Map<string, { count: number; participants: any[] }>();
      for (const pse of pseCounts ?? []) {
        if (!["confirmed", "approved", "valid", "active"].includes(pse.status)) continue;
        const entry = confirmedMap.get(pse.sport_event_id) ?? { count: 0, participants: [] };
        entry.count++;
        entry.participants.push(pse);
        confirmedMap.set(pse.sport_event_id, entry);
      }

      // Fetch teams with member counts
      const { data: teams, error: teamsErr } = await supabase
        .from("teams")
        .select("id, sport_event_id, delegation_id, status, team_members(id, is_active)")
        .eq("event_id", eventId!)
        .eq("status", "active");
      if (teamsErr) throw teamsErr;

      const teamMap = new Map<string, { count: number; maxMembers: number }>();
      for (const t of teams ?? []) {
        const entry = teamMap.get(t.sport_event_id) ?? { count: 0, maxMembers: 0 };
        const activeMembers = (t.team_members ?? []).filter((m: any) => m.is_active).length;
        if (activeMembers > 0) entry.count++;
        entry.maxMembers = Math.max(entry.maxMembers, activeMembers);
        teamMap.set(t.sport_event_id, entry);
      }

      // Build rows
      const result: SportEventRow[] = [];

      for (const se of sportEvents ?? []) {
        const sport = se.sports as any;
        const cat = se.categories as any;
        const rule = rulesMap.get(se.id) as any;
        const rulesJson = rule?.rules as any;
        const minimo = rulesJson?.minimo_participantes ?? 2;
        const isCollective = sport?.is_collective === true;
        const confirmed = confirmedMap.get(se.id) ?? { count: 0, participants: [] };
        const teamInfo = teamMap.get(se.id) ?? { count: 0, maxMembers: 0 };

        let status: ValidationStatus;
        let reason = "";

        if (isCollective) {
          if (teamInfo.count === 0) {
            status = "INAPTA";
            reason = "Nenhuma equipe formada";
          } else if (teamInfo.maxMembers < minimo) {
            status = "INAPTA";
            reason = `Maior equipe tem ${teamInfo.maxMembers} membros — mínimo: ${minimo}`;
          } else {
            status = "APTA";
          }
        } else {
          if (confirmed.count === 0) {
            status = "INAPTA";
            reason = "Sem inscrições — verificar dados da importação";
          } else if (confirmed.count === 1) {
            status = "INDIVIDUAL_UNICO";
            reason = "1 atleta inscrito — classificação direta";
          } else if (confirmed.count < minimo) {
            status = "INAPTA";
            reason = `${confirmed.count} atletas inscritos — mínimo necessário: ${minimo}`;
          } else {
            status = "APTA";
          }
        }

        const row: SportEventRow = {
          id: se.id,
          name: se.name,
          sport_name: sport?.name ?? "—",
          sport_id: se.sport_id,
          is_collective: isCollective,
          category_name: cat?.name ?? "—",
          gender_scope: cat?.gender_scope ?? "mixed",
          confirmed_count: confirmed.count,
          team_count: teamInfo.count,
          max_team_members: teamInfo.maxMembers,
          minimo,
          status,
          reason,
          released_at: rule?.released_at ?? null,
          rules_id: rule?.id ?? null,
          family: rulesJson?.family,
        };

        // For individual único, fetch athlete info
        if (status === "INDIVIDUAL_UNICO" && confirmed.participants.length === 1) {
          const pse = confirmed.participants[0];
          row.solo_pse_id = pse.participant_id; // actually participant_id from PSE
          // We'll fetch names in a secondary pass
        }

        result.push(row);
      }

      // Fetch solo athlete names
      const soloRows = result.filter((r) => r.status === "INDIVIDUAL_UNICO" && r.solo_pse_id);
      if (soloRows.length > 0) {
        const participantIds = soloRows.map((r) => r.solo_pse_id!);
        const { data: participants } = await supabase
          .from("participants")
          .select("id, participant_type, person_id, delegation_id, people(full_name), delegations(institutions(name))")
          .in("id", participantIds);

        const pMap = new Map((participants ?? []).map((p: any) => [p.id, p]));
        for (const row of soloRows) {
          const p = pMap.get(row.solo_pse_id!);
          if (p) {
            row.solo_athlete_name = (p.people as any)?.full_name ?? "—";
            row.solo_athlete_school = (p.delegations as any)?.institutions?.name ?? "—";
            row.solo_participant_id = p.id;
          }
        }
      }

      return result;
    },
  });

  // Release mutation
  const releaseMut = useMutation({
    mutationFn: async (row: SportEventRow) => {
      if (!row.rules_id) {
        // Create rules entry first
        const { error } = await supabase.from("sport_event_rules").insert({
          sport_event_id: row.id,
          event_id: eventId!,
          rules: { minimo_participantes: row.minimo } as any,
          is_active: true,
          released_at: new Date().toISOString(),
          released_by: user?.id,
          created_by: user?.id,
          updated_by: user?.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sport_event_rules")
          .update({
            released_at: new Date().toISOString(),
            released_by: user?.id,
            updated_by: user?.id,
          })
          .eq("id", row.rules_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Prova liberada", description: "Disponível na Central da Competição." });
      qc.invalidateQueries({ queryKey: ["pre-validacao"] });
      setConfirmDialog(null);
    },
    onError: (e: any) => toast({ title: "Erro ao liberar", description: e.message, variant: "destructive" }),
  });

  // Champion mutation (individual único)
  const championMut = useMutation({
    mutationFn: async ({ row, mark }: { row: SportEventRow; mark: string }) => {
      // 1. Create a phase for this sport_event
      const { data: phase, error: phaseErr } = await supabase
        .from("competition_phases")
        .insert({
          event_id: eventId!,
          sport_event_id: row.id,
          name: "Classificação Direta",
          phase_type: "direct",
          status: "completed",
          sort_order: 0,
        })
        .select("id")
        .single();
      if (phaseErr) throw phaseErr;

      // 2. Create a match
      const { data: match, error: matchErr } = await supabase
        .from("competition_matches")
        .insert({
          event_id: eventId!,
          phase_id: phase.id,
          sport_event_id: row.id,
          status: "completed",
          match_number: 1,
          notes: "Classificação direta — atleta único",
        })
        .select("id")
        .single();
      if (matchErr) throw matchErr;

      // 3. Get PSE id
      const { data: pseData } = await supabase
        .from("participant_sport_events")
        .select("id")
        .eq("sport_event_id", row.id)
        .eq("participant_id", row.solo_participant_id!)
        .single();

      // 4. Create match entry
      const { data: entry, error: entryErr } = await supabase
        .from("competition_match_entries")
        .insert({
          match_id: match.id,
          participant_sport_event_id: pseData?.id ?? null,
          side: "home",
          seed: 1,
        })
        .select("id")
        .single();
      if (entryErr) throw entryErr;

      // 5. Create result
      const resultPayload: any = {
        match_id: match.id,
        match_entry_id: entry.id,
        position: 1,
        outcome: "win",
        result_status: "resultado_lancado",
        recorded_by: user!.id,
        notes: "Classificação direta — atleta único na prova",
      };

      // Add mark based on family
      if (mark) {
        if (row.family === "time") resultPayload.time_ms = parseInt(mark, 10) || null;
        else if (row.family === "mark") resultPayload.distance_cm = parseInt(mark, 10) || null;
        else resultPayload.points = parseFloat(mark) || null;
      }

      const { error: resultErr } = await supabase
        .from("competition_match_results")
        .insert(resultPayload);
      if (resultErr) throw resultErr;

      // 6. Release the sport_event
      if (row.rules_id) {
        await supabase
          .from("sport_event_rules")
          .update({
            released_at: new Date().toISOString(),
            released_by: user?.id,
            updated_by: user?.id,
          })
          .eq("id", row.rules_id);
      }
    },
    onSuccess: () => {
      toast({ title: "Campeão registrado", description: "Prova liberada com resultado direto." });
      qc.invalidateQueries({ queryKey: ["pre-validacao"] });
      setConfirmDialog(null);
      setChampionMark("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Derived data
  const sports = useMemo(() => {
    const unique = new Map<string, string>();
    rows.forEach((r) => unique.set(r.sport_id, r.sport_name));
    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sportFilter !== "all" && r.sport_id !== sportFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.sport_name.toLowerCase().includes(q) &&
          !r.category_name.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [rows, sportFilter, statusFilter, search]);

  const totals = useMemo(() => ({
    total: rows.length,
    aptas: rows.filter((r) => r.status === "APTA").length,
    inaptas: rows.filter((r) => r.status === "INAPTA").length,
    unicos: rows.filter((r) => r.status === "INDIVIDUAL_UNICO").length,
    liberadas: rows.filter((r) => r.released_at).length,
  }), [rows]);

  const genderLabel = (g: string) =>
    g === "masculino" ? "Masc" : g === "feminino" ? "Fem" : "Misto";

  const statusBadge = (r: SportEventRow) => {
    if (r.released_at) return <Badge variant="success">Liberada</Badge>;
    switch (r.status) {
      case "APTA":
        return <Badge variant="success">Apta</Badge>;
      case "INAPTA":
        return <Badge variant="destructive">Inapta</Badge>;
      case "INDIVIDUAL_UNICO":
        return <Badge variant="warning">Individual Único</Badge>;
    }
  };

  // Loading state
  if (syncMut.isPending) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-lg">Sincronizando inscrições...</p>
      </div>
    );
  }

  // Error state
  if (syncMut.isError && !rows.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <XCircle className="h-10 w-10 text-destructive" />
        <p className="text-destructive text-lg">Erro ao sincronizar equipes</p>
        <p className="text-muted-foreground text-sm">{(syncMut.error as any)?.message}</p>
        <Button onClick={() => syncMut.mutate()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/pre-validacao"
        title="Pré-validação de Provas"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total de Provas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Aptas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">{totals.aptas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Inaptas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totals.inaptas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-warning">Individual Único</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-warning">{totals.unicos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Liberadas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals.liberadas}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prova..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="APTA">Apta</SelectItem>
            <SelectItem value="INAPTA">Inapta</SelectItem>
            <SelectItem value="INDIVIDUAL_UNICO">Individual Único</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => { syncMut.mutate(); }} title="Ressincronizar">
          <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Empty */}
      {!loadingData && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Trophy className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg">Nenhuma prova encontrada para este evento</p>
        </div>
      )}

      {/* Loading data */}
      {loadingData && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Table */}
      {!loadingData && filtered.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Prova</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead className="text-center">Inscritos</TableHead>
                  <TableHead className="text-center">Equipes</TableHead>
                  <TableHead className="text-center">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.sport_name}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.category_name}</TableCell>
                    <TableCell>{genderLabel(row.gender_scope)}</TableCell>
                    <TableCell className="text-center">{row.confirmed_count}</TableCell>
                    <TableCell className="text-center">{row.is_collective ? row.team_count : "—"}</TableCell>
                    <TableCell className="text-center">{row.minimo}</TableCell>
                    <TableCell>
                      {statusBadge(row)}
                      {row.status === "INAPTA" && (
                        <p className="text-xs text-muted-foreground mt-1">{row.reason}</p>
                      )}
                      {row.status === "INDIVIDUAL_UNICO" && row.solo_athlete_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {row.solo_athlete_name} — {row.solo_athlete_school}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.released_at ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Liberada
                        </Badge>
                      ) : row.status === "APTA" ? (
                        <Button
                          size="sm"
                          onClick={() => setConfirmDialog({ type: "release", row })}
                        >
                          Liberar para Central
                        </Button>
                      ) : row.status === "INDIVIDUAL_UNICO" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmDialog({ type: "champion", row })}
                        >
                          <Award className="h-3.5 w-3.5 mr-1" />
                          Registrar campeão
                        </Button>
                      ) : row.reason.startsWith("Sem inscrições") ? (
                        <span className="text-xs text-muted-foreground italic">Sem ação</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            window.open(`/admin/competicao/regras?sport_event_id=${row.id}`, "_self");
                          }}
                        >
                          Ajustar mínimo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirm Release Dialog */}
      {confirmDialog?.type === "release" && (
        <Dialog open onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar liberação</DialogTitle>
              <DialogDescription>
                Confirmar liberação de <strong>{confirmDialog.row.name}</strong> ({confirmDialog.row.sport_name}) para a fase de competição?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
              <Button
                onClick={() => releaseMut.mutate(confirmDialog.row)}
                disabled={releaseMut.isPending}
              >
                {releaseMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Champion Dialog */}
      {confirmDialog?.type === "champion" && (
        <Dialog open onOpenChange={() => { setConfirmDialog(null); setChampionMark(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar como campeão</DialogTitle>
              <DialogDescription>
                O atleta <strong>{confirmDialog.row.solo_athlete_name}</strong> ({confirmDialog.row.solo_athlete_school}) será registrado como 1º lugar em <strong>{confirmDialog.row.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Lançar resultado/marca (opcional)
              </label>
              <Input
                placeholder={
                  confirmDialog.row.family === "time"
                    ? "Tempo em ms (ex: 12340)"
                    : confirmDialog.row.family === "mark"
                      ? "Distância em cm (ex: 650)"
                      : "Pontuação"
                }
                value={championMark}
                onChange={(e) => setChampionMark(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {confirmDialog.row.family === "time"
                  ? "Informe o tempo em milissegundos"
                  : confirmDialog.row.family === "mark"
                    ? "Informe a distância em centímetros"
                    : "Informe a pontuação"}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setConfirmDialog(null); setChampionMark(""); }}>Cancelar</Button>
              <Button
                onClick={() => championMut.mutate({ row: confirmDialog.row, mark: championMark })}
                disabled={championMut.isPending}
              >
                {championMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Registrar e liberar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
