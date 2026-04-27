import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  Trophy, 
  Save, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  History,
  RotateCcw,
  Calendar,
  MapPin,
  Info,
  ChevronDown,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

interface PenaltyRecord {
  type: string;
  time: string;
  notes?: string;
}

export default function CompeticaoLancamentoCombatPage() {
  const { matchId, sportEventId } = useParams();
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  
  const canWrite = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("mesario");

  // Fetch match details
  const { data: match, isLoading: loadingMatch, refetch: refetchMatch } = useQuery({
    queryKey: ["match-detail-combat", matchId],
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
            participant:participant_sport_events(
              id,
              participant:participants(
                id, 
                person:people(id, full_name),
                delegation:delegations(id, institution:institutions(id, name))
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

  const { rules, rulesData, isLoading: loadingRules } = useSportEventRules(eventId, sportEventId || null);

  // State
  const [winnerEntryId, setWinnerEntryId] = useState<string>("");
  const [victoryMethod, setVictoryMethod] = useState<string>("");
  const [matchTime, setMatchTime] = useState<string>("00:00");
  const [observations, setObservations] = useState<string>("");
  
  // Placar states
  const [scores, setScores] = useState<Record<string, any>>({});
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeTime, setOvertimeTime] = useState<string>("00:00");
  const [overtimeScore, setOvertimeScore] = useState<Record<string, any>>({});
  
  // Penalties
  const [penalties, setPenalties] = useState<Record<string, PenaltyRecord[]>>({});

  // Dialogs
  const [showHomologateDialog, setShowHomologateDialog] = useState(false);
  const [homologatePassword, setHomologatePassword] = useState("");
  const [homologateObservation, setHomologateObservation] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  const entryA = match?.entries?.find((e: any) => e.side === "A");
  const entryB = match?.entries?.find((e: any) => e.side === "B");
  
  const resultStatus = entryA?.results?.[0]?.result_status || "agendado";
  const isLocked = (resultStatus === "resultado_validado" || resultStatus === "publicado") && !hasRole("admin");
  const canHomologate = (hasRole("admin") || hasRole("coordenacao_tecnica")) && resultStatus === "resultado_lancado";

  const modalityName = (rulesData as any)?.sport_name || "Combate";
  const sportNameLower = modalityName.toLowerCase();

  // Load existing results if any
  useEffect(() => {
    if (match?.entries) {
      const res = match.entries[0]?.results?.[0];
      if (res) {
        setWinnerEntryId(res.outcome === 'win' || res.outcome === 'wo_win' ? match.entries[0].id : (match.entries[1]?.results?.[0]?.outcome === 'win' || match.entries[1]?.results?.[0]?.outcome === 'wo_win' ? match.entries[1].id : ""));
        
        // Find winner based on outcome
        const winner = match.entries.find((e: any) => e.results?.[0]?.outcome === 'win' || e.results?.[0]?.outcome === 'wo_win');
        if (winner) setWinnerEntryId(winner.id);
        else if (match.entries.every((e: any) => e.results?.[0]?.outcome === 'draw')) setWinnerEntryId("draw");
        else if (match.entries.every((e: any) => e.results?.[0]?.outcome === 'loss' || e.results?.[0]?.outcome === 'wo_loss')) setWinnerEntryId("none");

        const detail = res.combat_detail as any;
        if (detail) {
          setVictoryMethod(detail.victory_method || "");
          setMatchTime(detail.match_time || "00:00");
          setObservations(res.notes || "");
          setScores(detail.scores || {});
          setIsOvertime(detail.is_overtime || false);
          setOvertimeTime(detail.overtime_time || "00:00");
          setOvertimeScore(detail.overtime_score || {});
          setPenalties(detail.penalties || {});
        }
      }
    }
  }, [match]);

  // Methods by modality
  const getVictoryMethods = () => {
    if (sportNameLower.includes("judô") || sportNameLower.includes("judo")) {
      return ["Ippon", "Waza-ari", "Hantei (Decisão)", "Kiken (Desistência)", "Hansoku-make (Desclassificação)", "Fusen-gachi (W.O.)"];
    }
    if (sportNameLower.includes("karatê") || sportNameLower.includes("karate")) {
      return ["Pontos", "Hansoku (Desclassificação)", "Kiken (Desistência)", "Shikkaku (Expulsão)", "Hantei (Decisão)", "Fusen-gachi (W.O.)"];
    }
    if (sportNameLower.includes("taekwondo")) {
      return ["Pontos", "Knockout", "Decisão", "Punição (Gam-jeom)", "Desistência", "Desclassificação", "Fusen-gachi (W.O.)"];
    }
    if (sportNameLower.includes("wrestling") || sportNameLower.includes("luta livre")) {
      return ["Toque (Pin/Fall)", "Pontos", "Superioridade Técnica", "Desclassificação", "Desistência", "Fusen-gachi (W.O.)"];
    }
    return ["Pontos", "Knockout", "Desclassificação", "Desistência", "Decisão", "W.O."];
  };

  const methods = getVictoryMethods();

  const validate = () => {
    if (!winnerEntryId && victoryMethod !== "Fusen-gachi (W.O.)") {
      toast.error("Selecione o vencedor");
      return false;
    }
    if (!victoryMethod) {
      toast.error("Selecione o método de vitória");
      return false;
    }
    if (!matchTime || matchTime === "00:00") {
      toast.error("Informe o tempo de luta");
      return false;
    }
    
    // Eliminatória empatada
    if (match?.phase?.phase_type === 'knockout' && winnerEntryId === 'draw') {
      toast.error("Fase eliminatória exige um vencedor. Use prorrogação se necessário.");
      return false;
    }

    return true;
  };

  const launchMut = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validação falhou");

      const isWO = victoryMethod.includes("W.O.") || victoryMethod === "Fusen-gachi (W.O.)";
      
      const payload = {
        is_wo: isWO,
        entries: match.entries.map((e: any) => ({
          match_entry_id: e.id,
          outcome: winnerEntryId === e.id ? (isWO ? 'wo_win' : 'win') : (winnerEntryId === 'draw' ? 'draw' : (isWO ? 'wo_loss' : 'loss')),
          score: winnerEntryId === e.id ? "V" : "D",
          score_detail: {
            victory_method: victoryMethod,
            match_time: matchTime,
            scores: scores,
            is_overtime: isOvertime,
            overtime_time: overtimeTime,
            overtime_score: overtimeScore,
            penalties: penalties
          }
        })),
        notes: observations
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
      qc.invalidateQueries({ queryKey: ["combat-matches"] });
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

        const { data, error } = await supabase.rpc("rpc_homologate_match_result", {
          p_match_id: matchId,
          p_password: homologatePassword, // Still required by RPC but verified above
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
      qc.invalidateQueries({ queryKey: ["combat-matches"] });
      qc.invalidateQueries({ queryKey: ["knockout-bracket"] });
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

  const athleteA = entryA?.participant?.participant;
  const athleteB = entryB?.participant?.participant;

  const handleScoreChange = (entryId: string, field: string, val: string) => {
    setScores(prev => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] || {}),
        [field]: val
      }
    }));
  };

  const isJudo = sportNameLower.includes("judô") || sportNameLower.includes("judo");

  return (
    <div className="flex flex-col min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Lançamento de Resultado Combat
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
        {/* Atletas em destaque */}
        <Card className="overflow-hidden border-none shadow-lg">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
                {/* Atleta A */}
                <div className={cn(
                  "flex flex-col items-center p-6 rounded-2xl transition-all border-2",
                  winnerEntryId === entryA?.id ? "bg-primary/20 border-primary" : "bg-white/5 border-transparent"
                )}>
                  <div className="h-20 w-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold mb-4">
                    {athleteA?.person?.full_name?.charAt(0)}
                  </div>
                  <h3 className="text-xl font-bold text-center">{athleteA?.person?.full_name}</h3>
                  <p className="text-sm opacity-70 mt-1">{athleteA?.delegation?.institution?.name}</p>
                  {winnerEntryId === entryA?.id && (
                    <Badge className="mt-4 bg-primary hover:bg-primary text-white font-bold px-4">VENCEDOR</Badge>
                  )}
                </div>

                {/* VS / Status */}
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-black italic opacity-20 mb-4">VS</div>
                  <div className="text-center space-y-2">
                    <Badge variant="outline" className="text-white border-white/20 px-3">
                      {resultStatus === 'resultado_lancado' ? 'LANÇADO' : 
                       resultStatus === 'resultado_validado' ? 'HOMOLOGADO' : 
                       resultStatus === 'publicado' ? 'PUBLICADO' : 'AGENDADO'}
                    </Badge>
                    {winnerEntryId && winnerEntryId !== 'draw' && winnerEntryId !== 'none' && (
                      <div className="text-sm font-medium text-primary">
                        Vitória de {match.entries.find((e: any) => e.id === winnerEntryId)?.participant?.participant?.person?.full_name} por {victoryMethod}
                      </div>
                    )}
                  </div>
                </div>

                {/* Atleta B */}
                <div className={cn(
                  "flex flex-col items-center p-6 rounded-2xl transition-all border-2",
                  winnerEntryId === entryB?.id ? "bg-primary/20 border-primary" : "bg-white/5 border-transparent"
                )}>
                  <div className="h-20 w-20 rounded-full bg-red-600 flex items-center justify-center text-3xl font-bold mb-4">
                    {athleteB?.person?.full_name?.charAt(0)}
                  </div>
                  <h3 className="text-xl font-bold text-center">{athleteB?.person?.full_name}</h3>
                  <p className="text-sm opacity-70 mt-1">{athleteB?.delegation?.institution?.name}</p>
                  {winnerEntryId === entryB?.id && (
                    <Badge className="mt-4 bg-primary hover:bg-primary text-white font-bold px-4">VENCEDOR</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Bloco Resultado Principal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Resultado Principal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Selecione o Vencedor</Label>
                    <Select value={winnerEntryId} onValueChange={setWinnerEntryId} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Quem venceu?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={entryA?.id}>{athleteA?.person?.full_name}</SelectItem>
                        <SelectItem value={entryB?.id}>{athleteB?.person?.full_name}</SelectItem>
                        {match?.phase?.phase_type !== 'knockout' && (
                          <SelectItem value="draw">Empate</SelectItem>
                        )}
                        <SelectItem value="none">Sem Disputa / Dupla Descl.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Método de Vitória</Label>
                    <Select value={victoryMethod} onValueChange={setVictoryMethod} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue placeholder="Como foi a vitória?" />
                      </SelectTrigger>
                      <SelectContent>
                        {methods.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Timer className="h-4 w-4" /> Tempo de Luta (mm:ss)
                    </Label>
                    <Input 
                      placeholder="00:00" 
                      value={matchTime} 
                      onChange={(e) => setMatchTime(e.target.value)}
                      disabled={isLocked}
                      className="font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bloco Placar Dinâmico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Detalhamento de Pontos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isJudo ? (
                  /* Judo Scoreboard */
                  <div className="grid grid-cols-2 gap-8">
                    {[entryA, entryB].map((e, idx) => (
                      <div key={e.id} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-3 w-3 rounded-full", idx === 0 ? "bg-blue-600" : "bg-red-600")} />
                          <span className="font-semibold text-sm">{e.participant?.participant?.person?.full_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Ippon</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              max="1" 
                              value={scores[e.id]?.ippon || 0} 
                              onChange={(val) => handleScoreChange(e.id, 'ippon', val.target.value)}
                              disabled={isLocked}
                              className="text-center font-bold"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Waza-ari</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              value={scores[e.id]?.wazaari || 0} 
                              onChange={(val) => handleScoreChange(e.id, 'wazaari', val.target.value)}
                              disabled={isLocked}
                              className="text-center font-bold"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Shido (Penal.)</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              max="3"
                              value={scores[e.id]?.shido || 0} 
                              onChange={(val) => handleScoreChange(e.id, 'shido', val.target.value)}
                              disabled={isLocked}
                              className="text-center font-bold text-amber-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* General Combat Scoreboard (Karate, Taekwondo, Wrestling) */
                  <div className="grid grid-cols-2 gap-8">
                    {[entryA, entryB].map((e, idx) => (
                      <div key={e.id} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-3 w-3 rounded-full", idx === 0 ? "bg-blue-600" : "bg-red-600")} />
                          <span className="font-semibold text-sm">{e.participant?.participant?.person?.full_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Pontos</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              value={scores[e.id]?.points || 0} 
                              onChange={(val) => handleScoreChange(e.id, 'points', val.target.value)}
                              disabled={isLocked}
                              className="text-center font-bold text-xl"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Penalidades</Label>
                            <Input 
                              type="number" 
                              min="0" 
                              value={scores[e.id]?.penalties || 0} 
                              onChange={(val) => handleScoreChange(e.id, 'penalties', val.target.value)}
                              disabled={isLocked}
                              className="text-center font-bold text-red-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bloco Prorrogação */}
            <Card className={cn(winnerEntryId === 'draw' || isOvertime ? "border-amber-200 bg-amber-50/30" : "opacity-60")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" /> Prorrogação (Golden Score / Overtime)
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsOvertime(!isOvertime)}
                    disabled={isLocked}
                  >
                    {isOvertime ? "Remover" : "Adicionar"}
                  </Button>
                </CardTitle>
              </CardHeader>
              {isOvertime && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Tempo na Prorrogação</Label>
                      <Input 
                        placeholder="00:00" 
                        value={overtimeTime} 
                        onChange={(e) => setOvertimeTime(e.target.value)}
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                     {[entryA, entryB].map((e) => (
                        <div key={e.id} className="space-y-1.5">
                          <Label className="text-[10px] uppercase">{e.participant?.participant?.person?.full_name}</Label>
                          <Input 
                            placeholder="Pontos/Critério" 
                            value={overtimeScore[e.id] || ""}
                            onChange={(ev) => setOvertimeScore(prev => ({ ...prev, [e.id]: ev.target.value }))}
                            disabled={isLocked}
                          />
                        </div>
                     ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            {/* Bloco Observações */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Registre ocorrências, lesões ou decisões da arbitragem..."
                  className="min-h-[150px]"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  disabled={isLocked}
                />
              </CardContent>
            </Card>

            {/* Regras Aplicadas */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Configurações da Prova</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Formato:</span>
                  <span className="font-medium">{rules?.format === 'knockout' ? 'Eliminatória Simples' : 'Chave de Combate'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de Placar:</span>
                  <span className="font-medium">{rules?.scoring?.score_type}</span>
                </div>
                {!rules && !loadingRules && (
                  <Alert variant="warning" className="mt-4 p-2 text-[10px]">
                    <AlertTriangle className="h-3 w-3" />
                    <AlertDescription>
                      Regras não encontradas. Verifique o cadastro em Regras.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Homologate Dialog */}
      <Dialog open={showHomologateDialog} onOpenChange={setShowHomologateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Homologar Resultado</DialogTitle>
            <DialogDescription>
              Confirme os dados da luta. Após homologar, o vencedor avançará automaticamente na chave.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-4 rounded-lg border text-sm space-y-2">
              <div className="flex justify-between font-bold">
                <span>Vencedor:</span>
                <span className="text-primary">{match.entries.find((e: any) => e.id === winnerEntryId)?.participant?.participant?.person?.full_name || "Nenhum"}</span>
              </div>
              <div className="flex justify-between">
                <span>Método:</span>
                <span>{victoryMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Tempo:</span>
                <span>{matchTime}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observação da Coordenação (opcional)</Label>
              <Textarea 
                placeholder="Ex: Resultado validado após revisão do vídeo."
                value={homologateObservation}
                onChange={(e) => setHomologateObservation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Sua Senha de Confirmação</Label>
              <Input 
                type="password" 
                value={homologatePassword} 
                onChange={(e) => setHomologatePassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHomologateDialog(false)}>Cancelar</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => homologateMut.mutate()}
              disabled={homologateMut.isPending || !homologatePassword}
            >
              {homologateMut.isPending ? "Verificando..." : "Confirmar Homologação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
