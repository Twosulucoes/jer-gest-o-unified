import { supabase } from "@/integrations/supabase/client";

export type AccessLogAction = "route_access" | "data_access" | "login";
export type AccessLogStatus = "denied" | "error";

export interface AccessLogPayload {
  action: AccessLogAction;
  resource: string;
  status: AccessLogStatus;
  errorCode?: string;
  errorMsg?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a denied or errored access attempt to the access_logs table via the
 * security-definer RPC function. Fails silently — never throws.
 *
 * Call this whenever a Supabase error with code 42501 / PGRST301 is caught,
 * or when route guards block navigation.
 */
export async function logAccessError(payload: AccessLogPayload): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await (supabase.rpc as Function)("log_access_error", {
      p_action: payload.action,
      p_resource: payload.resource,
      p_status: payload.status,
      p_error_code: payload.errorCode ?? null,
      p_error_msg: payload.errorMsg?.slice(0, 500) ?? null,
      p_metadata: payload.metadata ?? null,
    });
  } catch {
    // intentionally silent — access logging must never break the app
  }
}

/** Returns true if the Supabase/PostgREST error is a permission denial. */
export function isPermissionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const code = String(e.code ?? "");
  const message = String(e.message ?? "").toLowerCase();
  return (
    code === "42501" ||
    code === "PGRST301" ||
    message.includes("insufficient_privilege") ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

/**
 * Convenience: if the Supabase response has a permission error, log it and
 * return true (so callers can show a friendly message).
 */
export async function handleSupabasePermissionError(
  error: unknown,
  resource: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  if (!isPermissionError(error)) return false;
  const e = error as Record<string, unknown>;
  await logAccessError({
    action: "data_access",
    resource,
    status: "denied",
    errorCode: String(e.code ?? ""),
    errorMsg: String(e.message ?? ""),
    metadata,
  });
  return true;
}
