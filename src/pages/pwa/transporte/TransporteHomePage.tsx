import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bus, Clock, MapPin, Users, Play, ArrowRight,
  Search, Unlock, AlertTriangle, QrCode,
} from "lucide-react";
import { format } from "date-fns";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { PwaContainer, PwaBottomBar } from "@/components/pwa/PwaScreen";
import { PwaStatTriplet } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaStatusBadge } from "@/components/pwa/PwaStatusBadge";
import { useEventContext } from "@/contexts/EventContext";

interface TripRow {
  id: string;
  scheduled_at: string | null;
  trip_status: string;
  status: string;
  assigned_driver_id: string | null;
  driver_checked_in_at: string | null;
  driver_name: string | null;
  transport_routes: { name: string; origin: string | null; destination: string | null } | null;
  transport_vehicles: { label: string; plate: string } | null;
  transport_passengers: { id: string; status: string }[];
}

export default function TransporteHomePage() {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content") || "";
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
    return () => {
      if (meta) meta.setAttribute("content", original || "width=device-width, initial-scale=1.0");
    };
  }, []);

  const fetchTrips = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/pwa/login", { replace: true }); return; }
    setUserId(session.user.id);

    const { data, error } = await supabase
      .from("transport_trips")
      .select("id, scheduled_at, trip_status, status, assigned_driver_id, driver_checked_in_at, driver_name, transport_routes(name, origin, destination), transport_vehicles(label, plate), transport_passengers(id, status)")
      .eq("event_id", activeEventId)
      .in("trip_status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true });

    if (error) console.error(error);
    setTrips((data as any) || []);
    setLoading(false);
  }, [navigate]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const handleCheckIn = async (tripId: string) => {
    if (!userId) return;
    setCheckingIn(tripId);
    try {
      const { data, error } = await supabase
        .from("transport_trips")
        .update({
          assigned_driver_id: userId,
          driver_checked_in_at: new Date().toISOString(),
          trip_status: "in_progress",
        })
        .eq("id", tripId)
        .is("assigned_driver_id", null)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Viagem já iniciada por outro motorista");
        fetchTrips();
        return;
      }

      if (navigator.vibrate) navigator.vibrate(200);
      toast.success("Viagem iniciada!");
      navigate(`/pwa/transporte/embarque/${tripId}`);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    } finally {
      setCheckingIn(null);
    }
  };

  const handleRelease = async (tripId: string) => {
    if (!confirm("Liberar viagem? Outro motorista poderá assumi-la.")) return;
    try {
      const { error } = await supabase
        .from("transport_trips")
        .update({ assigned_driver_id: null, driver_checked_in_at: null, trip_status: "scheduled" })
        .eq("id", tripId)
        .eq("assigned_driver_id", userId!);
      if (error) throw error;
      toast.success("Viagem liberada");
      fetchTrips();
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    }
  };

  const filtered = trips.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.transport_routes?.name?.toLowerCase().includes(q) ||
      t.transport_vehicles?.label?.toLowerCase().includes(q) ||
      t.transport_vehicles?.plate?.toLowerCase().includes(q)
    );
  });

  const myTrips = filtered.filter(t => t.assigned_driver_id === userId && t.trip_status === "in_progress");
  const available = filtered.filter(t => !t.assigned_driver_id && t.trip_status === "scheduled");
  const others = filtered.filter(t => t.assigned_driver_id && t.assigned_driver_id !== userId);

  const boardedCount = (t: TripRow) => t.transport_passengers?.filter(p => p.status === "boarded").length || 0;
  const totalPassengers = (t: TripRow) => t.transport_passengers?.length || 0;

  const TripCard = ({ trip, variant }: { trip: TripRow; variant: "mine" | "available" | "other" }) => (
    <div className={`op-card p-3 transition-all ${variant === "mine" ? "border-module shadow-app-md" : variant === "other" ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-sm text-foreground">
          {trip.scheduled_at ? format(new Date(trip.scheduled_at), "HH:mm") : "—"}
        </span>
        <PwaStatusBadge tone={variant === "mine" ? "live" : variant === "other" ? "neutral" : "scheduled"} pulse={variant === "mine"}>
          {variant === "mine" ? "Em rota" : variant === "other" ? "Outro motorista" : "Disponível"}
        </PwaStatusBadge>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-foreground/90">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-module" />
          <span className="truncate font-medium">{trip.transport_routes?.name || "Sem rota"}</span>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Bus className="h-3 w-3" />{trip.transport_vehicles?.label || trip.transport_vehicles?.plate || "—"}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{boardedCount(trip)}/{totalPassengers(trip)} pax</span>
        </div>
      </div>

      {variant === "mine" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="op-btn-primary !h-9 flex-1 !text-xs" onClick={() => navigate(`/pwa/transporte/embarque/${trip.id}`)}>
            <ArrowRight className="h-3.5 w-3.5" /> Continuar
          </Button>
          <Button size="sm" variant="outline" className="h-9 border-border/70" onClick={() => handleRelease(trip.id)}>
            <Unlock className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {variant === "available" && (
        <Button size="sm" className="op-btn-primary !h-9 mt-3 !text-xs" disabled={checkingIn === trip.id} onClick={() => handleCheckIn(trip.id)}>
          <Play className="h-3.5 w-3.5" />
          {checkingIn === trip.id ? "Iniciando..." : "Iniciar viagem"}
        </Button>
      )}
    </div>
  );

  const Section = ({ title, icon: Icon, trips: sectionTrips, variant }: {
    title: string; icon: any; trips: TripRow[]; variant: "mine" | "available" | "other";
  }) => (
    sectionTrips.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="op-label">{title}</span>
          <span className="ml-auto rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{sectionTrips.length}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sectionTrips.map(t => <TripCard key={t.id} trip={t} variant={variant} />)}
        </div>
      </div>
    ) : null
  );

  const eventSubtitle = undefined;

  return (
    <div className="op-screen">
      <PwaHeader title="Transporte" subtitle={eventSubtitle} icon={Bus} backTo="/pwa" onSignOut={handleSignOut} />

      <PwaContainer size="lg">
        <PwaStatTriplet
          loading={loading}
          items={[
            { label: "Embarques hoje", value: myTrips.reduce((s, t) => s + boardedCount(t), 0), tone: "module" },
            { label: "Viagens", value: myTrips.length + available.length, tone: "green" },
            { label: "Pendentes", value: available.length, tone: "amber" },
          ]}
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar rota ou veículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-11 rounded-xl border-border/70 bg-card/80 pl-9 text-sm"
          />
        </div>

        {loading && <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full bg-muted/30" />)}</div>}

        {!loading && (
          <>
            <Section title="Viagens em andamento" icon={ArrowRight} trips={myTrips} variant="mine" />
            <Section title="Disponíveis" icon={Clock} trips={available} variant="available" />
            <Section title="Outros motoristas" icon={AlertTriangle} trips={others} variant="other" />

            {filtered.length === 0 && (
              <div className="op-card flex flex-col items-center justify-center py-10 text-center">
                <Bus className="h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">Nenhuma viagem encontrada</p>
              </div>
            )}
          </>
        )}
      </PwaContainer>

      <PwaBottomBar>
        <Button className="op-btn-primary" onClick={() => navigate("/pwa/transporte/scan")}>
          <QrCode className="h-5 w-5" />
          Escanear QR de Embarque
        </Button>
      </PwaBottomBar>
    </div>
  );
}
