import { supabase } from "@/integrations/supabase/client";

export interface PwaTelemetryEvent {
  action: "redirect_single_module" | "route_not_found" | "forced_config_redirect" | "access_denied" | "invalid_resource_access";
  path?: string;
  target_path?: string;
  reason?: string;
  metadata?: any;
  event_id?: string | null;
  stage_id?: string | null;
}

/**
 * Logs a PWA telemetry event to the database for monitoring and regression detection.
 */
export async function logPwaEvent(event: PwaTelemetryEvent) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // We only log if there is a session, as the table has RLS for auth.uid()
    if (!session?.user) {
      console.warn("PWA Telemetry: No active session, skipping log.", event);
      return;
    }

    const { error } = await supabase.from("pwa_telemetry").insert({
      user_id: session.user.id,
      action: event.action,
      path: event.path || window.location.pathname,
      target_path: event.target_path,
      reason: event.reason,
      metadata: event.metadata || {},
      event_id: event.event_id,
      stage_id: event.stage_id,
    });

    if (error) {
      console.error("Error saving PWA telemetry:", error);
    } else {
      console.info(`PWA Telemetry [${event.action}]:`, event);
    }
  } catch (err) {
    console.error("Unexpected error in PWA telemetry:", err);
  }
}
