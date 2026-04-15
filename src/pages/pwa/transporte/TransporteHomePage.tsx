import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { toast } from "sonner";
import {
  Bus, Clock, MapPin, Users, Play, ArrowRight,
  Search, Unlock, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

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

  const fetchTrips = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/pwa/login", { replace: true }); return; }
    setUserId(session.user.id);

    const { data, error } = await supabase
      .from("transport_trips")
      .select("id, scheduled_at, trip_status, status, assigned_driver_id, driver_checked_in_at, driver_name, transport_routes(name, origin, destination), transport_vehicles(label, plate), transport_passengers(id, status)")
      .in("trip_status", ["scheduled", "in_progress"])
      .order("scheduled_at", { ascending: true });

    if (error) { console.error(error); }
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
        .update({
          assigned_driver_id: null,
          driver_checked_in_at: null,
          trip_status: "scheduled",
        })
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
      variant === "mine" ? "border-primary bg-primary/5 shadow-md" :
      variant === "other" ? "opacity-60" : ""
    }`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">
            {trip.scheduled_at ? format(new Date(trip.scheduled_at), "HH:mm") : "—"}
          </span>
          <Badge variant={variant === "mine" ? "default" : variant === "other" ? "secondary" : "outline"}>
            {variant === "mine" ? "Em andamento" : variant === "other" ? "Outro motorista" : "Disponível"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{trip.transport_routes?.name || "Sem rota"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bus className="h-3 w-3 shrink-0" />
          <span>{trip.transport_vehicles?.label || trip.transport_vehicles?.plate || "Sem veículo"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          <span>{boardedCount(trip)}/{totalPassengers(trip)} embarcados</span>
        </div>

        {variant === "mine" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" onClick={() => navigate(`/pwa/transporte/embarque/${trip.id}`)}>
              <ArrowRight className="h-4 w-4 mr-1" /> Continuar Embarque
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleRelease(trip.id)}>
              <Unlock className="h-4 w-4" />
            </Button>
          </div>
        )}

        {variant === "available" && (
          <Button
            size="sm"
            className="w-full"
            variant="outline"
            disabled={checkingIn === trip.id}
            onClick={() => handleCheckIn(trip.id)}
          >
            <Play className="h-4 w-4 mr-1" />
            {checkingIn === trip.id ? "Iniciando..." : "Iniciar Viagem"}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const Section = ({ title, icon: Icon, trips: sectionTrips, variant, emptyText }: {
    title: string; icon: any; trips: TripRow[]; variant: "mine" | "available" | "other"; emptyText: string;
  }) => (
    sectionTrips.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
          <Badge variant="secondary" className="ml-auto text-xs">{sectionTrips.length}</Badge>
        </div>
        {sectionTrips.map(t => <TripCard key={t.id} trip={t} variant={variant} />)}
      </div>
    ) : null
  );

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Transporte" icon={Bus} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar rota ou veículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}

        {!loading && (
          <>
            <Section title="Minhas Viagens" icon={ArrowRight} trips={myTrips} variant="mine" emptyText="" />
            <Section title="Viagens Disponíveis" icon={Clock} trips={available} variant="available" emptyText="" />
            <Section title="Outras Viagens" icon={AlertTriangle} trips={others} variant="other" emptyText="" />

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bus className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhuma viagem encontrada</p>
                <p className="text-sm mt-1">Não há viagens agendadas ou em andamento</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
