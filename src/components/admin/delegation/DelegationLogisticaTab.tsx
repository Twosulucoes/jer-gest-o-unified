import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BedDouble, UtensilsCrossed, Bus, MapPin, ExternalLink, Calendar } from "lucide-react";

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

  // Lodging with participant names
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

  // Meals grouped by date and type
  const { data: meals = [] } = useQuery({
    queryKey: ["delegation_meals_detail", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("id, participant_id, consumed_at, meal_window_id, meal_windows(service_date, meal_type_id, meal_types(name))")
        .in("participant_id", participantIds)
        .order("consumed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  // Transport with trip details
  const { data: transport = [] } = useQuery({
    queryKey: ["delegation_transport_detail", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("transport_passengers")
        .select("id, participant_id, trip_id, status, transport_trips(id, departure_time, status, route_id, transport_routes(name))")
        .in("participant_id", participantIds)
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  const isLoading = loadingP || loadingL;

  // Group lodging by location → unit with count
  const lodgingByLocation = useMemo(() => {
    const map = new Map<string, { location: string; units: Map<string, { count: number; status: Map<string, number> }> }>();
    for (const occ of lodging) {
      const locName = occ.lodging_units?.lodging_locations?.name ?? "Sem local";
      const unitName = occ.lodging_units?.name ?? "Sem unidade";
      if (!map.has(locName)) map.set(locName, { location: locName, units: new Map() });
      const entry = map.get(locName)!;
      if (!entry.units.has(unitName)) entry.units.set(unitName, { count: 0, status: new Map() });
      const unit = entry.units.get(unitName)!;
      unit.count++;
      unit.status.set(occ.status, (unit.status.get(occ.status) || 0) + 1);
    }
    return map;
  }, [lodging]);

  // Group meals by date → type
  const mealsByDate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const m of meals) {
      const date = m.meal_windows?.service_date ?? "Sem data";
      const type = m.meal_windows?.meal_types?.name ?? "Outro";
      if (!map.has(date)) map.set(date, new Map());
      const types = map.get(date)!;
      types.set(type, (types.get(type) || 0) + 1);
    }
    return new Map([...map.entries()].sort(([a], [b]) => b.localeCompare(a)));
  }, [meals]);

  // Group transport by trip
  const transportByTrip = useMemo(() => {
    const map = new Map<string, { tripId: string; route: string; departure: string; count: number }>();
    for (const t of transport) {
      const tripId = t.trip_id;
      const route = t.transport_trips?.transport_routes?.name ?? "Sem rota";
      const departure = t.transport_trips?.departure_time ?? "";
      if (!map.has(tripId)) map.set(tripId, { tripId, route, departure, count: 0 });
      map.get(tripId)!.count++;
    }
    return [...map.values()].sort((a, b) => b.departure.localeCompare(a.departure));
  }, [transport]);

  const alojadosUnicos = new Set(lodging.map(l => l.participant_id)).size;

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard icon={<BedDouble className="h-4 w-4 text-purple-600" />} label="Participantes alojados" value={alojadosUnicos} />
        <SummaryCard icon={<UtensilsCrossed className="h-4 w-4 text-orange-600" />} label="Refeições servidas" value={meals.length} />
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
                    <div className="ml-5 mt-1 space-y-1">
                      {Array.from(units.entries()).map(([unit, { count, status }]) => (
                        <div key={unit} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{unit}</span>
                          <div className="flex items-center gap-1.5">
                            <span>{count} pessoa{count > 1 ? "s" : ""}</span>
                            {status.has("checked_in") && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                {status.get("checked_in")} in
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alimentação por data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-orange-600" />
              Alimentação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mealsByDate.size === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma refeição registrada.</p>
            ) : (
              <div className="space-y-3">
                {Array.from(mealsByDate.entries()).slice(0, 7).map(([date, types]) => (
                  <div key={date}>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="h-3 w-3" />
                      {date !== "Sem data" ? new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) : date}
                    </p>
                    <div className="ml-4 flex flex-wrap gap-1.5">
                      {Array.from(types.entries()).map(([type, count]) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {type}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {mealsByDate.size > 7 && <p className="text-xs text-muted-foreground">+{mealsByDate.size - 7} dias</p>}
                <div className="border-t pt-2 flex items-center justify-between text-sm font-medium">
                  <span>Total</span>
                  <span>{meals.length} refeições</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transporte por viagem */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bus className="h-4 w-4 text-teal-600" />
              Transporte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transportByTrip.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum embarque registrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rota</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Passageiros</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transportByTrip.map((trip) => (
                    <TableRow key={trip.tripId}>
                      <TableCell className="font-medium">{trip.route}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {trip.departure ? new Date(trip.departure).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{trip.count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/admin/transporte/embarque/${trip.tripId}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
