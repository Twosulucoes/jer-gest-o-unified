import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TodayMealWindow {
  id: string;
  label: string;
  event_id: string;
  event_stage_id: string | null;
  start_time: string;
  end_time: string;
}

export function useTodayMealWindows(enabled = true) {
  const [windows, setWindows] = useState<TodayMealWindow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("meal_windows")
      .select("id, service_date, start_time, end_time, event_id, event_stage_id, meal_type:meal_types(name)")
      .eq("service_date", today)
      .order("start_time")
      .then(({ data }) => {
        if (data) {
          setWindows(
            (data as any[]).map((w) => ({
              id: w.id,
              label: `${w.meal_type?.name ?? "Refeição"} ${(w.start_time ?? "").slice(0, 5)}–${(w.end_time ?? "").slice(0, 5)}`,
              event_id: w.event_id,
              event_stage_id: w.event_stage_id ?? null,
              start_time: w.start_time,
              end_time: w.end_time,
            }))
          );
        }
        setLoading(false);
      });
  }, [enabled]);

  return { windows, loading };
}
