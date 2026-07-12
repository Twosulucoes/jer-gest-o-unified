import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface DuplicateRecord {
  consumption_id: string;
  meal_window_id: string;
  consumed_at: string;
}

interface DuplicateGroup {
  participant_id: string;
  participant_name: string | null;
  service_date: string;
  meal_type_id: string;
  meal_type_name: string | null;
  event_id: string | null;
  event_stage_id: string | null;
  occurrences: number;
  records: DuplicateRecord[];
}

interface AlimentacaoDuplicateAlertProps {
  eventId?: string | null;
  eventStageId?: string | null;
  serviceDate?: string;
}

export function AlimentacaoDuplicateAlert({
  eventId,
  eventStageId,
  serviceDate,
}: AlimentacaoDuplicateAlertProps = {}) {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      // Fuso de Roraima (UTC-4); toISOString() retorna UTC e pode dar "amanhã" às 21h local,
      // fazendo a checagem de duplicidades consultar o dia errado durante a janela do jantar.
      const today =
        serviceDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Boa_Vista" });
      const { data, error: rpcError } = await supabase.rpc("get_alimentacao_duplicates" as any, {
        p_event_id: eventId ?? null,
        p_event_stage_id: eventStageId ?? null,
        p_service_date: today,
      });
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message ?? "Falha ao consultar duplicidades.");
        setDuplicates([]);
        setLoading(false);
        return;
      }
      const payload = (data ?? {}) as { duplicates?: DuplicateGroup[] };
      setDuplicates(Array.isArray(payload.duplicates) ? payload.duplicates : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, eventStageId, serviceDate]);

  if (loading) return null;
  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
        <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">
          Não foi possível verificar duplicidades agora.
        </span>
      </div>
    );
  }
  if (duplicates.length === 0) return null;

  const total = duplicates.length;

  return (
    <>
      <div className="rounded-lg border border-destructive/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
        <span className="text-xs text-destructive dark:text-red-300 flex-1">
          <span className="font-semibold">
            {total} consumo{total > 1 ? "s" : ""} duplicado{total > 1 ? "s" : ""}
          </span>{" "}
          detectado{total > 1 ? "s" : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={() => setOpen(true)}
        >
          Ver Lista
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              Consumos Duplicados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {duplicates.map((d) => (
              <div key={`${d.participant_id}-${d.service_date}-${d.meal_type_id}`} className="rounded-lg border p-3 space-y-1.5">
                <p className="text-sm font-medium">{d.participant_name ?? "Participante"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.meal_type_name ?? "Refeição"} ·{" "}
                  {new Date(d.service_date + "T00:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="destructive" className="text-[10px]">
                    {d.occurrences}x consumos
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
