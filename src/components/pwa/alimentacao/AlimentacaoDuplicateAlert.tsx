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
      const today = new Date().toISOString().slice(0, 10);

      // Get today's consumptions
      const { data: consumptions, error } = await supabase
        .from("meal_consumptions")
        .select("participant_id, meal_window_id")
        .gte("consumed_at", today + "T00:00:00");

      if (error || !consumptions) {
        setLoading(false);
        return;
      }

      // Find participants who consumed the same window more than once
      const windowParticipant = new Map<string, Map<string, number>>();
      consumptions.forEach((c: any) => {
        const key = c.participant_id;
        if (!windowParticipant.has(key)) windowParticipant.set(key, new Map());
        const wm = windowParticipant.get(key)!;
        wm.set(c.meal_window_id, (wm.get(c.meal_window_id) || 0) + 1);
      });

      // Also check: same participant in multiple windows of the same meal_type today
      // For now, check duplicate window entries (>1 consumption in same window)
      const dups: { participant_id: string; windowIds: string[]; counts: Map<string, number> }[] = [];
      windowParticipant.forEach((windows, pid) => {
        const dupWindows: string[] = [];
        windows.forEach((count, wid) => {
          if (count > 1) dupWindows.push(wid);
        });
        if (dupWindows.length > 0) {
          dups.push({ participant_id: pid, windowIds: dupWindows, counts: windows });
        }
      });

      if (dups.length === 0) {
        setDuplicates([]);
        setLoading(false);
        return;
      }

      // Fetch participant names and window labels
      const participantIds = dups.map(d => d.participant_id);
      const allWindowIds = [...new Set(dups.flatMap(d => d.windowIds))];

      const [participantsRes, windowsRes] = await Promise.all([
        supabase.from("participants").select("id, person:people(full_name)").in("id", participantIds),
        supabase.from("meal_windows").select("id, label").in("id", allWindowIds),
      ]);

      const nameMap = new Map(((participantsRes.data || []) as any[]).map((p: any) => [p.id, p.person?.full_name || "—"]));
      const windowMap = new Map(((windowsRes.data || []) as any[]).map((w: any) => [w.id, w.label || "Janela"]));

      setDuplicates(dups.map(d => ({
        participant_id: d.participant_id,
        participant_name: nameMap.get(d.participant_id) || "Desconhecido",
        windows: d.windowIds.map(wid => ({
          window_label: windowMap.get(wid) || "Janela",
          count: d.counts.get(wid) || 0,
        })),
      })));
      setLoading(false);
    })();
  }, []);

  if (loading || duplicates.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border border-destructive/40 bg-red-50 dark:bg-red-950/30 px-3 py-2.5 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs text-destructive dark:text-red-300 flex-1">
          <span className="font-semibold">⚠️ {duplicates.length} consumo{duplicates.length > 1 ? "s" : ""} duplicado{duplicates.length > 1 ? "s" : ""}</span>{" "}
          detectado{duplicates.length > 1 ? "s" : ""} hoje
        </span>
        <Button variant="outline" size="sm" className="h-7 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
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
