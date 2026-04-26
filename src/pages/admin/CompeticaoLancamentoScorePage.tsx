import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Trophy, 
  Save, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  MapPin, 
  Plus, 
  Trash2, 
  Pencil,
  PlusCircle,
  XCircle,
  CheckCircle2,
  AlertCircle,
  RotateCcw
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

export default function CompeticaoLancamentoScorePage() {
  const { matchId, sportEventId } = useParams();
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  
  const canWrite = hasRole("admin") || hasRole("coordenacao_tecnica");

  // Fetch match details
  const { data: match, isLoading: loadingMatch } = useQuery({
    queryKey: ["match-detail", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          phase:competition_phases(id, name, type),
          group:competition_groups(id, name),
          venue:venues(id, name),
          entries:competition_match_entries(
            id, side, team_id, participant_sport_event_id,
            teams(id, name, delegations(id, institutions(id, name)))
          )
        `)
        .eq("id", matchId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  // Fetch modality rules
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["modality-rules", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          id, sport_id, match_config, 
          sport:sports(id, name, slug, is_collective)
        `)
        .eq("id", sportEventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  // Fetch lineups (only for collective sports)
  const { data: lineups = [], isLoading: loadingLineups } = useQuery({
    queryKey: ["match-lineups", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select(`
          id, match_entry_id, participant_id, jersey_number, status,
          participant:participants(id, person:people(id, full_name))
        `)
        .eq("match_id", matchId!)
        .in("status", ["active", "bench"]);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && rules?.sport?.is_collective,
  });

  // Fetch existing results
  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ["match-results", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select("*")
        .eq("match_id", matchId!);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  // Fetch match events (goals/cards)
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["match-events", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId!)
        .order("period")
        .order("minute");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!matchId,
  });

  // Fetch penalty shots
  const { data: penaltyShots = [], isLoading: loadingPenalties } = useQuery({
    queryKey: ["match-penalty-shots", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_penalty_shots" as any)
        .select("*")
        .eq("match_id", matchId!)
        .order("ordem");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!matchId,
  });

  const [periods, setPeriods] = useState<Record<string, Record<string, string>>>({});
  const [wo, setWo] = useState<{ enabled: boolean; winnerId: string | null }>({ enabled: false, winnerId: null });

  useEffect(() => {
    if (results.length > 0) {
      // Initialize state from existing results
    }
  }, [results]);

  const handleSave = async () => {
    try {
      const { data, error } = await supabase.rpc("rpc_launch_match_result", {
        p_event_id: eventId!,
        p_match_id: matchId!,
        p_payload: {
          periods,
          wo,
          updated_by: user?.id
        }
      });
      if (error) throw error;
      toast.success("Resultado salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["match-results", matchId] });
      navigate(-1);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  if (loadingMatch || loadingRules || loadingLineups || loadingResults || loadingEvents || loadingPenalties) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Lançamento de Resultado
              </h1>
              <p className="text-sm text-muted-foreground">
                {rules?.sport?.name} - {match?.phase?.name} {match?.group?.name ? `(${match?.group?.name})` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" /> Salvar Resultado
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* Cabeçalho de Placar */}
        <Card className="bg-muted/20">
          <CardContent className="py-6">
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <p className="font-bold text-lg">{match?.entries?.[0]?.teams?.name || "Escola A"}</p>
              </div>
              <div className="px-6 text-3xl font-black font-mono">
                {Object.values(periods).reduce((acc, p) => acc + (parseInt(p.home) || 0), 0)} 
                <span className="text-muted-foreground mx-2">×</span>
                {Object.values(periods).reduce((acc, p) => acc + (parseInt(p.away) || 0), 0)}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{match?.entries?.[1]?.teams?.name || "Escola B"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blocos de Lançamento */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Placar por Período</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Períodos dinâmicos */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs font-bold text-muted-foreground px-2">
                  <span>Período</span>
                  <span className="text-center">Escola A</span>
                  <span className="text-center">Escola B</span>
                </div>
                {[1, 2].map((p) => (
                  <div key={p} className="grid grid-cols-3 gap-2 items-center">
                    <Badge variant="outline" className="justify-center">{p}º Tempo</Badge>
                    <Input 
                      type="number" 
                      value={periods[p]?.home || ""} 
                      onChange={(e) => setPeriods({...periods, [p]: {...periods[p], home: e.target.value}})}
                    />
                    <Input 
                      type="number" 
                      value={periods[p]?.away || ""} 
                      onChange={(e) => setPeriods({...periods, [p]: {...periods[p], away: e.target.value}})}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>W.O. e Penalidades</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ativar W.O.</Label>
                <Switch checked={wo.enabled} onCheckedChange={(v) => setWo({ ...wo, enabled: v })} />
              </div>
              {wo.enabled && (
                <Select value={wo.winnerId || ""} onValueChange={(v) => setWo({ ...wo, winnerId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vencedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {match?.entries?.map((e: any) => (
                      <SelectItem key={e.id} value={e.team_id}>{e.teams?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
