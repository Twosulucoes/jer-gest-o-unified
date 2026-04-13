import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wifi, WifiOff, Undo2, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { MatchConfig, EventTypeConfig } from "./MatchConfigEditor";

interface Entry {
  id: string;
  team_id: string | null;
  label: string;
}

interface Lineup {
  id: string;
  match_entry_id: string;
  participant_id: string;
  jersey_number: number | null;
  status: string;
}

interface Props {
  matchId: string;
  entries: Entry[];
  matchConfig: MatchConfig;
  lineups: Lineup[];
  getPlayerName: (participantId: string) => string;
  onClose: () => void;
}

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

export default function MatchLiveMode({ matchId, entries, matchConfig, lineups, getPlayerName, onClose }: Props) {
  const qc = useQueryClient();
  const eventTypes: EventTypeConfig[] = (matchConfig.event_types ?? []).filter((e) => e.key && e.label && e.visible !== false);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentPeriod, setCurrentPeriod] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Player selection modal
  const [selectingEvent, setSelectingEvent] = useState<{ entryId: string; eventKey: string } | null>(null);

  // Local events (for offline support)
  const [localEvents, setLocalEvents] = useState<PendingEvent[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY + matchId);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // Persist local events
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + matchId, JSON.stringify(localEvents));
  }, [localEvents, matchId]);

  // Timer
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

  // Sync pending events
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
      qc.invalidateQueries({ queryKey: ["match_events", matchId] });
      if (count > 0) toast.success(`${count} evento(s) sincronizado(s)`);
    },
    onError: (e: Error) => toast.error("Erro ao sincronizar: " + e.message),
  });

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && localEvents.some((e) => !e.synced)) {
      syncMut.mutate();
    }
  }, [isOnline]);

  // Compute live score from local events
  const goalKeys = eventTypes.filter((e) => e.key === "goal" || e.key === "point" || e.key === "basket" || e.label.toLowerCase().includes("gol") || e.label.toLowerCase().includes("ponto") || e.label.toLowerCase().includes("cesta")).map((e) => e.key);

  const getScore = (entryId: string) => {
    return localEvents.filter((e) => e.match_entry_id === entryId && goalKeys.includes(e.event_key)).length;
  };

  const addEvent = useCallback((entryId: string, eventKey: string, lineupId?: string, participantId?: string) => {
    const minute = Math.floor(timerSeconds / 60);
    const evt: PendingEvent = {
      id: crypto.randomUUID(),
      match_id: matchId,
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

    // Try immediate sync if online
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
        // Delete from DB too
        supabase.from("match_events" as any).delete().eq("id", last.id).then(() => {
          qc.invalidateQueries({ queryKey: ["match_events", matchId] });
        });
      }
      return prev.slice(0, -1);
    });
  }, [matchId, qc]);

  const pendingCount = localEvents.filter((e) => !e.synced).length;

  // Primary event types for quick buttons (scoring events first)
  const primaryEvents = eventTypes.filter((e) => e.target === "team" || e.target === "player");

  // Entries for sides A and B
  const sideA = entries[0];
  const sideB = entries[1];

  const entryLineups = (entryId: string) => lineups.filter((l) => l.match_entry_id === entryId);

  const handleEventClick = (entryId: string, eventKey: string) => {
    const evtType = eventTypes.find((e) => e.key === eventKey);
    if (evtType?.target === "player") {
      setSelectingEvent({ entryId, eventKey });
    } else {
      addEvent(entryId, eventKey);
    }
  };

  return (
    <div className="space-y-4">
      {/* Online Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Badge variant="outline" className="text-xs gap-1"><Wifi className="h-3 w-3" />Online ✅</Badge>
          ) : (
            <Badge variant="destructive" className="text-xs gap-1"><WifiOff className="h-3 w-3" />Offline 🔴</Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-xs">{pendingCount} pendente(s)</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>Sair do modo ao vivo</Button>
      </div>

      {/* Scoreboard */}
      {sideA && sideB && (
        <Card className="bg-secondary/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center flex-1">
                <p className="text-sm font-medium truncate">{sideA.label}</p>
                <p className="text-5xl font-bold font-mono tabular-nums">{getScore(sideA.id)}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">×</p>
                <div className="mt-1">
                  <Badge variant="outline">{matchConfig.period_label ?? "Período"} {currentPeriod}</Badge>
                </div>
              </div>
              <div className="text-center flex-1">
                <p className="text-sm font-medium truncate">{sideB.label}</p>
                <p className="text-5xl font-bold font-mono tabular-nums">{getScore(sideB.id)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timer */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-3xl font-mono font-bold tabular-nums">{formatTimer(timerSeconds)}</span>
        <Button size="icon" variant={timerRunning ? "destructive" : "default"} className="h-10 w-10" onClick={() => setTimerRunning(!timerRunning)}>
          {timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => { setTimerSeconds(0); setTimerRunning(false); }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setCurrentPeriod((p) => p + 1); setTimerSeconds(0); setTimerRunning(false); }}>
          Próx. {matchConfig.period_label ?? "período"}
        </Button>
      </div>

      {/* Event Buttons - 2 columns */}
      {sideA && sideB && (
        <div className="grid grid-cols-2 gap-3">
          {/* Side A */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-center text-primary">{sideA.label}</p>
            {primaryEvents.map((evt) => (
              <Button
                key={`a-${evt.key}`}
                variant="outline"
                className="w-full min-h-[48px] text-sm font-medium border-primary/30 hover:bg-primary/10"
                onClick={() => handleEventClick(sideA.id, evt.key)}
              >
                {evt.label}
              </Button>
            ))}
          </div>
          {/* Side B */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-center text-destructive">{sideB.label}</p>
            {primaryEvents.map((evt) => (
              <Button
                key={`b-${evt.key}`}
                variant="outline"
                className="w-full min-h-[48px] text-sm font-medium border-destructive/30 hover:bg-destructive/10"
                onClick={() => handleEventClick(sideB.id, evt.key)}
              >
                {evt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Undo */}
      <div className="flex justify-center">
        <Button size="sm" variant="ghost" onClick={undoLast} disabled={localEvents.length === 0}>
          <Undo2 className="h-3.5 w-3.5 mr-1" />Desfazer último
        </Button>
      </div>

      {/* Event History */}
      {localEvents.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-semibold mb-2">Histórico ({localEvents.length})</p>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {[...localEvents].reverse().map((evt) => {
                const entryLabel = entries.find((e) => e.id === evt.match_entry_id)?.label ?? "—";
                const evtLabel = eventTypes.find((e) => e.key === evt.event_key)?.label ?? evt.event_key;
                return (
                  <div key={evt.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[9px]">{evtLabel}</Badge>
                      <span className="font-medium">{entryLabel}</span>
                      {evt.participant_id && <span className="text-muted-foreground">— {getPlayerName(evt.participant_id)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-muted-foreground">{evt.minute}'</span>
                      {!evt.synced && <span className="text-[9px] text-warning">⏳</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Selection Modal */}
      <Dialog open={!!selectingEvent} onOpenChange={(open) => { if (!open) setSelectingEvent(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar atleta</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {selectingEvent && entryLineups(selectingEvent.entryId).map((l) => (
              <Button
                key={l.id}
                variant="outline"
                className="w-full min-h-[48px] justify-start text-sm"
                onClick={() => addEvent(selectingEvent.entryId, selectingEvent.eventKey, l.id, l.participant_id)}
              >
                {l.jersey_number != null && <span className="font-mono font-bold mr-2">#{l.jersey_number}</span>}
                {getPlayerName(l.participant_id)}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectingEvent(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual sync button */}
      {pendingCount > 0 && isOnline && (
        <div className="flex justify-center">
          <Button size="sm" variant="secondary" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            {syncMut.isPending ? "Sincronizando..." : `Sincronizar ${pendingCount} evento(s)`}
          </Button>
        </div>
      )}
    </div>
  );
}
