
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Trophy, 
  Save, 
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { BackButton } from "@/components/navigation/BackButton";
import { useActiveEventId } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { 
  formatTimeMs, 
  parseTimeFormatted, 
  formatDistanceCm, 
  parseDistanceFormatted 
} from "@/lib/competition-formatters";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function CompeticaoLancamentoTimeMarkPage() {
  const { matchId, sportEventId } = useParams();
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  
  const canWrite = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("mesario");

  // Fetch match details
  const { data: match, isLoading: loadingMatch, refetch: refetchMatch } = useQuery({
    queryKey: ["match-detail", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          phase:competition_phases(id, name, phase_type),
          group:competition_groups(id, name),
          venue:venues(id, name),
          entries:competition_match_entries(
            id, side, team_id, participant_sport_event_id,
            participant_sport_events(
              id,
              participants(
                id, 
                registration_number,
                people(id, full_name, avatar_url),
                institutions:institutions(id, name)
              )
            ),
            results:competition_match_results(*)
          )
        `)
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { rules, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  const mode = useMemo(() => {
    if (!rules) return 'A';
    if (rules.family === 'mark') return 'B';
    if (rules.format === 'ranking' || rules.family === 'ranking') return 'C';
    return 'A';
  }, [rules]);

  // State for result entries
  const [entries, setEntries] = useState<any[]>([]);
  const [observations, setObservations] = useState("");
  const [showHomologateDialog, setShowHomologateDialog] = useState(false);
  const [homologatePassword, setHomologatePassword] = useState("");
  const [homologateObservation, setHomologateObservation] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateEntriesInfo, setDuplicateEntriesInfo] = useState<{pos: number, names: string[]}[]>([]);

  // Initialize state from match data
  useEffect(() => {
    if (match?.entries) {
      const initialEntries = match.entries.map((entry: any) => {
        const result = entry.results?.[0] || {};
        return {
          match_entry_id: entry.id,
          participant_id: entry.participant_sport_events?.participants?.id,
          name: entry.participant_sport_events?.participants?.people?.full_name,
          institution: entry.participant_sport_events?.participants?.institutions?.name,
          registration_number: entry.participant_sport_events?.participants?.registration_number,
          lane: entry.side,
          time_ms: result.time_ms || null,
          distance_cm: result.distance_cm || null,
          outcome: result.outcome || 'active',
          rank: result.outcome === 'active' ? null : null, // Will calculate rank
          notes: result.penalty_notes || "",
          attempts: [] // Placeholder for Mode B
        };
      });
      setEntries(initialEntries);
    }
  }, [match]);

  // Fetch attempts for Mode B
  const { data: dbAttempts = [] } = useQuery({
    queryKey: ["match-attempts", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_attempts")
        .select("*")
        .eq("match_id", matchId)
        .order("attempt_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && mode === 'B',
  });

  useEffect(() => {
    if (dbAttempts.length > 0 && mode === 'B') {
      setEntries(prev => prev.map(entry => {
        const entryAttempts = dbAttempts.filter(a => a.match_entry_id === entry.match_entry_id);
        return { ...entry, attempts: entryAttempts };
      }));
    } else if (mode === 'B' && rules?.family === 'mark') {
      // Initialize empty attempts based on rules
      const numAttempts = (rules as any)?.mark_attempts || 3;
      setEntries(prev => prev.map(entry => {
        if (entry.attempts.length === 0) {
          const emptyAttempts = Array.from({ length: numAttempts }).map((_, i) => ({
            attempt_number: i + 1,
            value_cm: null,
            is_valid: true,
            notes: ""
          }));
          return { ...entry, attempts: emptyAttempts };
        }
        return entry;
      }));
    }
  }, [dbAttempts, mode, rules]);

  const resultStatus = match?.entries?.[0]?.results?.[0]?.result_status || "agendado";
  const isLocked = (resultStatus === 'resultado_validado' || resultStatus === 'publicado') && !hasRole("admin");
  const canHomologate = (hasRole("admin") || hasRole("coordenacao_tecnica")) && resultStatus === "resultado_lancado";

  // Position/Rank calculation
  const calculatedEntries = useMemo(() => {
    if (mode === 'C') return entries; // Manual rank in Mode C

    const validEntries = entries.filter(e => e.outcome === 'active');
    
    let sorted: any[] = [];
    if (mode === 'A') {
      // Lower time is better
      sorted = [...validEntries].sort((a, b) => {
        if (a.time_ms === null) return 1;
        if (b.time_ms === null) return -1;
        return a.time_ms - b.time_ms;
      });
    } else {
      // Mode B: Higher distance is better
      const withBest = entries.map(e => {
        const validAttempts = e.attempts.filter((a: any) => a.is_valid && a.value_cm !== null);
        const best = validAttempts.length > 0 ? Math.max(...validAttempts.map((a: any) => a.value_cm)) : null;
        return { ...e, best_mark: best };
      });
      
      sorted = withBest.filter(e => e.outcome === 'active').sort((a, b) => {
        if (a.best_mark === null) return 1;
        if (b.best_mark === null) return -1;
        return b.best_mark - a.best_mark;
      });

      return entries.map(e => {
        const entryWithBest = withBest.find(wb => wb.match_entry_id === e.match_entry_id);
        if (e.outcome !== 'active' || (entryWithBest && entryWithBest.best_mark === null)) {
          return { ...e, rank: null, best_mark: entryWithBest?.best_mark };
        }
        
        // Correction 4: Tie handling (1, 1, 3)
        const betterCount = sorted.filter(s => s.best_mark > (entryWithBest?.best_mark || 0)).length;
        return { 
          ...e, 
          rank: betterCount + 1,
          best_mark: entryWithBest?.best_mark
        };
      });
    }

    return entries.map(e => {
      if (e.outcome !== 'active' || e.time_ms === null) return { ...e, rank: null };
      
      // Correction 4: Tie handling (1, 1, 3)
      const betterCount = sorted.filter(s => s.time_ms !== null && s.time_ms < e.time_ms!).length;
      return { 
        ...e, 
        rank: betterCount + 1 
      };
    });
  }, [entries, mode]);

  const launchMut = useMutation({
    mutationFn: async () => {
      // Validate
      const hasAnyData = calculatedEntries.some(e => 
        (mode === 'A' && (e.time_ms !== null || e.outcome !== 'active')) ||
        (mode === 'B' && (e.attempts.some((a: any) => a.value_cm !== null) || e.outcome !== 'active')) ||
        (mode === 'C' && (e.rank !== null || e.outcome !== 'active'))
      );

      if (!hasAnyData) {
        toast.error("Preencha pelo menos um resultado ou altere o status de um atleta");
        throw new Error("Empty results");
      }

      const payload = {
        entries: calculatedEntries.map(e => ({
          match_entry_id: e.match_entry_id,
          outcome: e.outcome === 'active' ? (e.rank === 1 ? 'win' : 'loss') : e.outcome,
          score: mode === 'A' ? formatTimeMs(e.time_ms || 0) : (mode === 'B' ? formatDistanceCm(e.best_mark || 0) : e.rank?.toString()),
          time_ms: e.time_ms,
          distance_cm: e.best_mark || null,
          points: null,
          score_detail: {
            rank: e.rank,
            notes: e.notes
          }
        })),
        attempts: mode === 'B' ? calculatedEntries.flatMap(e => 
          e.attempts.map((a: any) => ({
            match_entry_id: e.match_entry_id,
            participant_id: e.participant_id,
            attempt_number: a.attempt_number,
            value_cm: a.value_cm,
            is_valid: a.is_valid,
            notes: a.notes
          }))
        ) : undefined,
        observations
      };

      const { data, error } = await supabase.rpc("rpc_launch_match_result", {
        p_event_id: eventId,
        p_match_id: matchId,
        p_payload: payload as any
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Resultados salvos com sucesso!");
      qc.invalidateQueries({ queryKey: ["competition_phases"] });
      navigate(-1);
    },
    onError: (e: any) => {
      if (e.message !== "Empty results") {
        toast.error("Erro ao salvar: " + e.message);
      }
    }
  });

  const homologateMut = useMutation({
    mutationFn: async () => {
      setIsVerifyingPassword(true);
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-current-user-password', {
          body: { password: homologatePassword }
        });

        if (verifyError) throw verifyError;
        if (!verifyData.valid) {
          throw new Error(verifyData.message || "Senha incorreta");
        }

        const { data, error } = await (supabase.rpc as any)("rpc_homologate_match_result", {
          p_match_id: matchId,
          p_observation: homologateObservation
        });
        if (error) throw error;
        return data;
      } finally {
        setIsVerifyingPassword(false);
      }
    },
    onSuccess: () => {
      toast.success("Resultado homologado com sucesso!");
      setShowHomologateDialog(false);
      refetchMatch();
    },
    onError: (e: any) => {
      toast.error("Erro ao homologar: " + e.message);
    }
  });

  if (loadingMatch || loadingRules) {
    return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const handleStatusChange = (entryId: string, newStatus: string) => {
    setEntries(prev => prev.map(e => {
      if (e.match_entry_id === entryId) {
        return { 
          ...e, 
          outcome: newStatus, 
          time_ms: newStatus !== 'active' ? null : e.time_ms,
          rank: newStatus !== 'active' ? null : e.rank
        };
      }
      return e;
    }));
  };

  const handleTimeChange = (entryId: string, val: string) => {
    const ms = parseTimeFormatted(val);
    setEntries(prev => prev.map(e => e.match_entry_id === entryId ? { ...e, time_ms: ms } : e));
  };

  const handleRankChange = (entryId: string, val: string) => {
    const r = parseInt(val) || null;
    setEntries(prev => prev.map(e => e.match_entry_id === entryId ? { ...e, rank: r } : e));
  };

  const handleAttemptChange = (entryId: string, attemptNum: number, field: string, value: any) => {
    setEntries(prev => prev.map(e => {
      if (e.match_entry_id === entryId) {
        const newAttempts = e.attempts.map((a: any) => {
          if (a.attempt_number === attemptNum) {
            if (field === 'value') {
              const cm = parseDistanceFormatted(value);
              return { ...a, value_cm: cm, is_valid: true };
            }
            if (field === 'invalid') {
              return { ...a, is_valid: !value, value_cm: value ? null : a.value_cm };
            }
            return { ...a, [field]: value };
          }
          return a;
        });
        return { ...e, attempts: newAttempts };
      }
      return e;
    }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Lançamento de Resultado — {mode === 'A' ? 'Pista/Piscina' : (mode === 'B' ? 'Campo' : 'Prova Única')}
              </h1>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                {match?.phase?.name} • {match?.group?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            {canHomologate && (
              <Button 
                variant="secondary" 
                className="gap-2"
                onClick={() => setShowHomologateDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Homologar
              </Button>
            )}
            <Button 
              className="gap-2" 
              onClick={() => launchMut.mutate()} 
              disabled={launchMut.isPending || !canWrite || isLocked}
            >
              <Save className="h-4 w-4" /> 
              {launchMut.isPending ? "Salvando..." : "Salvar Resultado"}
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        <Card>
          <CardHeader className="bg-muted/50 border-b py-3">
            <div className="flex items-center justify-between">
               <CardTitle className="text-sm font-medium">Lista de Participantes</CardTitle>
               <Badge variant="outline">{calculatedEntries.length} Atletas</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {mode === 'A' && <TableHead className="w-16 text-center">Raia</TableHead>}
                  <TableHead>Atleta / Instituição</TableHead>
                  {mode === 'A' && <TableHead className="w-40">Marca (Tempo)</TableHead>}
                  {mode === 'B' && (
                    <>
                      {calculatedEntries[0]?.attempts.map((a: any) => (
                        <TableHead key={a.attempt_number} className="w-24 text-center">T{a.attempt_number}</TableHead>
                      ))}
                      <TableHead className="w-32 text-center">Melhor</TableHead>
                    </>
                  )}
                  {mode === 'C' && (
                    <>
                      <TableHead className="w-40 text-center">Tempo (Opcional)</TableHead>
                      <TableHead className="w-24 text-center">Posição</TableHead>
                    </>
                  )}
                  <TableHead className="w-32">Status</TableHead>
                  {mode !== 'C' && <TableHead className="w-20 text-center">Pos.</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedEntries.map((entry) => (
                  <TableRow key={entry.match_entry_id}>
                    {mode === 'A' && (
                      <TableCell className="text-center font-mono font-bold text-lg text-muted-foreground">
                        {entry.lane || '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold">{entry.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{entry.institution}</span>
                        {entry.registration_number && (
                          <span className="text-[10px] text-primary">#{entry.registration_number}</span>
                        )}
                      </div>
                    </TableCell>
                    
                    {mode === 'A' && (
                      <TableCell>
                        <Input 
                          placeholder="mm:ss.cc"
                          className="font-mono text-center font-bold"
                          disabled={isLocked || entry.outcome !== 'active'}
                          defaultValue={formatTimeMs(entry.time_ms)}
                          onBlur={(e) => handleTimeChange(entry.match_entry_id, e.target.value)}
                        />
                      </TableCell>
                    )}

                    {mode === 'B' && (
                      <>
                        {entry.attempts.map((a: any) => (
                          <TableCell key={a.attempt_number} className="p-1">
                            <div className="flex flex-col gap-1">
                              <Input 
                                placeholder="m,cm"
                                className="h-8 text-center text-xs font-mono"
                                disabled={isLocked || entry.outcome !== 'active'}
                                defaultValue={formatDistanceCm(a.value_cm)}
                                onBlur={(e) => handleAttemptChange(entry.match_entry_id, a.attempt_number, 'value', e.target.value)}
                              />
                              <Button 
                                variant={a.is_valid ? "ghost" : "destructive"} 
                                size="sm" 
                                className="h-5 text-[9px] uppercase py-0"
                                onClick={() => handleAttemptChange(entry.match_entry_id, a.attempt_number, 'invalid', a.is_valid)}
                                disabled={isLocked || entry.outcome !== 'active'}
                              >
                                {a.is_valid ? "Válida" : "Nula (X)"}
                              </Button>
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold text-primary">
                          {formatDistanceCm(entry.best_mark)}
                        </TableCell>
                      </>
                    )}

                    {mode === 'C' && (
                      <>
                        <TableCell>
                          <Input 
                            placeholder="hh:mm:ss"
                            className="text-center font-mono h-8"
                            disabled={isLocked || entry.outcome !== 'active'}
                            defaultValue={formatTimeMs(entry.time_ms, 'hh:mm:ss')}
                            onBlur={(e) => handleTimeChange(entry.match_entry_id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            className="text-center font-bold h-8"
                            disabled={isLocked || entry.outcome !== 'active'}
                            value={entry.rank || ""}
                            onChange={(e) => handleRankChange(entry.match_entry_id, e.target.value)}
                          />
                        </TableCell>
                      </>
                    )}

                    <TableCell>
                      <select 
                        className="w-full h-8 text-xs border rounded px-1 bg-background"
                        value={entry.outcome}
                        onChange={(e) => handleStatusChange(entry.match_entry_id, e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="active">Competindo</option>
                        <option value="dns">DNS (Não largou)</option>
                        <option value="dnf">DNF (Não terminou)</option>
                        <option value="dsq">DSQ (Desclassificado)</option>
                      </select>
                    </TableCell>

                    {mode !== 'C' && (
                      <TableCell className="text-center">
                        {entry.rank ? (
                          <Badge variant={entry.rank === 1 ? "default" : "secondary"}>
                            {entry.rank}º
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Observações da Prova</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Ocorrências, condições climáticas, recursos..." 
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              disabled={isLocked}
            />
          </CardContent>
        </Card>
      </div>

      {/* Homologation Dialog */}
      <Dialog open={showHomologateDialog} onOpenChange={setShowHomologateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Homologar Resultado</DialogTitle>
            <DialogDescription>
              A homologação valida o resultado e permite a publicação oficial. 
              Digite sua senha para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Senha de confirmação</Label>
              <Input 
                id="password" 
                type="password" 
                value={homologatePassword} 
                onChange={(e) => setHomologatePassword(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs">Observação técnica (opcional)</Label>
              <Textarea 
                id="obs" 
                value={homologateObservation} 
                onChange={(e) => setHomologateObservation(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHomologateDialog(false)}>Cancelar</Button>
            <Button onClick={() => homologateMut.mutate()} disabled={isVerifyingPassword || !homologatePassword}>
              {isVerifyingPassword ? "Verificando..." : "Confirmar Homologação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
