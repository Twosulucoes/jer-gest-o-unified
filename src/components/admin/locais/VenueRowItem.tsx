import { Pencil, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

const VENUE_TYPE_MAP: Record<string, string> = {
  arena: "Arena", gymnasium: "Ginásio", ginasio: "Ginásio",
  field: "Campo", campo: "Campo", pool: "Piscina", piscina: "Piscina",
  court: "Quadra", quadra: "Quadra", track: "Pista", pista: "Pista",
  other: "Outro", outro: "Outro",
};

export type VenueRow = Tables<"venues">;

interface Props {
  venue: VenueRow;
  stageKey: string;
  otherStages: string[];
  canWrite: boolean;
  isToggling: boolean;
  onEdit: (v: VenueRow) => void;
  onToggleActive: (v: VenueRow) => void;
}

/** Linha da tabela (desktop). */
export function VenueTableRow({
  venue, stageKey, otherStages, canWrite, isToggling, onEdit, onToggleActive,
}: Props) {
  return (
    <TableRow key={`${stageKey}-${venue.id}`}>
      <TableCell className="font-medium">{venue.name}</TableCell>
      <TableCell>{VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}</TableCell>
      <TableCell>{venue.city || "—"}</TableCell>
      <TableCell>
        {otherStages.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {otherStages.map((n) => (
              <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={venue.is_active}
            disabled={!canWrite || isToggling}
            onCheckedChange={() => onToggleActive(venue)}
            aria-label={venue.is_active ? "Desativar local" : "Ativar local"}
          />
          <span className="text-xs text-muted-foreground">
            {venue.is_active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </TableCell>
      {canWrite && (
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => onEdit(venue)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

/** Cartão (mobile). */
export function VenueCard({
  venue, otherStages, canWrite, isToggling, onEdit, onToggleActive,
}: Omit<Props, "stageKey">) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{venue.name}</p>
          <p className="text-xs text-muted-foreground">
            {VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}
            {venue.city ? ` • ${venue.city}` : ""}
          </p>
        </div>
        {canWrite && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(venue)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {otherStages.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {otherStages.map((n) => (
            <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-xs text-muted-foreground">
          {venue.is_active ? "Ativo" : "Inativo"}
        </span>
        <Switch
          checked={venue.is_active}
          disabled={!canWrite || isToggling}
          onCheckedChange={() => onToggleActive(venue)}
          aria-label={venue.is_active ? "Desativar local" : "Ativar local"}
        />
      </div>
    </div>
  );
}
