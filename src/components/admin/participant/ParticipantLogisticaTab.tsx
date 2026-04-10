import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bus, UtensilsCrossed, BedDouble, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  participantId: string;
  eventId: string;
}

const LODGING_STATUS: Record<string, string> = {
  allocated: "Alocado", checked_in: "Check-in", checked_out: "Check-out",
};

const PASSENGER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  boarded: { label: "Embarcado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  alighted: { label: "Desembarcado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const TRIP_STATUS: Record<string, string> = {
  scheduled: "Agendada", in_progress: "Em trânsito", completed: "Concluída", cancelled: "Cancelada",
};

export default function ParticipantLogisticaTab({ participantId, eventId }: Props) {
  // Alojamento
  const { data: lodging = [], isLoading: loadingLodging } = useQuery({
    queryKey: ["participant_lodging", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lodging_occupancies")
        .select("id, status, unit_id, checked_in_at, checked_out_at")
        .eq("participant_id", participantId)
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  const unitIds = lodging.map(l => l.unit_id);
  const { data: units = [] } = useQuery({
    queryKey: ["lodging_units_for_participant", unitIds],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await supabase
        .from("lodging_units")
        .select("id, name, location_id")
        .in("id", unitIds);
      if (error) throw error;
      return data;
    },
    enabled: unitIds.length > 0,
  });

  const locationIds = [...new Set(units.map(u => u.location_id))];
  const { data: locations = [] } = useQuery({
    queryKey: ["lodging_locations_for_participant", locationIds],
    queryFn: async () => {
      if (!locationIds.length) return [];
      const { data, error } = await supabase
        .from("lodging_locations")
        .select("id, name")
        .in("id", locationIds);
      if (error) throw error;
      return data;
    },
    enabled: locationIds.length > 0,
  });

  // Alimentação
  const { data: mealCount } = useQuery({
    queryKey: ["participant_meals_count", participantId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Transporte - passageiros
  const { data: passengers = [], isLoading: loadingTransport } = useQuery({
    queryKey: ["participant_transport", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_passengers")
        .select("id, trip_id, status, boarded_at, alighted_at")
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tripIds = [...new Set(passengers.map(p => p.trip_id))];
  const { data: trips = [] } = useQuery({
    queryKey: ["trips_for_participant", tripIds],
    queryFn: async () => {
      if (!tripIds.length) return [];
      const { data, error } = await supabase
        .from("transport_trips")
        .select("id, route_id, vehicle_id, scheduled_at, status")
        .in("id", tripIds);
      if (error) throw error;
      return data;
    },
    enabled: tripIds.length > 0,
  });

  const routeIds = [...new Set(trips.map(t => t.route_id))];
  const vehicleIds = [...new Set(trips.filter(t => t.vehicle_id).map(t => t.vehicle_id!))];

  const { data: routes = [] } = useQuery({
    queryKey: ["routes_for_participant", routeIds],
    queryFn: async () => {
      if (!routeIds.length) return [];
      const { data, error } = await supabase
        .from("transport_routes")
        .select("id, name, origin, destination")
        .in("id", routeIds);
      if (error) throw error;
      return data;
    },
    enabled: routeIds.length > 0,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_for_participant", vehicleIds],
    queryFn: async () => {
      if (!vehicleIds.length) return [];
      const { data, error } = await supabase
        .from("transport_vehicles")
        .select("id, label, plate")
        .in("id", vehicleIds);
      if (error) throw error;
      return data;
    },
    enabled: vehicleIds.length > 0,
  });

  const unitMap = new Map(units.map(u => [u.id, u]));
  const locationMap = new Map(locations.map(l => [l.id, l]));
  const tripMap = new Map(trips.map(t => [t.id, t]));
  const routeMap = new Map(routes.map(r => [r.id, r]));
  const vehicleMap = new Map(vehicles.map(v => [v.id, v]));

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Alojamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BedDouble className="h-4 w-4" />Alojamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLodging ? (
            <Skeleton className="h-8 w-full" />
          ) : lodging.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem alocação registrada.</p>
          ) : (
            <div className="space-y-2">
              {lodging.map(l => {
                const unit = unitMap.get(l.unit_id);
                const loc = unit ? locationMap.get(unit.location_id) : null;
                return (
                  <div key={l.id} className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>{loc?.name} — {unit?.name ?? "?"}</span>
                      <Badge variant="outline" className="text-xs">{LODGING_STATUS[l.status] ?? l.status}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alimentação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />Alimentação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <p className="text-2xl font-bold text-foreground">{mealCount ?? 0}</p>
            <p className="text-muted-foreground">refeições consumidas</p>
          </div>
        </CardContent>
      </Card>

      {/* Transporte */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" />Transporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransport ? (
            <Skeleton className="h-8 w-full" />
          ) : passengers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem viagens registradas.</p>
          ) : (
            <div className="space-y-3">
              {passengers.map(p => {
                const trip = tripMap.get(p.trip_id);
                const route = trip ? routeMap.get(trip.route_id) : null;
                const vehicle = trip?.vehicle_id ? vehicleMap.get(trip.vehicle_id) : null;
                const pStatus = PASSENGER_STATUS[p.status] ?? { label: p.status, variant: "outline" as const };

                return (
                  <div key={p.id} className="text-sm space-y-1 border-b last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        {route && (
                          <div className="flex items-center gap-1 text-foreground font-medium">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{route.origin} → {route.destination}</span>
                          </div>
                        )}
                        {trip?.scheduled_at && (
                          <div className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3" />
                            {new Date(trip.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        )}
                        {vehicle && (
                          <span className="text-xs text-muted-foreground">{vehicle.label} • {vehicle.plate}</span>
                        )}
                      </div>
                      <Badge variant={pStatus.variant} className="text-xs shrink-0 ml-2">{pStatus.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
