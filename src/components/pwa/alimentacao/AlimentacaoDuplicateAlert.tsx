import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface DuplicateConsumption {
  participant_id: string;
  participant_name: string;
  windows: { window_label: string; count: number }[];
}

export function AlimentacaoDuplicateAlert() {
  const [duplicates, setDuplicates] = useState<DuplicateConsumption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_alimentacao_duplicates" as any);
      setDuplicates((Array.isArray(data) ? data : []) as DuplicateConsumption[]);
      setLoading(false);
    })();
  }, []);

  if (loading || duplicates.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-destructive/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs text-destructive dark:text-red-300 flex-1">
          <span className="font-semibold">
            ⚠️ {duplicates.length} consumo{duplicates.length > 1 ? "s" : ""} duplicado{duplicates.length > 1 ? "s" : ""}
          </span>{" "}
          detectado{duplicates.length > 1 ? "s" : ""} hoje
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
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Consumos Duplicados
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {duplicates.map(d => (
              <div key={d.participant_id} className="rounded-lg border p-3 space-y-1.5">
                <p className="text-sm font-medium">{d.participant_name}</p>
                <div className="flex flex-wrap gap-1">
                  {d.windows.map(w => (
                    <Badge key={w.window_label} variant="destructive" className="text-[10px]">
                      {w.window_label}: {w.count}x
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
