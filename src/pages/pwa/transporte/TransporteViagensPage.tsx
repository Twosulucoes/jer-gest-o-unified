import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, MapPin, Bus } from "lucide-react";
import { format } from "date-fns";

interface Trip {
  id: string;
  departure_time: string;
  status: string;
  vehicle: { plate: string; label: string } | null;
  route: { name: string } | null;
}

export default function TransporteViagensPage() {
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from("transport_trips")
        .select("id, scheduled_at, status, transport_vehicles(plate, label), transport_routes(name)")
        .eq("event_id", eventId)
        .gte("scheduled_at", today + "T00:00:00");

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data } = await query.order("scheduled_at");

      setTrips((data as any)?.map((t: any) => ({
        id: t.id,
        departure_time: t.scheduled_at,
        status: t.status,
        vehicle: t.transport_vehicles,
        route: t.transport_routes,
      })) || []);
      setLoading(false);
    })();
  }, [eventId, stageId]);

  const statusColor = (s: string) => {
    if (s === "em_transito") return "default";
    if (s === "concluida") return "secondary";
    return "outline";
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { agendada: "Agendada", em_transito: "Em trânsito", concluida: "Concluída", cancelada: "Cancelada" };
    return map[s] || s;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/transporte")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Clock className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Viagens de Hoje</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}

        {!loading && trips.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma viagem para hoje</div>
        )}

        {trips.map((trip) => (
          <Card key={trip.id} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all"
            onClick={() => navigate(`/pwa/transporte/embarque?tripId=${trip.id}`)}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {format(new Date(trip.departure_time), "HH:mm")}
                </span>
                <Badge variant={statusColor(trip.status)}>{statusLabel(trip.status)}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{trip.route?.name || "Sem rota"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Bus className="h-3 w-3" />
                <span>{trip.vehicle?.label || trip.vehicle?.plate || "Sem veículo"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
