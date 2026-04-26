import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Archive } from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";

type VenueRow = Tables<"venues">;

interface ArchiveVenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: VenueRow | null;
  isPending: boolean;
  onConfirm: (params: { force: boolean; reason: string }) => void;
}

/**
 * Dialog de arquivamento (soft-delete) com painel de impacto:
 * mostra partidas futuras / total dependentes do venue antes de confirmar.
 * Se há partidas futuras, exige confirmação reforçada (force=true).
 */
export default function ArchiveVenueDialog({
  open, onOpenChange, venue, isPending, onConfirm,
}: ArchiveVenueDialogProps) {
  const [reason, setReason] = useState("");

  const { data: deps, isLoading } = useQuery({
    queryKey: ["venue-deps", venue?.id],
    enabled: open && !!venue?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_venue_dependencies")
        .select("matches_total, matches_future, matches_past")
        .eq("venue_id", venue!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { matches_total: 0, matches_future: 0, matches_past: 0 }) as {
        matches_total: number; matches_future: number; matches_past: number;
      };
    },
  });

  const future = deps?.matches_future ?? 0;
  const total = deps?.matches_total ?? 0;
  const requiresForce = future > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setReason(""); }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Arquivar local
          </DialogTitle>
          <DialogDescription>
            <strong>{venue?.name}</strong> será removido das listagens padrão e bloqueado para
            novos agendamentos. Pode ser restaurado depois.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Futuras" value={future} highlight={future > 0} />
              <Stat label="Passadas" value={deps?.matches_past ?? 0} />
              <Stat label="Total" value={total} />
            </div>

            {requiresForce && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção: partidas futuras agendadas</AlertTitle>
                <AlertDescription className="text-xs">
                  Existem <strong>{future}</strong> partida(s) futura(s) neste local. Arquivar
                  agora <strong>não cancela</strong> as partidas, mas impedirá novos
                  agendamentos. Considere reagendar antes.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <Label htmlFor="archive-reason" className="text-xs">
                Motivo (opcional, registrado em auditoria)
              </Label>
              <Textarea
                id="archive-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: local indisponível para a temporada"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant={requiresForce ? "destructive" : "default"}
            onClick={() => onConfirm({ force: requiresForce, reason })}
            disabled={isPending || isLoading}
          >
            {isPending
              ? "Arquivando…"
              : requiresForce
              ? "Arquivar mesmo assim"
              : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${highlight ? "border-destructive/50 bg-destructive/5" : ""}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
