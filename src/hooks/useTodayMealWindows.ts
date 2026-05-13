import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TodayMealWindow {
  id: string;
  label: string;
  event_id: string;
  event_stage_id: string | null;
  start_time: string;
  end_time: string;
}

export interface UseTodayMealWindowsResult {
  windows: TodayMealWindow[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseTodayMealWindowsOptions {
  eventId?: string | null;
  stageId?: string | null;
}

export function useTodayMealWindows(enabled = true, options: UseTodayMealWindowsOptions = {}): UseTodayMealWindowsResult {
  const { eventId, stageId } = options;
  const [windows, setWindows] = useState<TodayMealWindow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Usar fuso de Roraima (UTC-4); toISOString() retorna UTC e pode dar "amanhã" às 21h local
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Boa_Vista" });
    let q = supabase
      .from("meal_windows")
      .select("id, service_date, start_time, end_time, event_id, event_stage_id, meal_type:meal_types(name)")
      .eq("service_date", today);
    if (eventId) q = (q as any).eq("event_id", eventId);
    if (stageId) q = (q as any).eq("event_stage_id", stageId);
    (q as any)
      .order("start_time")
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError instanceof Error ? queryError : new Error(queryError.message ?? "Falha ao carregar janelas"));
          setWindows([]);
          setLoading(false);
          return;
        }
        const rows = Array.isArray(data) ? (data as any[]) : [];
        setWindows(
          rows.map((w) => ({
            id: w.id,
            label: `${w.meal_type?.name ?? "Refeição"} ${(w.start_time ?? "").slice(0, 5)}–${(w.end_time ?? "").slice(0, 5)}`,
            event_id: w.event_id,
            event_stage_id: w.event_stage_id ?? null,
            start_time: w.start_time,
            end_time: w.end_time,
          })),
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey, eventId, stageId]);

  return { windows, loading, error, refetch };
}
