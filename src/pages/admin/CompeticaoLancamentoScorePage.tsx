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
  Pencil,
  PlusCircle,
  XCircle,
  AlertCircle,
  History,
  RotateCcw,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2
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
  const { hasRole, user } = useAuth();
  
  const canWrite = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("mesario");

  // Fetch match details
  const { data: match, isLoading: loadingMatch } = useQuery({
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
            teams(id, name, delegations(id, institutions(id, name)))
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

  // Modality name from rulesData (source)
  const modalityName = (rulesData as any)?.sport_name || "Modalidade";

  // Initialize state from existing data
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
        if (woWinnerId === schoolA.id) return 1; // Default WO score if not defined in rules
        return 0;
    }
    let sum = 0;
    Object.values(periodScores[schoolA.id] || {}).forEach(v => {
      sum += parseInt(v) || 0;
    });
    return sum;
  }, [periodScores, schoolA, isWO, woWinnerId]);

  const totalScoreB = useMemo(() => {
    if (!schoolB) return 0;
    if (isWO) {
        if (woWinnerId === schoolB.id) return 1;
        return 0;
    }
    let sum = 0;
    Object.values(periodScores[schoolB.id] || {}).forEach(v => {
      sum += parseInt(v) || 0;
    });
    return sum;
  }, [periodScores, schoolB, isWO, woWinnerId]);

  const launchMut = useMutation({
    mutationFn: async () => {
      const payload = {
        is_wo: isWO,
        wo_winner_id: woWinnerId,
        entries: match.entries.map((e: any) => ({
          match_entry_id: e.id,
          score: e.id === schoolA?.id ? totalScoreA.toString() : totalScoreB.toString(),
          outcome: isWO ? (e.id === woWinnerId ? 'wo_win' : 'wo_loss') : (
            (e.id === schoolA?.id ? totalScoreA : totalScoreB) > (e.id === schoolA?.id ? totalScoreB : totalScoreA) ? 'win' : 
            (totalScoreA === totalScoreB ? 'draw' : 'loss')
          ),
          score_detail: {
            periods: periodScores[e.id],
            is_wo: isWO && e.id === woWinnerId
          }
        })),
        penalty_shots: penalties
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
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message)
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
            <Button className="gap-2" onClick={() => launchMut.mutate()} disabled={launchMut.isPending || !canWrite}>
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
            <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 flex items-center justify-between">
              <div className="flex-1 text-center">
                <h3 className="text-xl font-bold mb-1">{schoolAName}</h3>
                <p className="text-xs opacity-80">{schoolA?.teams?.delegations?.institutions?.name}</p>
              </div>
              <div className="flex flex-col items-center px-12">
                <div className="flex items-center gap-8 text-6xl font-black">
                  <span>{totalScoreA}</span>
                  <span className="text-3xl opacity-50">×</span>
                  <span>{totalScoreB}</span>
                </div>
                {isWO && (
                  <Badge variant="secondary" className="mt-4 bg-white text-primary font-bold">
                    VENCIDO POR W.O.
                  </Badge>
                )}
              </div>
              <div className="flex-1 text-center">
                <h3 className="text-xl font-bold mb-1">{schoolBName}</h3>
                <p className="text-xs opacity-80">{schoolB?.teams?.delegations?.institutions?.name}</p>
              </div>
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

            {/* Cartões (Gaps Stage 4) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" /> Cartões
                </CardTitle>
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
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Cartão
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cards.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum cartão registrado.</p>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Escola</TableHead>
                            <TableHead>Jogador</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="w-[100px]">Minuto</TableHead>
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
                                  <SelectTrigger className="h-8">
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
                                  <SelectTrigger className="h-8">
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
                                  <SelectTrigger className="h-8">
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
                                  className="h-8" 
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
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Info do Confronto */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Dados do Confronto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{match?.match_date ? new Date(match.match_date + "T00:00:00").toLocaleDateString("pt-BR") : "Data não definida"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{match?.start_time?.slice(0, 5) || "Hora não definida"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{match?.venue?.name || "Local não definido"}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">Status Atual:</span>
                    <Badge variant="outline">{match?.status}</Badge>
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
                    <Select value={woWinnerId} onValueChange={setWoWinnerId}>
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
                  <p className="text-xs text-muted-foreground">Ative para registrar vitória por não comparecimento.</p>
                )}
              </CardContent>
            </Card>

            {/* Histórico/Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History className="h-4 w-4" /> Histórico de Auditoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground italic">
                  As alterações nesta tela são gravadas com snapshot completo para fins de auditoria.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
