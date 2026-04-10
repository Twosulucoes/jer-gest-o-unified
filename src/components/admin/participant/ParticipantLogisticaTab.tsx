import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bus, UtensilsCrossed, BedDouble, Clock, MapPin, ExternalLink } from "lucide-react";
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

export default function ParticipantLogisticaTab({ participantId, eventId }: Props) {
  const navigate = useNavigate();

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
      const { data, error } = await supabase.from("lodging_units").select("id, name, location_id").in("id", unitIds);
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
      const { data, error } = await supabase.from("lodging_locations").select("id, name").in("id", locationIds);
      if (error) throw error;
      return data;
    },
    enabled: locationIds.length > 0,
  });

  // Alimentação — detalhada por refeição
  const { data: meals = [], isLoading: loadingMeals } = useQuery({
    queryKey: ["participant_meals_detail", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("id, consumed_at, meal_window_id")
        .eq("participant_id", participantId)
        .order("consumed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mealWindowIds = [...new Set(meals.map(m => m.meal_window_id))];
  const { data: mealWindows = [] } = useQuery({
    queryKey: ["meal_windows_for_participant", mealWindowIds],
    queryFn: async () => {
      if (!mealWindowIds.length) return [];
      const { data, error } = await supabase
        .from("meal_windows")
        .select("id, meal_type_id, service_date")
        .in("id", mealWindowIds);
      if (error) throw error;
      return data;
    },
    enabled: mealWindowIds.length > 0,
  });

  const mealTypeIds = [...new Set(mealWindows.map(w => w.meal_type_id))];
  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal_types_for_participant", mealTypeIds],
    queryFn: async () => {
      if (!mealTypeIds.length) return [];
      const { data, error } = await supabase.from("meal_types").select("id, name").in("id", mealTypeIds);
      if (error) throw error;
      return data;
    },
    enabled: mealTypeIds.length > 0,
  });

  // Transporte
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
      const { data, error } = await supabase.from("transport_routes").select("id, name, origin, destination").in("id", routeIds);
      if (error) throw error;
      return data;
    },
    enabled: routeIds.length > 0,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles_for_participant", vehicleIds],
    queryFn: async () => {
      if (!vehicleIds.length) return [];
      const { data, error } = await supabase.from("transport_vehicles").select("id, label, plate").in("id", vehicleIds);
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
  const mealWindowMap = new Map(mealWindows.map(w => [w.id, w]));
  const mealTypeMap = new Map(mealTypes.map(t => [t.id, t]));

  // Group meals by date+type
  const mealsByGroup = new Map<string, { date: string; typeName: string; count: number }>();
  for (const m of meals) {
    const w = mealWindowMap.get(m.meal_window_id);
    const t = w ? mealTypeMap.get(w.meal_type_id) : null;
    const date = w?.service_date ?? "?";
    const typeName = t?.name ?? "?";
    const key = `${date}|${typeName}`;
    const existing = mealsByGroup.get(key);
    if (existing) {
      existing.count++;
    } else {
      mealsByGroup.set(key, { date, typeName, count: 1 });
    }
  }
  const mealGroups = Array.from(mealsByGroup.values()).sort((a, b) => b.date.localeCompare(a.date));

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
                  <div key={l.id} className="text-sm space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-foreground">{loc?.name} — {unit?.name ?? "?"}</span>
                      <Badge variant="outline" className="text-xs">{LODGING_STATUS[l.status] ?? l.status}</Badge>
                    </div>
                    {l.checked_in_at && (
                      <p className="text-xs text-muted-foreground">
                        Check-in: {new Date(l.checked_in_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    )}
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
          {loadingMeals ? (
            <Skeleton className="h-8 w-full" />
          ) : meals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma refeição registrada.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{meals.length}</p>
              <p className="text-xs text-muted-foreground mb-2">refeições consumidas</p>
              {mealGroups.length > 0 && (
                <div className="space-y-1 border-t pt-2">
                  {mealGroups.slice(0, 6).map((g, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {g.date !== "?" ? new Date(g.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "?"} — {g.typeName}
                      </span>
                      <span className="font-medium text-foreground">{g.count}×</span>
                    </div>
                  ))}
                  {mealGroups.length > 6 && (
                    <p className="text-xs text-muted-foreground">+{mealGroups.length - 6} mais</p>
                  )}
                </div>
              )}
            </div>
          )}
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
                      <div className="space-y-0.5 min-w-0">
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
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Badge variant={pStatus.variant} className="text-xs">{pStatus.label}</Badge>
                        {trip && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => navigate(`/admin/transporte/embarque/${trip.id}`)}
                            title="Abrir viagem"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
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
