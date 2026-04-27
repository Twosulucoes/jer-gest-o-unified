import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, AlertTriangle, Trophy, History, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";

interface ResultadoTabProps {
  sportEventId: string;
}

interface ParticipantResult {
  match_entry_id: string;
  participant_id: string;
  name: string;
  institution: string;
  score: string;
  outcome: string; // active, dns, dsq
  classification: number | null;
  notes: string;
}

export function ResultadoTab({ sportEventId }: ResultadoTabProps) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [results, setResults] = useState<ParticipantResult[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  
  // Homologation state
  const [showHomologateDialog, setShowHomologateDialog] = useState(false);
  const [homologatePassword, setHomologatePassword] = useState("");
  const [homologateObservation, setHomologateObservation] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Fetch the first match of the sport event
  const { data: match, isLoading: loadingMatch, refetch: refetchMatch } = useQuery({
    queryKey: ["ranking_match", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select("id, status")
        .eq("sport_event_id", sportEventId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  const matchId = match?.id;

  // Fetch participants and results
  const { data: initialData, isLoading: loadingData } = useQuery({
    queryKey: ["ranking_results", matchId],
    queryFn: async () => {
      if (!matchId) return null;

      const { data: entries, error: entriesError } = await supabase
        .from("competition_match_entries")
        .select(`
          id,
          participant_sport_event_id,
          participant_sport_events (
            id,
            participants (
              id,
              people (full_name, institutions (name)),
              teams (name, institutions (name))
            )
          )
        `)
        .eq("match_id", matchId);

      if (entriesError) throw entriesError;

      const { data: currentResults, error: resultsError } = await supabase
        .from("competition_match_results")
        .select("match_entry_id, score, outcome, position, notes, result_status")
        .eq("match_id", matchId);

      if (resultsError) throw resultsError;

      const resultsMap = new Map(currentResults?.map(r => [r.match_entry_id, r]));

      return (entries || []).map((entry: any) => {
        const p = entry.participant_sport_events?.participants;
        const isTeam = !!p?.teams;
        const res = resultsMap.get(entry.id);

        return {
          match_entry_id: entry.id,
          participant_id: entry.participant_sport_event_id,
          name: isTeam ? p?.teams?.name : p?.people?.full_name || "N/A",
          institution: isTeam 
            ? p?.teams?.institutions?.name 
            : p?.people?.institutions?.name || "N/A",
          score: res?.score || "",
          outcome: res?.outcome || "active",
          classification: res?.position || null,
          notes: res?.notes || "",
          status: res?.result_status || "agendado"
        };
      });
    },
    enabled: !!matchId,
  });

  useEffect(() => {
    if (initialData) {
      setResults(initialData.map(d => ({
        match_entry_id: d.match_entry_id,
        participant_id: d.participant_id,
        name: d.name,
        institution: d.institution,
        score: d.score,
        outcome: d.outcome,
        classification: d.classification,
        notes: d.notes
      })));
      setIsDirty(false);
    }
  }, [initialData]);

  const resultStatus = initialData?.[0]?.status || "agendado";
  const canWrite = hasRole("admin") || hasRole("coordenacao_tecnica") || hasRole("mesario");
  const isLocked = (resultStatus === "resultado_validado" || resultStatus === "publicado") && !hasRole("admin");
  const canHomologate = (hasRole("admin") || hasRole("coordenacao_tecnica")) && resultStatus === "resultado_lancado";

  // Recalculate classification
  const calculatedResults = useMemo(() => {
    const sorted = [...results]
      .filter(r => r.outcome === "active")
      .sort((a, b) => {
        const scoreA = parseFloat(a.score.replace(",", ".")) || 0;
        const scoreB = parseFloat(b.score.replace(",", ".")) || 0;
        return scoreB - scoreA; // Higher score is better
      });

    const newResults = results.map(r => {
      if (r.outcome !== "active") return { ...r, classification: null };
      
      const scoreR = parseFloat(r.score.replace(",", ".")) || 0;
      let pos = 1;
      
      for (let i = 0; i < sorted.length; i++) {
        const sScore = parseFloat(sorted[i].score.replace(",", ".")) || 0;
        if (sScore > scoreR) {
          pos++;
        } else if (sScore === scoreR) {
          break;
        }
      }
      
      return { ...r, classification: pos };
    });

    return newResults;
  }, [results]);

  const handleScoreChange = (matchEntryId: string, score: string) => {
    setResults(prev => prev.map(r => 
      r.match_entry_id === matchEntryId ? { ...r, score } : r
    ));
    setIsDirty(true);
  };

  const handleOutcomeChange = (matchEntryId: string, outcome: string) => {
    setResults(prev => prev.map(r => 
      r.match_entry_id === matchEntryId ? { ...r, outcome, score: outcome !== "active" ? "" : r.score } : r
    ));
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!matchId || !eventId) return;

      const payload = {
        family: "ranking",
        entries: calculatedResults.map(r => ({
          match_entry_id: r.match_entry_id,
          participant_id: r.participant_id,
          score: r.score,
          outcome: r.outcome,
          classification: r.classification,
          notes: r.notes
        })),
        notes: generalNotes
      };

      const { data, error } = await supabase.rpc("rpc_launch_match_result", {
        p_event_id: eventId,
        p_match_id: matchId,
        p_payload: payload
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ranking_results", matchId] });
      queryClient.invalidateQueries({ queryKey: ["sport_events_ranking"] });
      toast.success("Resultados salvos com sucesso");
      setIsDirty(false);
    },
    onError: (error) => {
      toast.error("Erro ao salvar resultados: " + error.message);
    }
  });

  const homologateMutation = useMutation({
    mutationFn: async () => {
      setIsVerifyingPassword(true);
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-current-user-password', {
          body: { password: homologatePassword }
        });

        if (verifyError) throw verifyError;
        if (!verifyData.valid) throw new Error(verifyData.message || "Senha incorreta");

        const { data, error } = await supabase.rpc("rpc_homologate_match_result", {
          p_match_id: matchId,
          p_observation: homologateObservation,
          p_password: homologatePassword // Still needed by RPC signature even if verified by function
        } as any);
        
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
      queryClient.invalidateQueries({ queryKey: ["ranking_results", matchId] });
      queryClient.invalidateQueries({ queryKey: ["sport_events_ranking"] });
    },
    onError: (e: any) => {
      toast.error("Erro ao homologar: " + e.message);
    }
  });

  if (loadingMatch || loadingData) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!matchId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
        <p>Nenhuma partida montada para esta prova</p>
        <p className="text-xs">Verifique a estrutura da prova no SIGECOM</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Classificação e Pontuação
        </h3>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" className="gap-2">
             <History className="h-4 w-4" /> Histórico
           </Button>
           {canHomologate && (
              <Button 
                variant="secondary" 
                size="sm"
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-none"
                onClick={() => setShowHomologateDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Homologar Resultado
              </Button>
           )}
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <th className="px-4 py-3 text-center font-medium w-16">Pos</th>
              <th className="px-4 py-3 text-left font-medium">Participante</th>
              <th className="px-4 py-3 text-center font-medium w-32">Pontuação</th>
              <th className="px-4 py-3 text-center font-medium w-40">Status</th>
              <th className="px-4 py-3 text-left font-medium">Observação</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calculatedResults.map((r) => (
              <TableRow key={r.match_entry_id} className={cn(
                r.outcome !== "active" && "bg-muted/50 opacity-60",
                r.classification === 1 && "bg-yellow-50/50"
              )}>
                <TableCell className="text-center font-bold">
                  {r.classification ? `${r.classification}º` : "-"}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-muted-foreground text-[10px]">{r.institution}</div>
                </TableCell>
                <TableCell className="text-center">
                  <Input 
                    type="text" 
                    placeholder="0.000"
                    className="h-8 text-center font-mono"
                    value={r.score}
                    onChange={(e) => handleScoreChange(r.match_entry_id, e.target.value)}
                    disabled={r.outcome !== "active" || isLocked}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Select 
                    value={r.outcome} 
                    onValueChange={(val) => handleOutcomeChange(r.match_entry_id, val)}
                    disabled={isLocked}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Participou</SelectItem>
                      <SelectItem value="dns">DNS (Ausente)</SelectItem>
                      <SelectItem value="dsq">DSQ (Descl.)</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input 
                    placeholder="Opcional..."
                    className="h-8 text-xs"
                    value={r.notes}
                    disabled={isLocked}
                    onChange={(e) => {
                      setResults(prev => prev.map(res => 
                        res.match_entry_id === r.match_entry_id ? { ...res, notes: e.target.value } : res
                      ));
                      setIsDirty(true);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observações Gerais da Prova</label>
        <Textarea 
          placeholder="Registre ocorrências, recursos ou observações gerais..."
          className="min-h-[100px]"
          value={generalNotes}
          disabled={isLocked}
          onChange={(e) => {
            setGeneralNotes(e.target.value);
            setIsDirty(true);
          }}
        />
      </div>

      <div className="flex justify-end pt-4 border-t sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 -mx-4">
        <Button 
          onClick={() => saveMutation.mutate()} 
          disabled={!isDirty || saveMutation.isPending || !canWrite || isLocked}
          className="gap-2 px-8"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Resultados"}
        </Button>
      </div>

      {/* Homologation Dialog */}
      <Dialog open={showHomologateDialog} onOpenChange={setShowHomologateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Homologar Resultado da Prova</DialogTitle>
            <DialogDescription>
              A homologação valida os resultados e permite a publicação oficial. 
              Esta ação exige sua senha de acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sua Senha</label>
              <Input 
                type="password" 
                placeholder="Confirme sua senha"
                value={homologatePassword}
                onChange={(e) => setHomologatePassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (Opcional)</label>
              <Textarea 
                placeholder="Notas que constarão na auditoria da homologação..."
                value={homologateObservation}
                onChange={(e) => setHomologateObservation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHomologateDialog(false)}>Cancelar</Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white border-none"
              onClick={() => homologateMutation.mutate()}
              disabled={!homologatePassword || homologateMutation.isPending || isVerifyingPassword}
            >
              {homologateMutation.isPending ? "Processando..." : "Confirmar Homologação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
