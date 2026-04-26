import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Wifi, WifiOff, Undo2, Play, Pause, RotateCcw, Lock, AlertTriangle } from "lucide-react";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";
import type { MatchConfig, EventTypeConfig } from "@/components/admin/MatchConfigEditor";

interface PendingEvent {
  id: string;
  match_id: string;
  match_entry_id: string | null;
  match_lineup_id: string | null;
  participant_id: string | null;
  event_key: string;
  minute: number | null;
  period: number | null;
  notes: string | null;
  synced: boolean;
}

const STORAGE_KEY = "match_live_events_";

export default function AoVivoMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading, hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("coordenacao_tecnica");

  // Access check
  const { data: accessCheck, isLoading: accessLoading } = useQuery({
    queryKey: ["aovivo_access", matchId, user?.id],
    queryFn: async () => {
      if (!matchId || !user?.id) return { allowed: false };
      if (isAdmin) return { allowed: true };
      const { data } = await supabase
        .from("match_user_assignments" as any)
        .select("id")
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .limit(1);
      return { allowed: (data as any[])?.length > 0 };
    },
    enabled: !!matchId && !!user?.id,
  });

  // Match data
  const { data: match } = useQuery({
    queryKey: ["aovivo_match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("competition_matches").select("*").eq("id", matchId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!matchId && accessCheck?.allowed,
  });

  const { data: phase } = useQuery({
    queryKey: ["aovivo_phase", match?.phase_id],
    queryFn: async () => {
      const { data } = await supabase.from("competition_phases").select("sport_event_id").eq("id", match!.phase_id).single();
      return data;
    },
    enabled: !!match?.phase_id,
  });

  const { data: sportEvent } = useQuery({
    queryKey: ["aovivo_se", phase?.sport_event_id],
    queryFn: async () => {
      const { data } = await supabase.from("sport_events").select("sport_id, category_id").eq("id", phase!.sport_event_id).single();
      return data;
    },
    enabled: !!phase?.sport_event_id,
  });

  const { data: sport } = useQuery({
    queryKey: ["aovivo_sport", sportEvent?.sport_id],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("name, match_config").eq("id", sportEvent!.sport_id).single();
      return data;
    },
    enabled: !!sportEvent?.sport_id,
  });

  const matchConfig: MatchConfig = (sport?.match_config as any) ?? {};
  const eventTypes: EventTypeConfig[] = (matchConfig.event_types ?? []).filter((e) => e.key && e.label && e.visible !== false);

  // Entries
  const { data: entries = [] } = useQuery({
    queryKey: ["aovivo_entries", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("competition_match_entries").select("id, team_id, side, participant_sport_event_id").eq("match_id", matchId!).order("side");
      return data ?? [];
    },
    enabled: !!matchId && accessCheck?.allowed,
  });

  const teamIds = entries.map((e: any) => e.team_id).filter(Boolean);
  const { data: teams = [] } = useQuery({
    queryKey: ["aovivo_teams", teamIds.join(",")],
    queryFn: async () => {
      if (!teamIds.length) return [];
      const { data } = await supabase.from("teams").select("id, name").in("id", teamIds);
      return data ?? [];
    },
    enabled: teamIds.length > 0,
  });
  const teamsMap = new Map(teams.map((t: any) => [t.id, t.name]));

  const entryList = entries.map((e: any) => ({
    id: e.id,
    team_id: e.team_id,
    label: e.team_id ? (teamsMap.get(e.team_id) ?? "Equipe") : `Lado ${e.side}`,
  }));

  // Lineups
  const { data: lineups = [] } = useQuery({
    queryKey: ["aovivo_lineups", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("match_lineups").select("id, match_entry_id, participant_id, jersey_number, status").eq("match_id", matchId!).in("status", ["active", "bench"]);
      return data ?? [];
    },
    enabled: !!matchId && accessCheck?.allowed,
  });

  const participantIds = [...new Set(lineups.map((l: any) => l.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["aovivo_participants", participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data } = await supabase.from("participants").select("id, person_id").in("id", participantIds);
      return data ?? [];
    },
    enabled: participantIds.length > 0,
  });
  const personIds = [...new Set(participants.map((p: any) => p.person_id))];
  const { data: people = [] } = useQuery({
    queryKey: ["aovivo_people", personIds.length],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data } = await supabase.from("people").select("id, full_name").in("id", personIds);
      return data ?? [];
    },
    enabled: personIds.length > 0,
  });
  const participantMap = new Map(participants.map((p: any) => [p.id, p]));
  const peopleMap = new Map(people.map((p: any) => [p.id, p]));
  const getPlayerName = (pid: string) => {
    const p = participantMap.get(pid);
    if (!p) return "—";
    return peopleMap.get(p.person_id)?.full_name ?? "—";
  };

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Local events
  const [localEvents, setLocalEvents] = useState<PendingEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + matchId);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + matchId, JSON.stringify(localEvents));
  }, [localEvents, matchId]);

  // Player selection modal
  const [selectingEvent, setSelectingEvent] = useState<{ entryId: string; eventKey: string } | null>(null);

  // Compute score
  const goalKeys = eventTypes.filter((e) => e.key === "goal" || e.key === "point" || e.key === "basket" || e.label.toLowerCase().includes("gol") || e.label.toLowerCase().includes("ponto") || e.label.toLowerCase().includes("cesta")).map((e) => e.key);
  const getScore = (entryId: string) => localEvents.filter((e) => e.match_entry_id === entryId && goalKeys.includes(e.event_key)).length;

  const addEvent = useCallback((entryId: string, eventKey: string, lineupId?: string, participantId?: string) => {
    const minute = Math.floor(timerSeconds / 60);
    const evt: PendingEvent = {
      id: crypto.randomUUID(),
      match_id: matchId!,
      match_entry_id: entryId,
      match_lineup_id: lineupId || null,
      participant_id: participantId || null,
      event_key: eventKey,
      minute,
      period: currentPeriod,
      notes: null,
      synced: false,
    };
    setLocalEvents((prev) => [...prev, evt]);
    setSelectingEvent(null);

    if (isOnline) {
      const { id: _localId, synced: _s, ...payload } = evt;
      supabase.from("match_events" as any).insert(payload).then(({ error }) => {
        if (!error) {
          setLocalEvents((prev) => prev.map((e) => e.id === evt.id ? { ...e, synced: true } : e));
          qc.invalidateQueries({ queryKey: ["match_events", matchId] });
        }
      });
    }
  }, [matchId, timerSeconds, currentPeriod, isOnline, qc]);

  const undoLast = useCallback(() => {
    setLocalEvents((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.synced) {
        supabase.from("match_events" as any).delete().eq("id", last.id);
      }
      return prev.slice(0, -1);
    });
  }, []);

  // Sync
  const syncMut = useMutation({
    mutationFn: async () => {
      const pending = localEvents.filter((e) => !e.synced);
      for (const evt of pending) {
        const { id: _localId, synced: _s, ...payload } = evt;
        const { error } = await supabase.from("match_events" as any).insert(payload);
        if (error) throw error;
      }
      return pending.length;
    },
    onSuccess: (count) => {
      setLocalEvents((prev) => prev.map((e) => ({ ...e, synced: true })));
      if (count > 0) toast.success(`${count} evento(s) sincronizado(s)`);
    },
    onError: (e: Error) => toast.error("Erro ao sincronizar: " + e.message),
  });

  // Auto-sync when coming back online
  const syncMutRef = useRef(syncMut);
  syncMutRef.current = syncMut;
  const localEventsRef = useRef(localEvents);
  localEventsRef.current = localEvents;

  useEffect(() => {
    if (isOnline && localEventsRef.current.some((e) => !e.synced)) {
      syncMutRef.current.mutate();
    }
  }, [isOnline]);

  // Confirm before leaving
  const [confirmLeave, setConfirmLeave] = useState(false);
  const pendingCount = localEvents.filter((e) => !e.synced).length;

  const handleBack = () => {
    if (pendingCount > 0) {
      setConfirmLeave(true);
    } else {
      navigate("/aovivo");
    }
  };

  const primaryEvents = eventTypes.filter((e) => e.target === "team" || e.target === "player");
  const sideA = entryList[0];
  const sideB = entryList[1];
  const getEntryLineups = (entryId: string) => lineups.filter((l: any) => l.match_entry_id === entryId);

  const handleEventClick = (entryId: string, eventKey: string) => {
    const evtType = eventTypes.find((e) => e.key === eventKey);
    if (evtType?.target === "player") {
      setSelectingEvent({ entryId, eventKey });
    } else {
      addEvent(entryId, eventKey);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/aovivo/login");
  }, [authLoading, user, navigate]);

  if (authLoading || accessLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!accessCheck?.allowed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 text-white px-6 text-center">
        <Lock className="h-16 w-16 text-slate-600 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Acesso negado</h2>
        <p className="text-sm text-slate-400 mb-6">Você não está designado para esta partida.</p>
        <button onClick={() => navigate("/aovivo")} className="h-10 px-6 rounded-lg bg-slate-800 text-sm text-white font-medium">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-950 text-white">
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs font-medium px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Sem conexão — eventos salvos localmente
          {pendingCount > 0 && <span className="ml-auto">{pendingCount} pendente(s)</span>}
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-3 h-12 border-b border-slate-800 shrink-0">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Wifi className="h-3 w-3" />Online</span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-400"><WifiOff className="h-3 w-3" />Offline</span>
          )}
          <PwaRefreshButton />
        </div>
      </header>

      {/* Timer + Period */}
      <div className="flex items-center justify-center gap-3 py-3 border-b border-slate-800 bg-slate-900/60">
        <span className="text-3xl font-mono font-bold tabular-nums">{formatTimer(timerSeconds)}</span>
        <button
          onClick={() => setTimerRunning(!timerRunning)}
          className={`h-10 w-10 rounded-full flex items-center justify-center ${timerRunning ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => { setTimerSeconds(0); setTimerRunning(false); }}
          className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-800"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setCurrentPeriod((p) => p + 1); setTimerSeconds(0); setTimerRunning(false); }}
          className="h-8 px-3 rounded-lg bg-slate-800 text-xs font-medium"
        >
          {matchConfig.period_label ?? "Período"} {currentPeriod} →
        </button>
      </div>

      {/* Scoreboard */}
      {sideA && sideB && (
        <div className="flex items-center justify-center gap-4 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="text-center flex-1">
            <p className="text-xs font-medium text-emerald-400 truncate px-2">{sideA.label}</p>
            <p className="text-5xl font-bold font-mono tabular-nums mt-1">{getScore(sideA.id)}</p>
          </div>
          <span className="text-2xl font-bold text-slate-600">×</span>
          <div className="text-center flex-1">
            <p className="text-xs font-medium text-blue-400 truncate px-2">{sideB.label}</p>
            <p className="text-5xl font-bold font-mono tabular-nums mt-1">{getScore(sideB.id)}</p>
          </div>
        </div>
      )}

      {/* Event buttons grid */}
      {sideA && sideB && (
        <div className="grid grid-cols-2 gap-2 px-3 py-3">
          <div className="space-y-2">
            {primaryEvents.map((evt) => (
              <button
                key={`a-${evt.key}`}
                onClick={() => handleEventClick(sideA.id, evt.key)}
                className="w-full min-h-[64px] rounded-xl bg-emerald-900/40 border border-emerald-700/50 text-emerald-200 text-sm font-semibold active:bg-emerald-800 transition-colors shadow-[0_8px_18px_-12px_rgba(16,185,129,0.55)]"
              >
                {evt.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {primaryEvents.map((evt) => (
              <button
                key={`b-${evt.key}`}
                onClick={() => handleEventClick(sideB.id, evt.key)}
                className="w-full min-h-[64px] rounded-xl bg-blue-900/40 border border-blue-700/50 text-blue-200 text-sm font-semibold active:bg-blue-800 transition-colors shadow-[0_8px_18px_-12px_rgba(59,130,246,0.55)]"
              >
                {evt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto px-3 pb-16">
        {localEvents.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Histórico ({localEvents.length})</p>
            {[...localEvents].reverse().map((evt) => {
              const entryLabel = entryList.find((e) => e.id === evt.match_entry_id)?.label ?? "—";
              const evtLabel = eventTypes.find((e) => e.key === evt.event_key)?.label ?? evt.event_key;
              return (
                <div key={evt.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-medium shrink-0">{evtLabel}</span>
                    <span className="text-slate-300 truncate">{entryLabel}</span>
                    {evt.participant_id && <span className="text-slate-500 truncate">— {getPlayerName(evt.participant_id)}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-slate-500">{evt.minute}'</span>
                    {!evt.synced && <span className="text-[9px] text-amber-400">⏳</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 px-3 py-2 flex items-center justify-between">
        <button
          onClick={undoLast}
          disabled={localEvents.length === 0}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />Desfazer
        </button>
        {pendingCount > 0 && isOnline && (
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="h-8 px-4 rounded-lg bg-emerald-600 text-xs font-medium"
          >
            {syncMut.isPending ? "Sincronizando..." : `Sincronizar ${pendingCount}`}
          </button>
        )}
      </div>

      {/* Player selection modal */}
      {selectingEvent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full bg-slate-900 rounded-t-2xl max-h-[70dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold">Selecionar atleta</h3>
              <button onClick={() => setSelectingEvent(null)} className="text-sm text-slate-400">Cancelar</button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1.5">
              {getEntryLineups(selectingEvent.entryId).map((l: any) => (
                <button
                  key={l.id}
                  onClick={() => addEvent(selectingEvent.entryId, selectingEvent.eventKey, l.id, l.participant_id)}
                  className="w-full min-h-[48px] rounded-xl bg-slate-800 border border-slate-700 px-4 text-left text-sm flex items-center gap-3 active:bg-slate-700"
                >
                  {l.jersey_number != null && <span className="font-mono font-bold text-emerald-400">#{l.jersey_number}</span>}
                  <span>{getPlayerName(l.participant_id)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm leave modal */}
      {confirmLeave && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold">Sair da partida ao vivo?</h3>
            <p className="text-sm text-slate-400">Eventos não sincronizados podem ser perdidos.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmLeave(false)} className="flex-1 h-10 rounded-lg bg-slate-800 text-sm font-medium">
                Ficar
              </button>
              <button onClick={() => navigate("/aovivo")} className="flex-1 h-10 rounded-lg bg-red-600 text-sm font-medium">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
