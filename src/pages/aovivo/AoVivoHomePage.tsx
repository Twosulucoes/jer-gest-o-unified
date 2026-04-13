import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEvent } from "@/contexts/EventContext";
import { LogOut, RefreshCw, Radio, Eye, Info, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isFuture, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Agendada", color: "bg-blue-600" },
  in_progress: { label: "Em andamento", color: "bg-emerald-600" },
  finished: { label: "Finalizada", color: "bg-slate-600" },
  cancelled: { label: "Cancelada", color: "bg-red-600" },
};

export default function AoVivoHomePage() {
  const navigate = useNavigate();
  const { user, profile, signOut, loading: authLoading, hasRole } = useAuth();
  const { activeEvent } = useEvent();
  const isAdmin = hasRole("admin") || hasRole("coordenacao_tecnica");

  // Install banner
  const [showInstall, setShowInstall] = useState(() => {
    return !localStorage.getItem("aovivo_install_dismissed");
  });
  const dismissInstall = () => {
    localStorage.setItem("aovivo_install_dismissed", "1");
    setShowInstall(false);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/aovivo/login");
    }
  }, [authLoading, user, navigate]);

  // Fetch assigned matches
  const { data: matches = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["aovivo_matches", user?.id, activeEvent?.id],
    queryFn: async () => {
      if (!user?.id || !activeEvent?.id) return [];

      // If admin, fetch all matches for the event
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

      // Regular users: fetch via match_user_assignments
      const { data: assignments, error: aErr } = await supabase
        .from("match_user_assignments" as any)
        .select("match_id, role")
        .eq("user_id", user.id)
        .eq("event_id", activeEvent.id);
      if (aErr) throw aErr;
      if (!assignments?.length) return [];

      const matchIds = (assignments as any[]).map((a: any) => a.match_id);
      const roleMap = new Map((assignments as any[]).map((a: any) => [a.match_id, a.role]));

      const { data: matchData, error: mErr } = await supabase
        .from("competition_matches")
        .select("id, match_date, start_time, status, venue_id, sport_event_id")
        .in("id", matchIds)
        .order("match_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false });
      if (mErr) throw mErr;
      return (matchData ?? []).map((m: any) => ({
        ...m,
        role_label: roleMap.get(m.id) ?? "Mesário",
      }));
    },
    enabled: !!user?.id && !!activeEvent?.id,
    refetchInterval: 60000,
  });

  // Fetch sport events, sports, categories, venues for labels
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

  // Sort: today first, then future, then past
  const sorted = [...matches].sort((a: any, b: any) => {
    const da = a.match_date ? parseISO(a.match_date) : null;
    const db = b.match_date ? parseISO(b.match_date) : null;
    const aToday = da && isToday(da) ? 0 : da && isFuture(da) ? 1 : 2;
    const bToday = db && isToday(db) ? 0 : db && isFuture(db) ? 1 : 2;
    if (aToday !== bToday) return aToday - bToday;
    if (!da || !db) return 0;
    return da.getTime() - db.getTime();
  });

  // Pull-to-refresh via touchmove
  const [pulling, setPulling] = useState(false);
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
        <Loader2Icon />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/aovivo/icon-192.png" alt="JER" className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-sm font-bold tracking-tight">JER Ao Vivo</h1>
            <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{profile?.full_name ?? user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={signOut}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Install banner */}
      {showInstall && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-slate-800 border border-slate-700 flex items-start gap-3">
          <Info className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs text-slate-300 space-y-1">
            <p className="font-medium text-white">Instalar como app</p>
            <p><strong>Android:</strong> Toque em ⋮ → Adicionar à tela inicial</p>
            <p><strong>iPhone:</strong> Toque em □↑ → Adicionar à tela de início</p>
          </div>
          <button onClick={dismissInstall} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-24 w-full bg-slate-800 rounded-xl" />
            <Skeleton className="h-24 w-full bg-slate-800 rounded-xl" />
            <Skeleton className="h-24 w-full bg-slate-800 rounded-xl" />
          </>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Radio className="h-12 w-12 text-slate-600 mb-4" />
            <p className="text-slate-400 text-sm">Nenhuma partida designada para você.</p>
            <p className="text-slate-500 text-xs mt-1">Entre em contato com o coordenador.</p>
          </div>
        ) : (
          sorted.map((m: any) => {
            const status = STATUS_MAP[m.status] ?? STATUS_MAP.scheduled;
            const venue = m.venue_id ? venuesMap.get(m.venue_id) : null;
            const dateStr = m.match_date
              ? format(parseISO(m.match_date), "dd/MM (EEE)", { locale: ptBR })
              : "Sem data";
            const timeStr = m.start_time?.slice(0, 5) ?? "";
            const canEnter = m.status === "scheduled" || m.status === "in_progress";

            return (
              <div
                key={m.id}
                className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm leading-tight">{getMatchLabel(m)}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {dateStr} {timeStr && `• ${timeStr}`} {venue && `• ${venue}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full text-white ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{m.role_label}</span>
                  {canEnter ? (
                    <button
                      onClick={() => navigate(`/aovivo/partida/${m.id}`)}
                      className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
                    >
                      <Radio className="h-4 w-4" />
                      Entrar ao vivo
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/aovivo/partida/${m.id}`)}
                      className="h-10 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium flex items-center gap-2 transition-colors"
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
    </div>
  );
}

function Loader2Icon() {
  return (
    <svg className="h-6 w-6 animate-spin text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
