import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

/**
 * Hook to monitor component performance and log to Supabase.
 * Stage 4: Escalability and Infrastructure.
 */
export function usePerformanceMonitor(componentName: string, thresholdMs: number = 50) {
  const { user } = useAuth();
  const location = useLocation();
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;

    if (renderTime > thresholdMs) {
      console.warn(`[Performance] Component ${componentName} took ${renderTime.toFixed(2)}ms to render.`);
      
      // Log to database asynchronously
      void supabase.from("performance_logs").insert({
        component_name: componentName,
        render_time_ms: renderTime,
        interaction_type: "render",
        path: location.pathname,
        user_id: user?.id,
        metadata: {
          threshold: thresholdMs,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Reset for next potential render if needed (though usually we monitor mount-to-idle)
    return () => {
      // Optional: Log unmount performance if relevant
    };
  }, [componentName, thresholdMs, user?.id, location.pathname]);
}
