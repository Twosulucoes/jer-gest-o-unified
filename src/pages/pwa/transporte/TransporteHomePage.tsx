import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bus, Clock, MapPin, Users, Play, ArrowRight,
  Search, Unlock, AlertTriangle, QrCode,
} from "lucide-react";
import { format } from "date-fns";
import { PwaHeader } from "@/components/pwa/PwaHeader";

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
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  // Lock viewport scale only
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
    <Card className={`transition-all ${
      variant === "mine" ? "border-[hsl(var(--module-accent)/0.45)] bg-[hsl(var(--module-accent)/0.09)] shadow-md" :
      variant === "other" ? "opacity-60" : ""
    }`}>
      <CardContent className="p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">
            {trip.scheduled_at ? format(new Date(trip.scheduled_at), "HH:mm") : "—"}
          </span>
          <Badge variant={variant === "mine" ? "module" : variant === "other" ? "secondary" : "outline"} className="text-[10px] rounded-full">
            {variant === "mine" ? "Em andamento" : variant === "other" ? "Outro motorista" : "Disponível"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{trip.transport_routes?.name || "Sem rota"}</span>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Bus className="h-3 w-3" />{trip.transport_vehicles?.label || trip.transport_vehicles?.plate || "—"}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{boardedCount(trip)}/{totalPassengers(trip)}</span>
        </div>

        {variant === "mine" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="module" className="flex-1 h-8 text-xs" onClick={() => navigate(`/pwa/transporte/embarque/${trip.id}`)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" /> Continuar
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => handleRelease(trip.id)}>
              <Unlock className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {variant === "available" && (
          <Button size="sm" className="w-full h-8 text-xs" variant="module" disabled={checkingIn === trip.id} onClick={() => handleCheckIn(trip.id)}>
            <Play className="h-3.5 w-3.5 mr-1" />
            {checkingIn === trip.id ? "Iniciando..." : "Iniciar Viagem"}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const Section = ({ title, icon: Icon, trips: sectionTrips, variant }: {
    title: string; icon: any; trips: TripRow[]; variant: "mine" | "available" | "other";
  }) => (
    sectionTrips.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-xs font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span>{title}</span>
          <Badge variant={variant === "mine" ? "module" : "secondary"} className="ml-auto text-[10px]">{sectionTrips.length}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sectionTrips.map(t => <TripCard key={t.id} trip={t} variant={variant} />)}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <PwaHeader title="Transporte" icon={Bus} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="relative mx-auto max-w-5xl space-y-3 p-3 pb-24">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar rota ou veículo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 text-sm border-border/80 bg-card/90" />
        </div>

        {loading && <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>}

        {!loading && (
          <>
            <Section title="Minhas Viagens" icon={ArrowRight} trips={myTrips} variant="mine" />
            <Section title="Viagens Disponíveis" icon={Clock} trips={available} variant="available" />
            <Section title="Outras Viagens" icon={AlertTriangle} trips={others} variant="other" />

            {filtered.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium text-sm">Nenhuma viagem encontrada</p>
              </div>
            )}
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/80 bg-background/95 p-3 backdrop-blur-md">
        <div className="mx-auto max-w-5xl">
          <Button variant="module" className="h-12 w-full rounded-xl text-base font-semibold shadow-app-md" onClick={() => navigate("/pwa/transporte/scan")}>
            <QrCode className="mr-2 h-5 w-5" />
            Escanear QR de Embarque
          </Button>
        </div>
      </div>
    </div>
  );
}
