import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Bus } from "lucide-react";
import { format } from "date-fns";

interface TripInfoCardProps {
  routeName?: string;
  origin?: string | null;
  destination?: string | null;
  scheduledAt?: string | null;
  vehicleLabel?: string;
  vehiclePlate?: string;
}

export function TripInfoCard({
  routeName,
  origin,
  destination,
  scheduledAt,
  vehicleLabel,
  vehiclePlate,
}: TripInfoCardProps) {
  const routeDisplay = origin && destination ? `${origin} → ${destination}` : routeName || "Sem rota";

  return (
    <div className="rounded-xl border-2 border-primary bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-foreground truncate">{routeDisplay}</span>
        <Badge className="bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-wider shrink-0">
          Viagem Ativa
        </Badge>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {scheduledAt ? format(new Date(scheduledAt), "HH:mm") : "—"}
        </span>
        <span className="flex items-center gap-1">
          <Bus className="h-3.5 w-3.5" />
          {vehicleLabel || vehiclePlate || "Sem veículo"}
        </span>
        {routeName && origin && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {routeName}
          </span>
        )}
      </div>
    </div>
  );
}
