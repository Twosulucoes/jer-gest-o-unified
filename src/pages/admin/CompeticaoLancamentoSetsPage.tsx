import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Trophy, 
  Save, 
  Trash2, 
  AlertCircle,
  RotateCcw,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  MinusCircle,
  PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/navigation/BackButton";
import { useActiveEventId } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";

interface SetScore {
  a: string;
  b: string;
}

export default function CompeticaoLancamentoSetsPage() {
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
            teams(id, name, delegations(id, institutions(id, name))),
            results:competition_match_results(*)
          ),
          match_scores(id, match_entry_id, score_detail, score_final, outcome)
        `)
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { rules, rulesData, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  // State for forms
  const [sets, setSets] = useState<SetScore[]>([{ a: "", b: "" }]);
  const [isWO, setIsWO] = useState(false);
  const [woWinnerId, setWoWinnerId] = useState("");
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [withdrawalTeamId, setWithdrawalTeamId] = useState("");
  const [withdrawalSetIndex, setWithdrawalSetIndex] = useState<number | null>(null);
  const [observation, setObservation] = useState("");
  
  const [showHomologateDialog, setShowHomologateDialog] = useState(false);
  const [homologatePassword, setHomologatePassword] = useState("");
  const [homologateObservation, setHomologateObservation] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const resultStatus = match?.entries?.[0]?.results?.[0]?.result_status || "agendado";
  const isLocked = (resultStatus === "resultado_validado" || resultStatus === "publicado") && !hasRole("admin");
  const canHomologate = (hasRole("admin") || hasRole("coordenacao_tecnica")) && resultStatus === "resultado_lancado";

  const modalityName = (rulesData as any)?.sport_name || "Modalidade";
  
  const schoolA = match?.entries?.find((e: any) => e.side === 'A' || e.side === 'left');
  const schoolB = match?.entries?.find((e: any) => e.side === 'B' || e.side === 'right');

  // Config from rules
  const bestOf = (rules as any)?.scoring?.best_of || 3;
  const setsToWin = Math.ceil(bestOf / 2);
  const setPoints = (rules as any)?.scoring?.set_points || 25;
  const tiebreakPoints = (rules as any)?.scoring?.points_tiebreak || 15;
  const isConfigured = rules && (rules as any)?.scoring?.best_of;

  // Initialize state from existing data
  useEffect(() => {
    if (match && match.match_scores && match.match_scores.length > 0) {
      const scoreA = match.match_scores.find((s: any) => s.match_entry_id === schoolA?.id);
      const scoreB = match.match_scores.find((s: any) => s.match_entry_id === schoolB?.id);
      
      if (scoreA?.score_detail && scoreB?.score_detail) {
        const detailA = scoreA.score_detail as Record<string, string>;
        const detailB = scoreB.score_detail as Record<string, string>;
        
        const loadedSets: SetScore[] = [];
        for (let i = 1; i <= 5; i++) {
          const valA = detailA[`p${i}`];
          const valB = detailB[`p${i}`];
          if (valA !== undefined && valB !== undefined) {
            loadedSets.push({ a: valA, b: valB });
          }
        }
        if (loadedSets.length > 0) {
          setSets(loadedSets);
        }
      }
      
      // Check for WO
      const firstResult = match.entries?.[0]?.results?.[0];
      if (firstResult?.outcome?.startsWith('wo_')) {
        setIsWO(true);
        const winnerEntry = match.entries.find((e: any) => e.results?.[0]?.outcome === 'wo_win');
        if (winnerEntry) setWoWinnerId(winnerEntry.id);
      }
      
      // Check for Withdrawal (Simplified for now, look into notes if needed)
      if (firstResult?.notes?.includes("Desistência")) {
        setIsWithdrawal(true);
      }
    }
  }, [match, schoolA, schoolB]);

  // Derived calculations
  const totalSetsA = useMemo(() => {
    if (isWO) return woWinnerId === schoolA?.id ? setsToWin : 0;
    return sets.filter(s => {
      const a = parseInt(s.a) || 0;
      const b = parseInt(s.b) || 0;
      return a > b;
    }).length;
  }, [sets, isWO, woWinnerId, schoolA, setsToWin]);

  const totalSetsB = useMemo(() => {
    if (isWO) return woWinnerId === schoolB?.id ? setsToWin : 0;
    return sets.filter(s => {
      const a = parseInt(s.a) || 0;
      const b = parseInt(s.b) || 0;
      return b > a;
    }).length;
  }, [sets, isWO, woWinnerId, schoolB, setsToWin]);

  const isFinished = totalSetsA >= setsToWin || totalSetsB >= setsToWin;

  const applyWithdrawal = () => {
    if (!withdrawalTeamId || withdrawalSetIndex === null) return;
    
    const isAWithdrawing = withdrawalTeamId === schoolA?.id;
    const winnerSide = isAWithdrawing ? 'b' : 'a';
    const loserSide = isAWithdrawing ? 'a' : 'b';
    
    let newSets = [...sets];
    
    // 1. Current set: winner reaches target points
    const currentSet = newSets[withdrawalSetIndex] || { a: "0", b: "0" };
    const isTieBreak = withdrawalSetIndex === bestOf - 1;
    const target = isTieBreak ? tiebreakPoints : setPoints;
    
    const winnerPoints = Math.max(target, (parseInt(currentSet[winnerSide]) || 0) + 2);
    const loserPoints = parseInt(currentSet[loserSide]) || 0;
    
    newSets[withdrawalSetIndex] = {
      [winnerSide]: winnerPoints.toString(),
      [loserSide]: loserPoints.toString()
    } as any;
    
    // 2. Subsequent sets: winner wins 25-0 or 15-0 until match ends
    let setsB = 0;
    let setsA = 0;
    
    // Count current sets won
    newSets.forEach((s, i) => {
        if (i > withdrawalSetIndex) return;
        if (parseInt(s.a) > parseInt(s.b)) setsA++;
        else if (parseInt(s.b) > parseInt(s.a)) setsB++;
    });

    let currentIdx = withdrawalSetIndex + 1;
    while (setsA < setsToWin && setsB < setsToWin && currentIdx < bestOf) {
        const isNextTieBreak = currentIdx === bestOf - 1;
        const nextTarget = isNextTieBreak ? tiebreakPoints : setPoints;
        
        newSets[currentIdx] = {
            [winnerSide]: nextTarget.toString(),
            [loserSide]: "0"
        } as any;
        
        if (winnerSide === 'a') setsA++; else setsB++;
        currentIdx++;
    }
    
    // Truncate sets if needed
    setSets(newSets.slice(0, currentIdx));
    toast.success("Placar de desistência calculado.");
  };

  const handleAddSet = () => {
    if (isFinished) return;
    setSets([...sets, { a: "", b: "" }]);
  };

  const handleRemoveSet = (index: number) => {
    if (sets.length === 1) return;
    setSets(sets.filter((_, i) => i !== index));
  };

  const updateSet = (index: number, side: 'a' | 'b', value: string) => {
    const newSets = [...sets];
    newSets[index][side] = value;
    setSets(newSets);
  };

  const validate = () => {
    if (isWO) {
      if (!woWinnerId) {
        toast.error("Selecione a escola vencedora por W.O.");
        return false;
      }
      return true;
    }

    if (isWithdrawal) {
      if (!withdrawalTeamId) {
        toast.error("Selecione a escola que desistiu.");
        return false;
      }
      if (withdrawalSetIndex === null) {
        toast.error("Selecione o set da desistência.");
        return false;
      }
    }

    // Check for empty sets
    const hasEmpty = sets.some(s => s.a === "" || s.b === "");
    if (hasEmpty) {
      toast.error("Preencha todos os pontos dos sets registrados.");
      return false;
    }

    // Check for winner in knockout
    if (match?.phase?.phase_type === 'knockout' && !isFinished) {
      toast.error("Esta partida é de fase eliminatória e exige um vencedor. Verifique as parciais dos sets e garanta que uma equipe tenha vencido o número de sets necessário para a partida.", {
        duration: 5000,
      });
      return false;
    }

    return true;
  };

  const launchMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validação falhou");

      const payload = {
        is_wo: isWO,
        wo_winner_id: woWinnerId,
        is_withdrawal: isWithdrawal,
        withdrawal_team_id: withdrawalTeamId,
        withdrawal_set: withdrawalSetIndex,
        family: "sets",
        entries: match.entries.map((e: any) => {
          const isA = e.id === schoolA?.id;
          const scoreSets = isA ? totalSetsA : totalSetsB;
          const otherSets = isA ? totalSetsB : totalSetsA;
          
          let outcome = 'loss';
          if (isWO) {
            outcome = e.id === woWinnerId ? 'wo_win' : 'wo_loss';
          } else if (scoreSets > otherSets) {
            outcome = 'win';
          } else if (scoreSets === otherSets) {
            outcome = 'draw';
          }

          // Format for rpc_extract_match_outcome (array of {home, away})
          const scoreDetailArray = sets.map(s => ({
            home: parseInt(s.a) || 0,
            away: parseInt(s.b) || 0
          }));

          // Keeping old format for compatibility if needed elsewhere
          const scoreDetailObj: Record<string, string> = {};
          sets.forEach((s, i) => {
            scoreDetailObj[`p${i+1}`] = isA ? s.a : s.b;
          });

          return {
            match_entry_id: e.id,
            score: scoreSets.toString(),
            outcome,
            // We send the array format in combat_detail/score_detail
            score_detail: scoreDetailArray
          };
        }),
        observation
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
      toast.success("Resultado lançado com sucesso!");
      qc.invalidateQueries({ queryKey: ["sets-matches", sportEventId] });
      navigate(-1);
    },
    onError: (e: any) => {
      if (e.message !== "Validação falhou") {
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
      setHomologatePassword("");
      setHomologateObservation("");
      refetchMatch();
    },
    onError: (e: any) => {
      toast.error("Erro ao homologar: " + e.message);
    }
  });

  if (loadingMatch || loadingRules) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isConfigured && !loadingRules) {
    return (
      <div className="container py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Formato de sets não configurado</AlertTitle>
          <AlertDescription>
            O formato da partida (melhor de X sets) não foi definido nas regras desta modalidade.
            Por favor, <Button variant="link" className="p-0 h-auto font-bold" onClick={() => navigate("/admin/regras")}>configure as regras</Button> antes de lançar resultados.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  if (!schoolA || !schoolB) {
    return (
      <div className="container py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Confronto incompleto</AlertTitle>
          <AlertDescription>
            Este confronto não possui duas equipes/escolas vinculadas para o lançamento de resultado.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  const schoolAName = schoolA?.teams?.name || "Escola A";
  const schoolBName = schoolB?.teams?.name || "Escola B";
  const partialsText = sets.filter(s => s.a !== "" && s.b !== "").map(s => `${s.a}-${s.b}`).join(" / ");

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Lançamento de Resultado
              </h1>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                {modalityName} • {match?.phase?.name} {match?.group?.name ? `(${match?.group?.name})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            {canHomologate && (
              <Button 
                variant="secondary" 
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-none"
                onClick={() => setShowHomologateDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Homologar Resultado
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
        {/* Placar Principal */}
        <Card className="overflow-hidden border-none shadow-lg">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex-1 text-center">
                  <h3 className="text-2xl font-bold mb-1">{schoolAName}</h3>
                  <p className="text-xs opacity-80">{schoolA?.teams?.delegations?.institutions?.name}</p>
                </div>
                <div className="px-12 flex flex-col items-center">
                   <div className="flex items-center gap-8 text-7xl font-black">
                    <span>{totalSetsA}</span>
                    <span className="text-4xl opacity-50">×</span>
                    <span>{totalSetsB}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium opacity-90 font-mono">
                    {partialsText || "Aguardando parciais..."}
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <h3 className="text-2xl font-bold mb-1">{schoolBName}</h3>
                  <p className="text-xs opacity-80">{schoolB?.teams?.delegations?.institutions?.name}</p>
                </div>
              </div>
              {isWO && (
                <Badge variant="secondary" className="mt-4 bg-white text-primary font-bold px-6 py-1">
                  VENCEDOR POR W.O.
                </Badge>
              )}
              {isWithdrawal && (
                <Badge variant="secondary" className="mt-4 bg-white text-destructive font-bold px-6 py-1">
                  DESISTÊNCIA DURANTE A PARTIDA
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Placar por Set */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Placar por Set
                </CardTitle>
                {!isWO && !isWithdrawal && !isLocked && sets.length < bestOf && (
                  <Button variant="outline" size="sm" onClick={handleAddSet} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Adicionar Set
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {isWO ? (
                  <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                    Bloco desabilitado devido ao W.O.
                  </div>
                ) : isWithdrawal ? (
                   <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                    Bloco desabilitado devido à desistência.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sets.map((set, index) => {
                      const isTieBreak = index === bestOf - 1;
                      const targetPoints = isTieBreak ? tiebreakPoints : setPoints;
                      const aVal = parseInt(set.a) || 0;
                      const bVal = parseInt(set.b) || 0;
                      
                      const isValidSet = (aVal >= targetPoints || bVal >= targetPoints) && Math.abs(aVal - bVal) >= 2;
                      const showWarning = (set.a !== "" && set.b !== "") && !isValidSet;

                      return (
                        <div key={index} className="flex flex-col gap-2 p-4 border rounded-lg bg-background">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm">
                              Set {index + 1} {isTieBreak && <span className="text-primary ml-1">(Tie-break)</span>}
                            </span>
                            {!isLocked && index > 0 && index === sets.length - 1 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveSet(index)}>
                                <MinusCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase">{schoolAName}</Label>
                              <Input 
                                type="number" 
                                placeholder="0"
                                className="h-12 text-center text-xl font-black"
                                disabled={isLocked}
                                value={set.a}
                                onChange={(e) => updateSet(index, 'a', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground uppercase">{schoolBName}</Label>
                              <Input 
                                type="number" 
                                placeholder="0"
                                className="h-12 text-center text-xl font-black"
                                disabled={isLocked}
                                value={set.b}
                                onChange={(e) => updateSet(index, 'b', e.target.value)}
                              />
                            </div>
                          </div>
                          
                          {showWarning && (
                            <div className="flex items-center gap-1.5 text-amber-600 text-[10px] mt-1">
                              <AlertCircle className="h-3 w-3" />
                              Parcial atípica para as regras (mínimo {targetPoints} com vantagem de 2).
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Estatísticas Individuais (Placeholder) */}
            <Card className="bg-muted/10 border-dashed">
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">Estatísticas Individuais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-4 text-center text-sm text-muted-foreground italic">
                  O lançamento de estatísticas individuais (melhor pontuador, destaques) será habilitado em uma etapa futura.
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Bloco W.O. */}
            <Card className={isWO ? "border-primary bg-primary/5" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">W.O.</CardTitle>
                  <Switch 
                    checked={isWO} 
                    onCheckedChange={(val) => {
                      setIsWO(val);
                      if (val) setIsWithdrawal(false);
                    }} 
                    disabled={isLocked}
                  />
                </div>
              </CardHeader>
              {isWO && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Escola Vencedora</Label>
                    <Select value={woWinnerId} onValueChange={setWoWinnerId} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={schoolA?.id}>{schoolAName}</SelectItem>
                        <SelectItem value={schoolB?.id}>{schoolBName}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Alert className="bg-white/50 py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-[10px]">
                      Placar de W.O. ({setsToWin}×0) será aplicado automaticamente ao salvar.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>

            {/* Bloco Desistência */}
            <Card className={isWithdrawal ? "border-destructive bg-destructive/5" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Desistência</CardTitle>
                  <Switch 
                    checked={isWithdrawal} 
                    onCheckedChange={(val) => {
                      setIsWithdrawal(val);
                      if (val) setIsWO(false);
                    }} 
                    disabled={isLocked}
                  />
                </div>
              </CardHeader>
              {isWithdrawal && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Escola que desistiu</Label>
                    <Select value={withdrawalTeamId} onValueChange={setWithdrawalTeamId} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={schoolA?.id}>{schoolAName}</SelectItem>
                        <SelectItem value={schoolB?.id}>{schoolBName}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Em qual set?</Label>
                    <Select value={withdrawalSetIndex?.toString()} onValueChange={(v) => setWithdrawalSetIndex(parseInt(v))} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: bestOf }).map((_, i) => (
                          <SelectItem key={i} value={i.toString()}>Set {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2" 
                    onClick={applyWithdrawal}
                    disabled={isLocked || !withdrawalTeamId || withdrawalSetIndex === null}
                  >
                    <Save className="h-4 w-4" /> Calcular Placar Final
                  </Button>
                  <Alert variant="destructive" className="bg-white/50 py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-[10px]">
                      O sistema calculará o placar final fechando os sets pendentes para o vencedor.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              )}
            </Card>

            {/* Observações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Registro de ocorrências, lesões ou decisões de arbitragem..."
                  className="min-h-[120px]"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  disabled={isLocked}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Homologation Dialog */}
      <Dialog open={showHomologateDialog} onOpenChange={setShowHomologateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Homologar Resultado</DialogTitle>
            <DialogDescription>
              A homologação valida o resultado e permite sua publicação. Esta ação requer sua senha de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sua Senha</Label>
              <Input 
                type="password" 
                value={homologatePassword} 
                onChange={(e) => setHomologatePassword(e.target.value)}
                placeholder="Digite sua senha..."
              />
            </div>
            <div className="space-y-2">
              <Label>Observação (Opcional)</Label>
              <Textarea 
                value={homologateObservation}
                onChange={(e) => setHomologateObservation(e.target.value)}
                placeholder="Alguma nota sobre a homologação?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHomologateDialog(false)}>Cancelar</Button>
            <Button 
              onClick={() => homologateMut.mutate()} 
              disabled={!homologatePassword || homologateMut.isPending}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isVerifyingPassword ? "Verificando..." : "Confirmar Homologação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
