import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAoVivoManifest } from "./useAoVivoManifest";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { LogOut, Radio, Eye, Info, X, Loader2, Calendar, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isFuture, parseISO, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PwaStatusBadge, type PwaStatusTone } from "@/components/pwa/PwaStatusBadge";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

const STATUS_MAP: Record<string, { label: string; tone: PwaStatusTone }> = {
  scheduled: { label: "Agendada", tone: "scheduled" },
  in_progress: { label: "AO VIVO", tone: "live" },
  finished: { label: "Finalizada", tone: "ok" },
  cancelled: { label: "Cancelada", tone: "danger" },
};

export default function AoVivoHomePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, loading: authLoading, hasRole } = useAuth();
  const { activeEvent } = useEventContext();
  const isAdmin = hasRole("admin") || hasRole("coordenacao_tecnica");
  useAoVivoManifest();

  const [showInstall, setShowInstall] = useState(() => !localStorage.getItem("aovivo_install_dismissed"));
  const dismissInstall = () => {
    localStorage.setItem("aovivo_install_dismissed", "1");
    setShowInstall(false);
  };

  // Protection is now handled by ProtectedRoute in App.tsx

  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ["aovivo_matches", user?.id, activeEvent?.id],
    queryFn: async () => {
      if (!user?.id || !activeEvent?.id) return [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("competition_matches")
          .select("id, match_date, start_time, status, venue_id, sport_event_id")
          .eq("event_id", activeEvent.id)
          .in("status", ["scheduled", "in_progress", "finished"])
          .order("match_date", { ascending: true, nullsFirst: false })
          .order("start_time", { ascending: true, nullsFirst: false })
          .limit(50);
        if (error) throw error;
        return (data ?? []).map((m: any) => ({ ...m, role_label: "Supervisão" }));
      }

      const { data: assignments, error: aErr } = await supabase
        .from("match_user_assignments" as any)
        .select("id, match_id, role, acceptance_status, reported_at, indisponibility_reason")
        .eq("user_id", user.id)
        .eq("event_id", activeEvent.id);
      if (aErr) throw aErr;
      if (!assignments?.length) return [];

      const matchIds = (assignments as any[]).map((a: any) => a.match_id);
      const roleMap = new Map((assignments as any[]).map((a: any) => [a.match_id, a.role]));
      const assignmentMap = new Map((assignments as any[]).map((a: any) => [a.match_id, a]));

      const { data: matchData, error: mErr } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, venue_id, sport_event_id")
        .in("id", matchIds)
        .order("match_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false });
      if (mErr) throw mErr;
      return (matchData ?? []).map((m: any) => {
        const ass = assignmentMap.get(m.id);
        return { 
          ...m, 
          role_label: roleMap.get(m.id) ?? "Mesário",
          assignment_id: ass?.id,
          acceptance_status: ass?.acceptance_status ?? 'pending',
          reported_at: ass?.reported_at,
          indisponibility_reason: ass?.indisponibility_reason
        };
      });
    },
    enabled: !!user?.id && !!activeEvent?.id,
    refetchInterval: 60000,
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ assignmentId, status, reason }: { assignmentId: string; status: string; reason?: string }) => {
      const { error } = await supabase
        .from("match_user_assignments" as any)
        .update({ 
          acceptance_status: status,
          reported_at: status === 'unavailable' ? new Date().toISOString() : null,
          indisponibility_reason: reason || null
        } as any)
        .eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    }
  });

  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");

  const sportEventIds = [...new Set(matches.map((m: any) => m.sport_event_id).filter(Boolean))];
  const venueIds = [...new Set(matches.map((m: any) => m.venue_id).filter(Boolean))];

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["aovivo_sport_events", sportEventIds.join(",")],
    queryFn: async () => {
      if (!sportEventIds.length) return [];
      const { data } = await supabase.from("sport_events").select("id, sport_id, category_id").in("id", sportEventIds);
      return data ?? [];
    },
    enabled: sportEventIds.length > 0,
  });

  const sportIds = [...new Set(sportEvents.map((se: any) => se.sport_id))];
  const catIds = [...new Set(sportEvents.map((se: any) => se.category_id))];

  const { data: sports = [] } = useQuery({
    queryKey: ["aovivo_sports", sportIds.join(",")],
    queryFn: async () => {
      if (!sportIds.length) return [];
      const { data } = await supabase.from("sports").select("id, name").in("id", sportIds);
      return data ?? [];
    },
    enabled: sportIds.length > 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["aovivo_categories", catIds.join(",")],
    queryFn: async () => {
      if (!catIds.length) return [];
      const { data } = await supabase.from("categories").select("id, name").in("id", catIds);
      return data ?? [];
    },
    enabled: catIds.length > 0,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["aovivo_venues", venueIds.join(",")],
    queryFn: async () => {
      if (!venueIds.length) return [];
      const { data } = await supabase.from("venues").select("id, name").in("id", venueIds);
      return data ?? [];
    },
    enabled: venueIds.length > 0,
  });

  const sportsMap = new Map(sports.map((s: any) => [s.id, s.name]));
  const catsMap = new Map(categories.map((c: any) => [c.id, c.name]));
  const venuesMap = new Map(venues.map((v: any) => [v.id, v.name]));
  const seMap = new Map(sportEvents.map((se: any) => [se.id, se]));

  const getMatchLabel = (m: any) => {
    const se = seMap.get(m.sport_event_id);
    if (!se) return "Partida";
    const sport = sportsMap.get(se.sport_id) ?? "";
    const cat = catsMap.get(se.category_id) ?? "";
    return `${sport} — ${cat}`;
  };

  const sorted = [...matches].sort((a: any, b: any) => {
    const da = a.match_date ? parseISO(a.match_date) : null;
    const db = b.match_date ? parseISO(b.match_date) : null;
    const aToday = da && isToday(da) ? 0 : da && isFuture(da) ? 1 : 2;
    const bToday = db && isToday(db) ? 0 : db && isFuture(db) ? 1 : 2;
    if (aToday !== bToday) return aToday - bToday;
    if (!da || !db) return 0;
    return da.getTime() - db.getTime();
  });

  if (authLoading) {
    return (
      <div className="op-screen flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-module" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="op-screen flex min-h-[100dvh] flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--module-accent) / 0.85), transparent)" }} />
        <div className="relative flex h-14 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-module-soft text-module">
              <Radio className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold tracking-tight">JER Ao Vivo</p>
              <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">{profile?.full_name ?? user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PwaRefreshButton />
            <button onClick={signOut} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {showInstall && (
        <div className="op-card mx-4 mt-3 flex items-start gap-3 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-module" />
          <div className="flex-1 space-y-1 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Instalar como app</p>
            <p><strong className="text-foreground/90">Android:</strong> ⋮ → Adicionar à tela inicial</p>
            <p><strong className="text-foreground/90">iPhone:</strong> □↑ → Adicionar à tela de início</p>
          </div>
          <button onClick={dismissInstall} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full rounded-2xl bg-muted/30" />
            <Skeleton className="h-24 w-full rounded-2xl bg-muted/30" />
            <Skeleton className="h-24 w-full rounded-2xl bg-muted/30" />
          </>
        ) : sorted.length === 0 ? (
          <div className="op-card flex flex-col items-center justify-center py-16 text-center">
            <Radio className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-semibold text-foreground">Nenhuma partida designada</p>
            <p className="mt-1 text-xs text-muted-foreground">Entre em contato com o coordenador.</p>
          </div>
        ) : (
          sorted.map((m: any) => {
            const status = STATUS_MAP[m.status] ?? STATUS_MAP.scheduled;
            const venue = m.venue_id ? venuesMap.get(m.venue_id) : null;
            const dateStr = m.match_date ? format(parseISO(m.match_date), "dd/MM (EEE)", { locale: ptBR }) : "Sem data";
            const timeStr = m.start_time?.slice(0, 5) ?? "";
            const canEnter = m.status === "scheduled" || m.status === "in_progress";

            return (
              <div key={m.id} className="op-card space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight text-foreground">{getMatchLabel(m)}</p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {dateStr} {timeStr && `• ${timeStr}`}
                      </div>
                      {venue && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {venue}
                        </div>
                      )}
                    </div>
                  </div>
                  <PwaStatusBadge tone={status.tone} pulse={status.tone === "live"}>
                    {status.label}
                  </PwaStatusBadge>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{m.role_label}</span>
                  
                  {m.acceptance_status === 'confirmed' ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-bold">Agenda confirmada</span>
                    </div>
                  ) : m.acceptance_status === 'unavailable' ? (
                    <div className="flex items-center gap-1.5 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-bold">Indisponível</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatusMut.mutate({ assignmentId: m.assignment_id, status: 'confirmed' })}
                        disabled={updateStatusMut.isPending}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-100 px-3 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-200"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmar
                      </button>
                      <button
                        onClick={() => setReportingId(m.assignment_id)}
                        disabled={updateStatusMut.isPending}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-[11px] font-bold text-destructive transition-colors hover:bg-destructive/20"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Recusar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-1">
                  {canEnter ? (
                    <button
                      onClick={() => navigate(`/aovivo/partida/${m.id}`)}
                      className="op-btn-primary !h-10 !w-full !rounded-xl px-5 !text-sm"
                    >
                      <Radio className="h-4 w-4" />
                      Entrar ao vivo
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/aovivo/partida/${m.id}`)}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-muted/40 px-5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <Eye className="h-4 w-4" />
                      Ver resumo
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Indisponibility Dialog */}
      {reportingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="op-card w-full max-w-sm space-y-4 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">Reportar Indisponibilidade</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Informe o motivo para que a coordenação possa providenciar sua substituição.
            </p>
            <textarea
              className="flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Ex: Problemas de saúde, emergência familiar..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setReportingId(null); setReportReason(""); }}
                className="flex-1 h-11 rounded-xl bg-muted/40 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted/60"
              >
                Cancelar
              </button>
              <button
                disabled={!reportReason.trim() || updateStatusMut.isPending}
                onClick={() => {
                  updateStatusMut.mutate({ assignmentId: reportingId, status: 'unavailable', reason: reportReason });
                  setReportingId(null);
                  setReportReason("");
                }}
                className="flex-1 h-11 rounded-xl bg-destructive text-sm font-bold text-white shadow-lg shadow-destructive/20 transition-all active:scale-95 disabled:opacity-50"
              >
                Reportar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
