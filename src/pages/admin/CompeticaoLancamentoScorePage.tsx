import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Trophy, 
  Save, 
  Plus, 
  Trash2, 
  PlusCircle,
  XCircle,
  AlertCircle,
  History,
  RotateCcw,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/navigation/BackButton";
import { useActiveEventId } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";

interface PenaltyShot {
  id?: string;
  match_entry_id: string;
  team_side: 'A' | 'B';
  ordem: number;
  participant_id: string;
  convertido: boolean;
}

interface MatchCard {
  id?: string;
  match_entry_id: string;
  participant_id: string;
  card_type: string;
  period: number;
  minute: number;
}

interface GoalPoint {
  id?: string;
  match_entry_id: string;
  participant_id?: string;
  period: number;
  minute: number;
  value: number;
}

export default function CompeticaoLancamentoScorePage() {
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
          )
        `)
        .eq("id", matchId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { rules, rulesData, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  // Fetch lineups
  const { data: lineups = [], isLoading: loadingLineups } = useQuery({
    queryKey: ["match-lineups", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select(`
          id, match_entry_id, participant_id, jersey_number, status,
          participant:participants(id, person:people(id, full_name))
        `)
        .eq("match_id", matchId)
        .in("status", ["active", "bench"]);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  // State for forms
  const [periodScores, setPeriodScores] = useState<Record<string, Record<string, string>>>({});
  const [isWO, setIsWO] = useState(false);
  const [woWinnerId, setWoWinnerId] = useState("");
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [goals, setGoals] = useState<GoalPoint[]>([]);
  const [penalties, setPenalties] = useState<PenaltyShot[]>([]);
  const [numPeriods, setNumPeriods] = useState(2);
  const [hasOvertime, setHasOvertime] = useState(false);
  const [showHomologateDialog, setShowHomologateDialog] = useState(false);
  const [homologatePassword, setHomologatePassword] = useState("");
  const [homologateObservation, setHomologateObservation] = useState("");

  const resultStatus = match?.entries?.[0]?.results?.[0]?.result_status || "agendado";
  const isLocked = (resultStatus === "resultado_validado" || resultStatus === "publicado") && !hasRole("admin");
  const isAlreadyPublished = resultStatus === "publicado";
  const canHomologate = (hasRole("admin") || hasRole("coordenacao_tecnica")) && resultStatus === "resultado_lancado";

  // Modality name from rulesData
  const modalityName = (rulesData as any)?.sport_name || "Modalidade";

  // Initialize state
  useEffect(() => {
    if (match && rules) {
      const p = (rules as any)?.periods || 2;
      setNumPeriods(p);
      
      const initialScores: Record<string, Record<string, string>> = {};
      match.entries.forEach((e: any) => {
        initialScores[e.id] = {};
        for (let i = 1; i <= p; i++) {
          initialScores[e.id][`p${i}`] = "";
        }
      });
      setPeriodScores(initialScores);
    }
  }, [match, rules]);

  const schoolA = match?.entries?.[0];
  const schoolB = match?.entries?.[1];

  const totalScoreA = useMemo(() => {
    if (!schoolA) return 0;
    if (isWO) {
        if (woWinnerId === schoolA.id) return (rules as any)?.scoring?.walkover_policy?.score_winner || 1;
        return (rules as any)?.scoring?.walkover_policy?.score_loser || 0;
    }
    let sum = 0;
    Object.values(periodScores[schoolA.id] || {}).forEach(v => {
      sum += parseInt(v) || 0;
    });
    return sum;
  }, [periodScores, schoolA, isWO, woWinnerId, rules]);

  const totalScoreB = useMemo(() => {
    if (!schoolB) return 0;
    if (isWO) {
        if (woWinnerId === schoolB.id) return (rules as any)?.scoring?.walkover_policy?.score_winner || 1;
        return (rules as any)?.scoring?.walkover_policy?.score_loser || 0;
    }
    let sum = 0;
    Object.values(periodScores[schoolB.id] || {}).forEach(v => {
      sum += parseInt(v) || 0;
    });
    return sum;
  }, [periodScores, schoolB, isWO, woWinnerId, rules]);

  const penaltyScoreA = useMemo(() => penalties.filter(p => p.match_entry_id === schoolA?.id && p.convertido).length, [penalties, schoolA]);
  const penaltyScoreB = useMemo(() => penalties.filter(p => p.match_entry_id === schoolB?.id && p.convertido).length, [penalties, schoolB]);

  const validate = () => {
    if (isWO && !woWinnerId) {
        toast.error("Selecione a escola vencedora por W.O.");
        return false;
    }
    
    // Check for empty periods
    if (!isWO) {
        for (const entry of match.entries) {
            const scores = Object.values(periodScores[entry.id] || {});
            const hasEmpty = scores.some(s => s === "");
            const hasFilled = scores.some(s => s !== "");
            if (hasEmpty && hasFilled) {
                toast.error(`Preencha todos os períodos para ${entry.teams?.name}`);
                return false;
            }
        }
    }

    // Eliminatória empatada
    if (match?.phase?.phase_type === 'knockout' && totalScoreA === totalScoreB && !isWO) {
        if (penalties.length === 0) {
            toast.error("Fase eliminatória empatada exige vencedor (prorrogação ou pênaltis)");
            return false;
        }
        if (penaltyScoreA === penaltyScoreB) {
            toast.error("A disputa de pênaltis não pode terminar empatada");
            return false;
        }
    }

    return true;
  };

  const launchMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validação falhou");

      const payload = {
        is_wo: isWO,
        wo_winner_id: woWinnerId,
        entries: match.entries.map((e: any) => ({
          match_entry_id: e.id,
          score: e.id === schoolA?.id ? totalScoreA.toString() : totalScoreB.toString(),
          outcome: isWO ? (e.id === woWinnerId ? 'wo_win' : 'wo_loss') : (
            (e.id === schoolA?.id ? totalScoreA : totalScoreB) > (e.id === schoolA?.id ? totalScoreB : totalScoreA) ? 'win' : 
            (totalScoreA === totalScoreB && (match?.phase?.phase_type === 'knockout' ? (e.id === schoolA?.id ? penaltyScoreA > penaltyScoreB : penaltyScoreB > penaltyScoreA) : true) ? 'win' : 'loss')
          ),
          score_detail: {
            periods: periodScores[e.id],
            is_wo: isWO && e.id === woWinnerId,
            penalty_score: e.id === schoolA?.id ? penaltyScoreA : penaltyScoreB
          }
        })),
        penalty_shots: penalties,
        cards: cards,
        goals: goals
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
      qc.invalidateQueries({ queryKey: ["score-matches"] });
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
      const { data, error } = await (supabase.rpc as any)("rpc_homologate_match_result", {
        p_match_id: matchId,
        p_password: homologatePassword,
        p_observation: homologateObservation
      });
      if (error) throw error;
      return data;
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

  const revertMut = useMutation({
    mutationFn: async ({ targetStatus, reason }: { targetStatus: string, reason: string }) => {
      const { data, error } = await (supabase.rpc as any)("rpc_revert_match_result_status", {
        p_match_id: matchId,
        p_target_status: targetStatus,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Status revertido com sucesso!");
      refetchMatch();
    },
    onError: (e: any) => {
      toast.error("Erro ao reverter: " + e.message);
    }
  });

  if (loadingMatch || loadingRules || loadingLineups) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const schoolAName = schoolA?.teams?.name || "Escola A";
  const schoolBName = schoolB?.teams?.name || "Escola B";

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
                    <span>{totalScoreA}</span>
                    <span className="text-4xl opacity-50">×</span>
                    <span>{totalScoreB}</span>
                  </div>
                  {penalties.length > 0 && (
                    <Badge variant="secondary" className="mt-2 bg-white/20 text-white font-bold text-lg">
                      ({penaltyScoreA} × {penaltyScoreB})
                    </Badge>
                  )}
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
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Placar por Período */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Placar por Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isWO ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {match?.entries.map((entry: any) => (
                        <div key={entry.id} className="space-y-4">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {entry.teams?.name}
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {Array.from({ length: numPeriods }).map((_, i) => (
                              <div key={i} className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground uppercase">T{i+1}</Label>
                                <Input 
                                  type="number" 
                                  placeholder="0"
                                  className="h-10 text-center font-bold"
                                  disabled={isLocked}
                                  value={periodScores[entry.id]?.[`p${i+1}`] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPeriodScores(prev => ({
                                      ...prev,
                                      [entry.id]: { ...prev[entry.id], [`p${i+1}`]: val }
                                    }));
                                  }}
                                />
                              </div>
                            ))}
                            {hasOvertime && (
                              <div className="space-y-1.5">
                                <Label className="text-[10px] text-primary uppercase font-bold">PR</Label>
                                <Input 
                                  type="number" 
                                  placeholder="0"
                                  className="h-10 text-center font-bold border-primary"
                                  value={periodScores[entry.id]?.overtime || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPeriodScores(prev => ({
                                      ...prev,
                                      [entry.id]: { ...prev[entry.id], overtime: val }
                                    }));
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {match?.phase?.phase_type === 'knockout' && totalScoreA === totalScoreB && !hasOvertime && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full dashed border-2 border-dashed gap-2"
                        onClick={() => {
                          setHasOvertime(true);
                          match.entries.forEach((e: any) => {
                            setPeriodScores(prev => ({
                              ...prev,
                              [e.id]: { ...prev[e.id], overtime: "" }
                            }));
                          });
                        }}
                      >
                        <PlusCircle className="h-4 w-4" /> Adicionar Prorrogação
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">
                    Bloco desabilitado devido ao W.O.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cartões */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" /> Cartões
                </CardTitle>
                {!isWO && (
                  <Button variant="outline" size="sm" onClick={() => {
                      const newCard: MatchCard = {
                          match_entry_id: schoolA?.id || "",
                          participant_id: "",
                          card_type: "yellow",
                          period: 1,
                          minute: 0
                      };
                      setCards([...cards, newCard]);
                  }}>
                      <Plus className="h-4 w-4 mr-1" /> Registrar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!isWO ? (
                    <div className="space-y-4">
                    {cards.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum cartão registrado.</p>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="text-xs uppercase">Escola</TableHead>
                                <TableHead className="text-xs uppercase">Atleta</TableHead>
                                <TableHead className="text-xs uppercase">Tipo</TableHead>
                                <TableHead className="text-xs uppercase w-[100px]">Minuto</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {cards.map((card, idx) => (
                                <TableRow key={idx}>
                                <TableCell>
                                    <Select value={card.match_entry_id} onValueChange={(val) => {
                                        const newCards = [...cards];
                                        newCards[idx].match_entry_id = val;
                                        newCards[idx].participant_id = "";
                                        setCards(newCards);
                                    }}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {match?.entries.map((e: any) => (
                                        <SelectItem key={e.id} value={e.id}>{e.teams?.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Select value={card.participant_id} onValueChange={(val) => {
                                        const newCards = [...cards];
                                        newCards[idx].participant_id = val;
                                        setCards(newCards);
                                    }}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lineups.filter(l => l.match_entry_id === card.match_entry_id).map((l: any) => (
                                        <SelectItem key={l.participant_id} value={l.participant_id}>
                                            {l.jersey_number ? `#${l.jersey_number} ` : ""}{l.participant?.person?.full_name}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Select value={card.card_type} onValueChange={(val) => {
                                        const newCards = [...cards];
                                        newCards[idx].card_type = val;
                                        setCards(newCards);
                                    }}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="yellow">Amarelo</SelectItem>
                                        <SelectItem value="red">Vermelho</SelectItem>
                                        <SelectItem value="red_2yellows">2º Amarelo (Vermelho)</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Input 
                                    type="number" 
                                    className="h-8 text-center" 
                                    value={card.minute} 
                                    onChange={(e) => {
                                        const newCards = [...cards];
                                        newCards[idx].minute = parseInt(e.target.value);
                                        setCards(newCards);
                                    }} 
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                        const newCards = cards.filter((_, i) => i !== idx);
                                        setCards(newCards);
                                    }}>
                                    <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                        </div>
                    )}
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">
                        Bloco desabilitado devido ao W.O.
                    </div>
                )}
              </CardContent>
            </Card>

            {/* Gols/Pontos Detalhados */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> 
                  {rules?.scoring?.score_type === 'goals' ? 'Gols' : 'Pontos'} 
                  Detalhados
                </CardTitle>
                {!isWO && (
                  <Button variant="outline" size="sm" onClick={() => {
                      const newGoal: GoalPoint = {
                          match_entry_id: schoolA?.id || "",
                          period: 1,
                          minute: 0,
                          value: 1
                      };
                      setGoals([...goals, newGoal]);
                  }}>
                      <Plus className="h-4 w-4 mr-1" /> Registrar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {!isWO ? (
                    <div className="space-y-4">
                    {goals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro detalhado.</p>
                    ) : (
                        <div className="space-y-4">
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                <TableHead className="text-xs uppercase">Escola</TableHead>
                                <TableHead className="text-xs uppercase">Atleta (Opcional)</TableHead>
                                <TableHead className="text-xs uppercase w-[80px]">Min</TableHead>
                                <TableHead className="text-xs uppercase w-[80px]">Valor</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {goals.map((goal, idx) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                    <Select value={goal.match_entry_id} onValueChange={(val) => {
                                        const newGoals = [...goals];
                                        newGoals[idx].match_entry_id = val;
                                        newGoals[idx].participant_id = "";
                                        setGoals(newGoals);
                                    }}>
                                        <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {match?.entries.map((e: any) => (
                                            <SelectItem key={e.id} value={e.id}>{e.teams?.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    </TableCell>
                                    <TableCell>
                                    <Select value={goal.participant_id} onValueChange={(val) => {
                                        const newGoals = [...goals];
                                        newGoals[idx].participant_id = val;
                                        setGoals(newGoals);
                                    }}>
                                        <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {lineups.filter(l => l.match_entry_id === goal.match_entry_id).map((l: any) => (
                                            <SelectItem key={l.participant_id} value={l.participant_id}>
                                            {l.jersey_number ? `#${l.jersey_number} ` : ""}{l.participant?.person?.full_name}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    </TableCell>
                                    <TableCell>
                                    <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={goal.minute} 
                                        onChange={(e) => {
                                        const newGoals = [...goals];
                                        newGoals[idx].minute = parseInt(e.target.value);
                                        setGoals(newGoals);
                                        }} 
                                    />
                                    </TableCell>
                                    <TableCell>
                                    <Input 
                                        type="number" 
                                        className="h-8 text-center" 
                                        value={goal.value} 
                                        onChange={(e) => {
                                        const newGoals = [...goals];
                                        newGoals[idx].value = parseInt(e.target.value);
                                        setGoals(newGoals);
                                        }} 
                                    />
                                    </TableCell>
                                    <TableCell>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                        const newGoals = goals.filter((_, i) => i !== idx);
                                        setGoals(newGoals);
                                    }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>

                        {(() => {
                            const sumA = goals.filter(g => g.match_entry_id === schoolA?.id).reduce((acc, g) => acc + g.value, 0);
                            const sumB = goals.filter(g => g.match_entry_id === schoolB?.id).reduce((acc, g) => acc + g.value, 0);
                            const diverged = sumA !== totalScoreA || sumB !== totalScoreB;
                            
                            if (diverged) {
                            return (
                                <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertTitle>Divergência de Placar</AlertTitle>
                                <AlertDescription className="text-xs">
                                    A soma dos {rules?.scoring?.score_type === 'goals' ? 'gols' : 'pontos'} detalhados ({sumA}×{sumB}) não coincide com o placar por períodos ({totalScoreA}×{totalScoreB}).
                                </AlertDescription>
                                </Alert>
                            );
                            }
                            return null;
                        })()}
                        </div>
                    )}
                    </div>
                ) : (
                    <div className="p-8 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">
                        Bloco desabilitado devido ao W.O.
                    </div>
                )}
              </CardContent>
            </Card>

            {/* Pênaltis Individuais */}
            {match?.phase?.phase_type === 'knockout' && totalScoreA === totalScoreB && !isWO && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" /> Disputa de Pênaltis
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => {
                      const newPenalty: PenaltyShot = {
                          match_entry_id: schoolA?.id || "",
                          team_side: 'A',
                          ordem: penalties.length + 1,
                          participant_id: "",
                          convertido: false
                      };
                      setPenalties([...penalties, newPenalty]);
                  }}>
                      <Plus className="h-4 w-4 mr-1" /> Registrar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {penalties.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cobrança registrada.</p>
                    ) : (
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="text-xs uppercase w-[60px]">Nº</TableHead>
                              <TableHead className="text-xs uppercase">Escola</TableHead>
                              <TableHead className="text-xs uppercase">Batedor</TableHead>
                              <TableHead className="text-xs uppercase w-[120px]">Resultado</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {penalties.map((p, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs text-center">{p.ordem}</TableCell>
                                <TableCell>
                                  <Select value={p.match_entry_id} onValueChange={(val) => {
                                      const newPenalties = [...penalties];
                                      newPenalties[idx].match_entry_id = val;
                                      newPenalties[idx].team_side = val === schoolA?.id ? 'A' : 'B';
                                      newPenalties[idx].participant_id = "";
                                      setPenalties(newPenalties);
                                  }}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={schoolA?.id}>{schoolAName}</SelectItem>
                                      <SelectItem value={schoolB?.id}>{schoolBName}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select value={p.participant_id} onValueChange={(val) => {
                                      const newPenalties = [...penalties];
                                      newPenalties[idx].participant_id = val;
                                      setPenalties(newPenalties);
                                  }}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lineups.filter(l => l.match_entry_id === p.match_entry_id).map((l: any) => (
                                        <SelectItem key={l.participant_id} value={l.participant_id}>
                                          {l.jersey_number ? `#${l.jersey_number} ` : ""}{l.participant?.person?.full_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                        size="sm"
                                        variant={p.convertido ? "default" : "outline"}
                                        className={`h-7 px-2 text-[10px] ${p.convertido ? "bg-green-600 hover:bg-green-700" : ""}`}
                                        onClick={() => {
                                            const newPenalties = [...penalties];
                                            newPenalties[idx].convertido = true;
                                            setPenalties(newPenalties);
                                        }}
                                    >
                                        GOL
                                    </Button>
                                    <Button 
                                        size="sm"
                                        variant={!p.convertido ? "destructive" : "outline"}
                                        className="h-7 px-2 text-[10px]"
                                        onClick={() => {
                                            const newPenalties = [...penalties];
                                            newPenalties[idx].convertido = false;
                                            setPenalties(newPenalties);
                                        }}
                                    >
                                        ERRO
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                      const newPenalties = penalties.filter((_, i) => i !== idx);
                                      setPenalties(newPenalties);
                                  }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Info do Confronto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados do Confronto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-foreground/80">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{match?.match_date ? new Date(match.match_date + "T00:00:00").toLocaleDateString("pt-BR") : "Data não definida"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground/80">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{match?.start_time?.slice(0, 5) || "Hora não definida"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground/80">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{match?.venue?.name || "Local não definido"}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">Status Atual:</span>
                    <Badge variant="outline" className="font-mono">{match?.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* W.O. */}
            <Card className={isWO ? "border-primary bg-primary/5" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> W.O.
                </CardTitle>
                <Switch 
                  checked={isWO} 
                  disabled={isLocked}
                  onCheckedChange={(val) => {
                    setIsWO(val);
                    if (!val) setWoWinnerId("");
                  }} 
                />
              </CardHeader>
              <CardContent>
                {isWO ? (
                  <div className="space-y-4 pt-2">
                    <Label className="text-sm">Vencedora por W.O.</Label>
                    <Select value={woWinnerId} onValueChange={setWoWinnerId} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {match?.entries.map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.teams?.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Ative para registrar vitória por não comparecimento (W.O.).</p>
                )}
              </CardContent>
            </Card>

            {/* Histórico/Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History className="h-4 w-4" /> Auditoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded text-[10px] space-y-2">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">CRIADO EM:</span>
                        <span>{match?.created_at ? new Date(match.created_at).toLocaleString("pt-BR") : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">ÚLTIMA ALT:</span>
                        <span>{match?.updated_at ? new Date(match.updated_at).toLocaleString("pt-BR") : "—"}</span>
                    </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Snapshots completos do payload são gravados na tabela match_results_history a cada salvamento.
                </p>
              </CardContent>
            </Card>

            {hasRole("admin") && isLocked && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Ações de Administrador
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Como administrador, você pode reverter o status deste resultado para permitir edições ou correções.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      const reason = prompt("Justificativa para reversão:");
                      if (reason) {
                        revertMut.mutate({ targetStatus: "resultado_lancado", reason });
                      }
                    }}
                  >
                    Reverter para "Lançado"
                  </Button>
                  {resultStatus === "publicado" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={() => {
                        const reason = prompt("Justificativa para reversão:");
                        if (reason) {
                          revertMut.mutate({ targetStatus: "validado", reason });
                        }
                      }}
                    >
                      Reverter para "Validado" (Despublicar)
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showHomologateDialog} onOpenChange={setShowHomologateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Homologar Resultado</DialogTitle>
            <DialogDescription>
              Confirme os dados antes de homologar. Após esta ação, o resultado não poderá mais ser editado pela coordenação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg border flex items-center justify-between font-bold">
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground mb-1">{schoolAName}</div>
                <div className="text-2xl">{totalScoreA}</div>
              </div>
              <div className="px-4 text-muted-foreground">×</div>
              <div className="text-center flex-1">
                <div className="text-xs text-muted-foreground mb-1">{schoolBName}</div>
                <div className="text-2xl">{totalScoreB}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Senha do Coordenador</Label>
              <Input 
                type="password" 
                placeholder="Digite sua senha para confirmar" 
                value={homologatePassword}
                onChange={(e) => setHomologatePassword(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea 
                placeholder="Registro de eventual observação da homologação" 
                value={homologateObservation}
                onChange={(e) => setHomologateObservation(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowHomologateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white" 
              onClick={() => homologateMut.mutate()}
              disabled={homologateMut.isPending || !homologatePassword}
            >
              {homologateMut.isPending ? "Confirmando..." : "Confirmar Homologação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
