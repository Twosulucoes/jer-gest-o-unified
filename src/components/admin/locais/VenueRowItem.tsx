import { Pencil, MapPin, Archive, ArchiveRestore, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Tables } from "@/integrations/supabase/types";

const VENUE_TYPE_MAP: Record<string, string> = {
  arena: "Arena", gymnasium: "Ginásio", ginasio: "Ginásio",
  field: "Campo", campo: "Campo", pool: "Piscina", piscina: "Piscina",
  court: "Quadra", quadra: "Quadra", track: "Pista", pista: "Pista",
  other: "Outro", outro: "Outro",
};

export type VenueRow = Tables<"venues"> & {
  // Coluna de soft-delete (P3) — opcional até o SQL ser aplicado
  deleted_at?: string | null;
};

export interface VenueDependency {
  matches_total: number;
  matches_future: number;
}

interface BaseProps {
  venue: VenueRow;
  otherStages: string[];
  dependency?: VenueDependency;
  canWrite: boolean;
  isToggling: boolean;
  onEdit: (v: VenueRow) => void;
  onToggleActive: (v: VenueRow) => void;
  onArchive?: (v: VenueRow) => void;
  onRestore?: (v: VenueRow) => void;
}

interface RowProps extends BaseProps {
  stageKey: string;
}

function FutureMatchesBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <CalendarClock className="h-3 w-3" />
            {count}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{count} partida(s) futura(s) agendada(s)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ManageActions({
  venue, canWrite, onEdit, onArchive, onRestore,
}: Pick<BaseProps, "venue" | "canWrite" | "onEdit" | "onArchive" | "onRestore">) {
  const isArchived = !!venue.deleted_at;
  if (!canWrite) return null;

  if (isArchived) {
    return (
      <div className="flex items-center gap-1">
        {onRestore && (
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => onRestore(venue)}
            title="Restaurar"
          >
            <ArchiveRestore className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => onEdit(venue)} title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {onArchive && (
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => onArchive(venue)} title="Arquivar"
        >
          <Archive className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Linha da tabela (desktop). */
export function VenueTableRow({
  venue, stageKey, otherStages, dependency, canWrite, isToggling,
  onEdit, onToggleActive, onArchive, onRestore,
}: RowProps) {
  const isArchived = !!venue.deleted_at;
  return (
    <TableRow
      key={`${stageKey}-${venue.id}`}
      className={isArchived ? "opacity-60" : undefined}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {venue.name}
          {isArchived && (
            <Badge variant="outline" className="text-[10px] border-warning text-warning">
              Arquivado
            </Badge>
          )}
        </div>
      </TableCell>
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
        <FutureMatchesBadge count={dependency?.matches_future ?? 0} />
      </TableCell>
      <TableCell>
        {isArchived ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
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
        )}
      </TableCell>
      {canWrite && (
        <TableCell>
          <ManageActions
            venue={venue} canWrite={canWrite}
            onEdit={onEdit} onArchive={onArchive} onRestore={onRestore}
          />
        </TableCell>
      )}
    </TableRow>
  );
}

/** Cartão (mobile). */
export function VenueCard({
  venue, otherStages, dependency, canWrite, isToggling,
  onEdit, onToggleActive, onArchive, onRestore,
}: BaseProps) {
  const isArchived = !!venue.deleted_at;
  return (
    <div className={`rounded-md border bg-background p-3 space-y-2 ${isArchived ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{venue.name}</p>
            {isArchived && (
              <Badge variant="outline" className="text-[10px] border-warning text-warning">
                Arquivado
              </Badge>
            )}
            <FutureMatchesBadge count={dependency?.matches_future ?? 0} />
          </div>
          <p className="text-xs text-muted-foreground">
            {VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}
            {venue.city ? ` • ${venue.city}` : ""}
          </p>
        </div>
        <ManageActions
          venue={venue} canWrite={canWrite}
          onEdit={onEdit} onArchive={onArchive} onRestore={onRestore}
        />
      </div>

      {otherStages.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          {otherStages.map((n) => (
            <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
          ))}
        </div>
      )}

      {!isArchived && (
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
      )}
    </div>
  );
}
