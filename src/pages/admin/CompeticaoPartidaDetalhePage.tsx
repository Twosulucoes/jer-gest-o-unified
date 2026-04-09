import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CalendarDays, Clock, Plus, Trash2, Pencil, CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CompetitionMatchFormDialog, { type MatchFormValues } from "@/components/admin/CompetitionMatchFormDialog";
import CollectiveScoreForm, { type ScoreEntry } from "@/components/admin/CollectiveScoreForm";
import type { MatchConfig } from "@/components/admin/MatchConfigEditor";
import MatchLineupCard from "@/components/admin/MatchLineupCard";
import MatchOfficialsCard from "@/components/admin/MatchOfficialsCard";
import MatchPlayerStatsCard from "@/components/admin/MatchPlayerStatsCard";

const STATUS_OPTIONS = [
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em andamento" },
  { value: "finished", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

const RESULT_STATUS_LABEL: Record<string, string> = {
  resultado_lancado: "Lançado",
  resultado_validado: "Validado",
  publicado: "Publicado",
};
const RESULT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  resultado_lancado: "outline",
  resultado_validado: "default",
  publicado: "secondary",
};

const OUTCOME_OPTIONS = [
  { value: "", label: "— Nenhum —" },
  { value: "win", label: "Vitória" },
  { value: "loss", label: "Derrota" },
  { value: "draw", label: "Empate" },
  { value: "wo_win", label: "WO (vitória)" },
  { value: "wo_loss", label: "WO (derrota)" },
  { value: "dsq", label: "Desclassificado" },
  { value: "dns", label: "Não compareceu (DNS)" },
  { value: "dnf", label: "Não concluiu (DNF)" },
  { value: "cancelled", label: "Cancelado" },
];

const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  OUTCOME_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

type ResultFormEntry = {
  score: string;
  position: string;
  result_text: string;
  outcome: string;
  time_ms: string;
  distance_cm: string;
  points: string;
  penalty_notes: string;
};

const emptyResultForm = (): ResultFormEntry => ({
  score: "", position: "", result_text: "", outcome: "", time_ms: "", distance_cm: "", points: "", penalty_notes: "",
});

const formatTimeMs = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
  return `${secs}.${millis.toString().padStart(3, "0")}s`;
};

const formatDistanceCm = (cm: number): string => {
  if (cm >= 100) return `${(cm / 100).toFixed(2)}m`;
  return `${cm}cm`;
};

export default function CompeticaoPartidaDetalhePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  
  const [selectedPSEId, setSelectedPSEId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultForm, setResultForm] = useState<Record<string, ResultFormEntry>>({});
  const [resultNotes, setResultNotes] = useState("");
  const [confirmRemoveEntryId, setConfirmRemoveEntryId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"validate" | "publish" | "unpublish" | null>(null);
  const [collectiveScoreOpen, setCollectiveScoreOpen] = useState(false);

  // Fetch match
  const { data: match, isLoading } = useQuery({
    queryKey: ["competition_match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_matches").select("*").eq("id", matchId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { data: phase } = useQuery({
    queryKey: ["competition_phase", match?.phase_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_phases").select("*").eq("id", match!.phase_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!match?.phase_id,
  });

  const { data: sportEvent } = useQuery({
    queryKey: ["sport_event", phase?.sport_event_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sport_events").select("*").eq("id", phase!.sport_event_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!phase?.sport_event_id,
  });

  const { data: sport } = useQuery({
    queryKey: ["sport_for_match", sportEvent?.sport_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sports").select("*").eq("id", sportEvent!.sport_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEvent?.sport_id,
  });

  const isCollective = sport?.is_collective ?? false;

  const { data: venue } = useQuery({
    queryKey: ["venue", match?.venue_id],
    queryFn: async () => {
      if (!match?.venue_id) return null;
      const { data, error } = await supabase.from("venues").select("*").eq("id", match.venue_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!match?.venue_id,
  });

  const { data: allPhases = [] } = useQuery({
    queryKey: ["competition_phases", match?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_phases").select("*").eq("event_id", match!.event_id).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!match?.event_id,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["competition_groups", match?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_groups").select("*").eq("event_id", match!.event_id).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!match?.event_id,
  });

  const { data: allVenues = [] } = useQuery({
    queryKey: ["venues", match?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues").select("*").eq("event_id", match!.event_id).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!match?.event_id,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["competition_match_entries", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_match_entries").select("*").eq("match_id", matchId!).order("side").order("seed");
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  const { data: results = [] } = useQuery({
    queryKey: ["competition_match_results", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_match_results").select("*").eq("match_id", matchId!);
      if (error) throw error;
      return data;
    },
    enabled: !!matchId,
  });

  // Match scores for collective sports
  const { data: matchScores = [] } = useQuery({
    queryKey: ["match_scores", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_scores" as any).select("*").eq("match_id", matchId!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!matchId && isCollective,
  });


  const sportEventId = match?.sport_event_id ?? phase?.sport_event_id;
  const { data: teamsForSportEvent = [] } = useQuery({
    queryKey: ["teams_for_match", sportEventId],
    queryFn: async () => {
      if (!sportEventId) return [];
      const { data, error } = await supabase.from("teams").select("*").eq("sport_event_id", sportEventId).eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });
  const teamsMap = new Map(teamsForSportEvent.map((t: any) => [t.id, t]));

  // All PSEs for this sport event (for "add participant" dialog — confirmed only)
  const { data: availablePSE = [] } = useQuery({
    queryKey: ["participant_sport_events_for_match", sportEventId],
    queryFn: async () => {
      if (!sportEventId) return [];
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, participant_id, status")
        .eq("sport_event_id", sportEventId)
        .eq("status", "confirmed");
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  // PSEs linked to entries (any status — for reliable name resolution)
  const entryPseIds = entries.map((e) => e.participant_sport_event_id).filter(Boolean);
  const { data: linkedPSEs = [] } = useQuery({
    queryKey: ["linked_pses_for_match", matchId, entryPseIds.length],
    queryFn: async () => {
      if (!entryPseIds.length) return [];
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, participant_id, status")
        .in("id", entryPseIds);
      if (error) throw error;
      return data;
    },
    enabled: entryPseIds.length > 0,
  });

  // Merge all known PSEs (linked + available) for a complete map
  const allKnownPSEs = [...linkedPSEs, ...availablePSE];
  const pseMap = new Map(allKnownPSEs.map((p) => [p.id, p]));

  // Get all unique participant IDs from known PSEs
  const allParticipantIds = [...new Set(allKnownPSEs.map((p) => p.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["participants_for_match", match?.event_id, allParticipantIds.length],
    queryFn: async () => {
      if (!allParticipantIds.length) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, person_id, delegation_id")
        .in("id", allParticipantIds);
      if (error) throw error;
      return data;
    },
    enabled: allParticipantIds.length > 0,
  });

  const participantsMap = new Map(participants.map((p) => [p.id, p]));

  const personIds = [...new Set(participants.map((p) => p.person_id))];
  const { data: people = [] } = useQuery({
    queryKey: ["people_for_match", personIds.length, personIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name, cpf").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const resultsMap = new Map(results.map((r) => [r.match_entry_id, r]));

  const getEntryLabel = (entry: any) => {
    if (entry.team_id) {
      const team = teamsMap.get(entry.team_id);
      return team?.name ?? `⚠ Equipe (${entry.team_id.slice(0, 8)}…)`;
    }
    if (entry.participant_sport_event_id) {
      const pse = pseMap.get(entry.participant_sport_event_id);
      if (!pse) return `⚠ PSE (${entry.participant_sport_event_id.slice(0, 8)}…)`;
      const participant = participantsMap.get(pse.participant_id);
      if (!participant) return `⚠ Participante`;
      const person = peopleMap.get(participant.person_id);
      return person?.full_name ?? "⚠ Pessoa";
    }
    return "—";
  };

  const getPersonNameByParticipantId = (participantId: string) => {
    const participant = participantsMap.get(participantId);
    if (!participant) return "—";
    const person = peopleMap.get(participant.person_id);
    return person?.full_name ?? "—";
  };

  const linkedPSEIds = new Set(entries.filter((e) => e.participant_sport_event_id).map((e) => e.participant_sport_event_id));
  const linkedTeamIds = new Set(entries.filter((e) => e.team_id).map((e) => e.team_id));
  const availableToAdd = availablePSE.filter((p) => !linkedPSEIds.has(p.id));
  const availableTeamsToAdd = teamsForSportEvent.filter((t: any) => !linkedTeamIds.has(t.id));
  

  // Mutations
  const updateMatchMut = useMutation({
    mutationFn: async (v: MatchFormValues) => {
      const { error } = await supabase.from("competition_matches").update({
        phase_id: v.phase_id, group_id: v.group_id || null, match_number: v.match_number || null,
        match_date: v.match_date || null, start_time: v.start_time || null, venue_id: v.venue_id || null,
        status: v.status, notes: v.notes || null,
      }).eq("id", matchId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match", matchId] }); qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Partida atualizada"); setEditDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateStatusMut = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("competition_matches").update({ status }).eq("id", matchId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match", matchId] }); qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const addEntryMut = useMutation({
    mutationFn: async ({ pseId, teamId }: { pseId?: string; teamId?: string }) => {
      const payload: any = { match_id: matchId!, side: "participant" };
      if (pseId) payload.participant_sport_event_id = pseId;
      if (teamId) payload.team_id = teamId;
      const { error } = await supabase.from("competition_match_entries").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_entries", matchId] }); toast.success("Vinculado com sucesso"); setSelectedPSEId(""); setSelectedTeamId(""); setAddEntryOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const removeEntryMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("competition_match_entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_entries", matchId] }); toast.success("Participante removido"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // Results mutations
  const saveResultsMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const upserts = entries.map((entry) => {
        const form = resultForm[entry.id] || emptyResultForm();
        const existing = resultsMap.get(entry.id);
        return {
          ...(existing ? { id: existing.id } : {}),
          match_id: matchId!,
          match_entry_id: entry.id,
          score: form.score || null,
          position: form.position ? parseInt(form.position) : null,
          result_text: form.result_text || null,
          outcome: form.outcome || null,
          time_ms: form.time_ms ? parseInt(form.time_ms) : null,
          distance_cm: form.distance_cm ? parseInt(form.distance_cm) : null,
          points: form.points ? parseFloat(form.points) : null,
          penalty_notes: form.penalty_notes || null,
          result_status: "resultado_lancado",
          recorded_by: existing?.recorded_by ?? user.id,
          recorded_at: existing?.recorded_at ?? new Date().toISOString(),
          notes: resultNotes || null,
        };
      });
      const { error } = await supabase.from("competition_match_results").upsert(upserts as any, { onConflict: "match_entry_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_results", matchId] }); toast.success("Resultados lançados"); setResultDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const validateResultsMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const ids = results.filter((r) => r.result_status === "resultado_lancado").map((r) => r.id);
      if (!ids.length) throw new Error("Nenhum resultado pendente de validação");
      const { error } = await supabase.from("competition_match_results").update({
        result_status: "resultado_validado",
        validated_by: user.id,
        validated_at: new Date().toISOString(),
      }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_results", matchId] }); toast.success("Resultados validados"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const publishResultsMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const ids = results.filter((r) => r.result_status === "resultado_validado").map((r) => r.id);
      if (!ids.length) throw new Error("Nenhum resultado validado para publicar");
      const { error } = await supabase.from("competition_match_results").update({
        result_status: "publicado",
        published_by: user.id,
        published_at: new Date().toISOString(),
      }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_results", matchId] }); toast.success("Resultados publicados oficialmente"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const unpublishResultsMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const ids = results.filter((r) => r.result_status === "publicado").map((r) => r.id);
      if (!ids.length) throw new Error("Nenhum resultado publicado");
      const { error } = await supabase.from("competition_match_results").update({
        result_status: "resultado_validado",
        published_by: null,
        published_at: null,
      }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_match_results", matchId] }); toast.success("Publicação revertida para validado"); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // Collective score mutation
  const saveCollectiveScoreMut = useMutation({
    mutationFn: async ({ scores, notes }: { scores: ScoreEntry[]; notes: string }) => {
      const upserts = scores.map((s) => {
        const existing = matchScores.find((ms: any) => ms.match_entry_id === s.match_entry_id);
        return {
          ...(existing ? { id: existing.id } : {}),
          match_id: matchId!,
          match_entry_id: s.match_entry_id,
          score_final: s.score_final || null,
          score_detail: s.score_detail,
          outcome: s.outcome || null,
        };
      });
      const { error } = await supabase.from("match_scores" as any).upsert(upserts, { onConflict: "match_entry_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_scores", matchId] });
      toast.success("Placar salvo com sucesso");
      setCollectiveScoreOpen(false);
    },
    onError: (e: Error) => toast.error("Erro ao salvar placar: " + e.message),
  });

  const openResultDialog = () => {
    const form: Record<string, ResultFormEntry> = {};
    entries.forEach((entry) => {
      const existing = resultsMap.get(entry.id);
      form[entry.id] = {
        score: existing?.score ?? "",
        position: existing?.position?.toString() ?? "",
        result_text: existing?.result_text ?? "",
        outcome: (existing as any)?.outcome ?? "",
        time_ms: (existing as any)?.time_ms?.toString() ?? "",
        distance_cm: (existing as any)?.distance_cm?.toString() ?? "",
        points: (existing as any)?.points?.toString() ?? "",
        penalty_notes: (existing as any)?.penalty_notes ?? "",
      };
    });
    setResultForm(form);
    setResultNotes(results[0]?.notes ?? "");
    setResultDialogOpen(true);
  };

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada" };
    return m[s] || s;
  };
  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" =>
    s === "in_progress" ? "default" : s === "finished" ? "secondary" : s === "cancelled" ? "destructive" : "outline";

  if (isLoading) return <div className="space-y-4 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!match) return <div className="p-4 text-muted-foreground">Partida não encontrada.</div>;

  const formatDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "—";
  const hasResults = results.length > 0;
  const hasPendingValidation = results.some((r) => r.result_status === "resultado_lancado");
  const hasValidatedReady = results.some((r) => r.result_status === "resultado_validado");
  const hasPublished = results.some((r) => r.result_status === "publicado");
  const allValidated = hasResults && results.every((r) => r.result_status === "resultado_validado" || r.result_status === "publicado");
  const allPublished = hasResults && results.every((r) => r.result_status === "publicado");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {sportEvent?.name ?? "—"} — {phase?.name ?? "—"}
            {match.match_number ? ` #${match.match_number}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Detalhe da partida/prova</p>
        </div>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />Editar
          </Button>
        )}
      </div>

      {/* Match info + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Informações</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><span className="capitalize">{formatDate(match.match_date)}</span></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="font-mono">{match.start_time?.slice(0, 5) ?? "Horário não definido"}</span></div>
            {venue && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{venue.name}</span></div>}
            {match.notes && <p className="text-muted-foreground border-t pt-2">{match.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Status operacional</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={statusVariant(match.status)} className="text-sm">{statusLabel(match.status)}</Badge>
            {canWrite && (
              <div className="flex flex-wrap gap-2 pt-2">
                {STATUS_OPTIONS.filter((o) => o.value !== match.status).map((o) => (
                  <Button key={o.value} variant="outline" size="sm" disabled={updateStatusMut.isPending} onClick={() => updateStatusMut.mutate(o.value)}>{o.label}</Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Participants / Entries */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Participantes vinculados</CardTitle>
          {canWrite && (availableToAdd.length > 0 || availableTeamsToAdd.length > 0) && (
            <Button size="sm" onClick={() => setAddEntryOpen(true)}><Plus className="mr-2 h-4 w-4" />Vincular</Button>
          )}
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum participante vinculado a esta partida.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Lado</TableHead>
                    <TableHead>Seed</TableHead>
                    {canWrite && <TableHead className="w-[60px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{getEntryLabel(entry)}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.side}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.seed ?? "—"}</TableCell>
                      {canWrite && (
                         <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmRemoveEntryId(entry.id)} disabled={removeEntryMut.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collective Score Card */}
      {isCollective && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Placar coletivo</CardTitle>
            {canWrite && entries.length >= 2 && (
              <Button size="sm" variant="outline" onClick={() => setCollectiveScoreOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" />{matchScores.length > 0 ? "Editar placar" : "Lançar placar"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {matchScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum placar lançado ainda.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const ms = matchScores.find((s: any) => s.match_entry_id === entry.id);
                  if (!ms) return null;
                  const outcomeLabel = ms.outcome ? (OUTCOME_LABEL[ms.outcome] ?? ms.outcome) : null;
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium text-sm">{getEntryLabel(entry)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold font-mono">{ms.score_final ?? "—"}</span>
                        {outcomeLabel && <Badge variant="outline" className="text-xs">{outcomeLabel}</Badge>}
                        {ms.score_detail && (
                          <span className="text-xs text-muted-foreground">
                            ({Object.entries(ms.score_detail as Record<string, string>).map(([k, v]) => `${v}`).join(" / ")})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Collective Score Dialog */}
      {isCollective && (
        <Dialog open={collectiveScoreOpen} onOpenChange={setCollectiveScoreOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lançar placar</DialogTitle>
              <DialogDescription>Registre o placar de cada equipe nesta partida.</DialogDescription>
            </DialogHeader>
            <CollectiveScoreForm
              matchConfig={((sport as any)?.match_config ?? {}) as MatchConfig}
              entries={entries.map((e) => ({ id: e.id, label: getEntryLabel(e) }))}
              existingScores={matchScores}
              onSubmit={(scores, notes) => saveCollectiveScoreMut.mutate({ scores, notes })}
              isPending={saveCollectiveScoreMut.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Lineup Cards (collective only) */}
      {isCollective && entries.filter((e) => e.team_id).map((entry) => (
        <MatchLineupCard
          key={`lineup-${entry.id}`}
          matchId={matchId!}
          entry={entry}
          teamName={getEntryLabel(entry)}
          canWrite={canWrite}
          peopleMap={peopleMap}
          participantsMap={participantsMap}
        />
      ))}

      {/* Officials Card (collective only) */}
      {isCollective && (
        <MatchOfficialsCard
          matchId={matchId!}
          matchConfig={((sport as any)?.match_config ?? {}) as MatchConfig}
          canWrite={canWrite}
        />
      )}

      {/* Player Stats Card (collective only) */}
      {isCollective && (
        <MatchPlayerStatsCard
          matchId={matchId!}
          entries={entries.filter((e) => e.team_id).map((e) => ({ id: e.id, team_id: e.team_id, label: getEntryLabel(e) }))}
          matchConfig={((sport as any)?.match_config ?? {}) as MatchConfig}
          canWrite={canWrite}
        />
      )}

      {/* Results Card (individual / legacy) */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Resultado interno</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {canWrite && entries.length > 0 && (
              <Button size="sm" variant="outline" onClick={openResultDialog}>
                <ClipboardList className="mr-2 h-4 w-4" />{hasResults ? "Editar resultado" : "Lançar resultado"}
              </Button>
            )}
            {canWrite && hasPendingValidation && (
              <Button size="sm" onClick={() => setConfirmAction("validate")} disabled={validateResultsMut.isPending}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Validar
              </Button>
            )}
            {canWrite && hasValidatedReady && !allPublished && (
              <Button size="sm" variant="default" onClick={() => setConfirmAction("publish")} disabled={publishResultsMut.isPending}>
                Publicar oficialmente
              </Button>
            )}
            {canWrite && hasPublished && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmAction("unpublish")} disabled={unpublishResultsMut.isPending}>
                Despublicar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasResults ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum resultado lançado ainda.</p>
          ) : (
            <div className="space-y-3">
              {allPublished && <Badge variant="secondary" className="mb-2">✓ Publicado oficialmente</Badge>}
              {allValidated && !allPublished && <Badge variant="default" className="mb-2">✓ Resultado validado</Badge>}
              {hasPendingValidation && <Badge variant="outline" className="mb-2">Pendente de validação</Badge>}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participante</TableHead>
                      <TableHead>Desfecho</TableHead>
                      <TableHead>Placar</TableHead>
                      <TableHead>Pos.</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Distância</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const result = resultsMap.get(entry.id) as any;
                      if (!result) return null;
                      return (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium">{getEntryLabel(entry)}</TableCell>
                          <TableCell>{result.outcome ? (OUTCOME_LABEL[result.outcome] ?? result.outcome) : "—"}</TableCell>
                          <TableCell className="font-mono">{result.score ?? "—"}</TableCell>
                          <TableCell className="font-mono">{result.position ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{result.time_ms ? formatTimeMs(result.time_ms) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{result.distance_cm ? formatDistanceCm(result.distance_cm) : "—"}</TableCell>
                          <TableCell className="font-mono">{result.points != null ? Number(result.points).toString() : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={RESULT_STATUS_VARIANT[result.result_status] ?? "outline"}>
                              {RESULT_STATUS_LABEL[result.result_status] ?? result.result_status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {results[0]?.notes && <p className="text-sm text-muted-foreground mt-2">Obs: {results[0].notes}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result entry dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar resultado</DialogTitle>
            <DialogDescription>Preencha o resultado de cada participante nesta partida/prova.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {entries.map((entry) => {
              const form: ResultFormEntry = resultForm[entry.id] || emptyResultForm();
              const isTeamEntry = !!entry.team_id;
              const updateField = (field: keyof ResultFormEntry, value: string) =>
                setResultForm((prev) => ({ ...prev, [entry.id]: { ...form, [field]: value } }));
              return (
                <div key={entry.id} className="space-y-3 border rounded-lg p-3">
                  <p className="text-sm font-medium">{getEntryLabel(entry)}</p>
                  {/* Outcome */}
                  <div>
                    <label className="text-xs text-muted-foreground">Desfecho</label>
                    <Select value={form.outcome} onValueChange={(v) => updateField("outcome", v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {OUTCOME_OPTIONS.map((o) => (
                          <SelectItem key={o.value || "__none__"} value={o.value || "__none__"}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Collective: score */}
                  {(isTeamEntry || isCollective) && (
                    <div>
                      <label className="text-xs text-muted-foreground">Placar</label>
                      <Input placeholder="Ex: 3x1" value={form.score} onChange={(e) => updateField("score", e.target.value)} />
                    </div>
                  )}
                  {/* Individual fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Posição</label>
                      <Input type="number" placeholder="1" value={form.position} onChange={(e) => updateField("position", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Pontos</label>
                      <Input type="number" step="0.001" placeholder="0.000" value={form.points} onChange={(e) => updateField("points", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Tempo (ms)</label>
                      <Input type="number" placeholder="Milissegundos" value={form.time_ms} onChange={(e) => updateField("time_ms", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Distância (cm)</label>
                      <Input type="number" placeholder="Centímetros" value={form.distance_cm} onChange={(e) => updateField("distance_cm", e.target.value)} />
                    </div>
                  </div>
                  {/* Free text + penalty */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Resultado (texto)</label>
                      <Input placeholder="Texto livre" value={form.result_text} onChange={(e) => updateField("result_text", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Penalidades</label>
                      <Input placeholder="Notas de penalidade" value={form.penalty_notes} onChange={(e) => updateField("penalty_notes", e.target.value)} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div>
              <label className="text-sm font-medium text-foreground">Observações gerais</label>
              <Textarea placeholder="Observações sobre o resultado..." value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveResultsMut.mutate()} disabled={saveResultsMut.isPending}>
              {saveResultsMut.isPending ? "Salvando..." : "Salvar resultado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add entry dialog */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular à partida</DialogTitle>
            <DialogDescription>Selecione um participante individual ou uma equipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {availableTeamsToAdd.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Equipe</label>
                <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedPSEId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                  <SelectContent>
                    {availableTeamsToAdd.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {availableToAdd.length > 0 && availableTeamsToAdd.length > 0 && (
              <div className="text-center text-xs text-muted-foreground">— ou —</div>
            )}
            {availableToAdd.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Participante individual</label>
                <Select value={selectedPSEId} onValueChange={(v) => { setSelectedPSEId(v); setSelectedTeamId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o participante" /></SelectTrigger>
                  <SelectContent>
                    {availableToAdd.map((pse) => (
                      <SelectItem key={pse.id} value={pse.id}>{getPersonNameByParticipantId(pse.participant_id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancelar</Button>
            <Button
              disabled={(!selectedPSEId && !selectedTeamId) || addEntryMut.isPending}
              onClick={() => {
                if (selectedTeamId) addEntryMut.mutate({ teamId: selectedTeamId });
                else if (selectedPSEId) addEntryMut.mutate({ pseId: selectedPSEId });
              }}
            >
              {addEntryMut.isPending ? "Salvando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompetitionMatchFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        match={match}
        phases={allPhases}
        groups={allGroups}
        venues={allVenues}
        onSubmit={(v) => updateMatchMut.mutate(v)}
        isPending={updateMatchMut.isPending}
      />

      {/* Confirmation: remove participant */}
      <AlertDialog open={!!confirmRemoveEntryId} onOpenChange={(open) => { if (!open) setConfirmRemoveEntryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante</AlertDialogTitle>
            <AlertDialogDescription>
              O participante será desvinculado desta partida. Se já houver resultado lançado para ele, a remoção pode causar inconsistência. Esta ação não é facilmente reversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmRemoveEntryId) removeEntryMut.mutate(confirmRemoveEntryId); setConfirmRemoveEntryId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation: validate / publish / unpublish */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "validate" && "Validar resultados"}
              {confirmAction === "publish" && "Publicar resultados oficialmente"}
              {confirmAction === "unpublish" && "Despublicar resultados"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "validate" && "Os resultados lançados serão marcados como validados. Após validação, ainda será possível publicar ou editar."}
              {confirmAction === "publish" && "Os resultados serão publicados oficialmente. Após publicação, qualquer alteração exigirá despublicação prévia."}
              {confirmAction === "unpublish" && "A publicação oficial será revertida para status validado. Os dados de publicação (quem publicou e quando) serão removidos. Esta ação pode impactar informações já divulgadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmAction === "validate") validateResultsMut.mutate();
              if (confirmAction === "publish") publishResultsMut.mutate();
              if (confirmAction === "unpublish") unpublishResultsMut.mutate();
              setConfirmAction(null);
            }}>
              {confirmAction === "validate" && "Validar"}
              {confirmAction === "publish" && "Publicar"}
              {confirmAction === "unpublish" && "Despublicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
