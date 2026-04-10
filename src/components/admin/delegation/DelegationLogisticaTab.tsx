import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BedDouble, UtensilsCrossed, Bus, MapPin } from "lucide-react";

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationLogisticaTab({ delegationId, eventId }: Props) {
  const { data: participantIds = [], isLoading: loadingP } = useQuery({
    queryKey: ["delegation_logistica_pids", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId);
      if (error) throw error;
      return data.map(p => p.id);
    },
  });

  // Lodging
  const { data: lodging = [], isLoading: loadingL } = useQuery({
    queryKey: ["delegation_lodging_detail", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("lodging_occupancies")
        .select("id, participant_id, status, unit_id, lodging_units(name, location_id, lodging_locations(name))")
        .in("participant_id", participantIds)
        .eq("event_id", eventId);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  // Meals
  const { data: meals = [] } = useQuery({
    queryKey: ["delegation_meals_detail", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("id, participant_id, consumed_at, meal_window_id, meal_windows(service_date, meal_type_id, meal_types(name))")
        .in("participant_id", participantIds)
        .order("consumed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  // Transport
  const { data: transport = [] } = useQuery({
    queryKey: ["delegation_transport_detail", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("transport_passengers")
        .select("id, participant_id, trip_id, transport_trips(departure_time, route_id, transport_routes(name))")
        .in("participant_id", participantIds)
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  const isLoading = loadingP || loadingL;

  // Group lodging by location
  const lodgingByLocation = new Map<string, { location: string; units: Map<string, number> }>();
  for (const occ of lodging) {
    const locName = occ.lodging_units?.lodging_locations?.name ?? "Sem local";
    const unitName = occ.lodging_units?.name ?? "Sem unidade";
    if (!lodgingByLocation.has(locName)) {
      lodgingByLocation.set(locName, { location: locName, units: new Map() });
    }
    const entry = lodgingByLocation.get(locName)!;
    entry.units.set(unitName, (entry.units.get(unitName) || 0) + 1);
  }

  // Group meals by type
  const mealsByType = new Map<string, number>();
  for (const m of meals) {
    const typeName = m.meal_windows?.meal_types?.name ?? "Outro";
    mealsByType.set(typeName, (mealsByType.get(typeName) || 0) + 1);
  }

  // Group transport by route
  const transportByRoute = new Map<string, number>();
  for (const t of transport) {
    const routeName = t.transport_trips?.transport_routes?.name ?? "Sem rota";
    transportByRoute.set(routeName, (transportByRoute.get(routeName) || 0) + 1);
  }

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={<BedDouble className="h-4 w-4 text-purple-600" />} label="Alojados" value={lodging.length} />
        <SummaryCard icon={<UtensilsCrossed className="h-4 w-4 text-orange-600" />} label="Refeições" value={meals.length} />
        <SummaryCard icon={<Bus className="h-4 w-4 text-teal-600" />} label="Embarques" value={transport.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alojamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-purple-600" />
              Alojamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lodgingByLocation.size === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum participante alojado.</p>
            ) : (
              <div className="space-y-3">
                {Array.from(lodgingByLocation.values()).map(({ location, units }) => (
                  <div key={location}>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{location}
                    </p>
                    <div className="ml-5 mt-1 space-y-0.5">
                      {Array.from(units.entries()).map(([unit, count]) => (
                        <p key={unit} className="text-xs text-muted-foreground">{unit}: {count} pessoa{count > 1 ? "s" : ""}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alimentação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-orange-600" />
              Alimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mealsByType.size === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma refeição registrada.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(mealsByType.entries()).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span>{type}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex items-center justify-between text-sm font-medium">
                  <span>Total</span>
                  <span>{meals.length}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transporte */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bus className="h-4 w-4 text-teal-600" />
              Transporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transportByRoute.size === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum embarque registrado.</p>
            ) : (
              <div className="space-y-2">
                {Array.from(transportByRoute.entries()).map(([route, count]) => (
                  <div key={route} className="flex items-center justify-between text-sm">
                    <span>{route}</span>
                    <span className="font-medium">{count} embarque{count > 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 p-3">
        {icon}
        <div>
          <p className="text-lg font-bold leading-none text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
