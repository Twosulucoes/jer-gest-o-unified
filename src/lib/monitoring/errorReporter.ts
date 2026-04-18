import { supabase } from "@/integrations/supabase/client";

let installed = false;
const queue: Array<Record<string, unknown>> = [];
let flushing = false;

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      flushing = false;
      return;
    }
    const batch = queue.splice(0, queue.length).map((e) => ({
      source: "frontend" as const,
      message: String(e.message ?? "unknown"),
      severity: (e.severity as string) ?? "error",
      stack: e.stack as string | undefined,
      url: e.url as string | undefined,
      user_agent: e.user_agent as string | undefined,
      context: (e.context ?? {}) as Record<string, unknown>,
      user_id: user.id,
      user_email: user.email ?? null,
    }));
    await supabase.from("monitoring_errors").insert(batch as never);
  } catch (err) {
    console.warn("[monitor] failed to flush errors", err);
  } finally {
    flushing = false;
  }
}

export function reportError(payload: {
  message: string;
  stack?: string;
  severity?: "info" | "warning" | "error" | "critical";
  context?: Record<string, unknown>;
}) {
  queue.push({
    source: "frontend",
    severity: payload.severity ?? "error",
    message: payload.message.slice(0, 1000),
    stack: payload.stack?.slice(0, 4000),
    url: window.location.href,
    user_agent: navigator.userAgent,
    context: payload.context ?? {},
  });
  void flush();
}

export function installErrorReporter() {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (e) => {
    if (!e.message) return;
    // Ignora chunk loading errors (já tratados separadamente)
    if (/dynamically imported module|Importing a module script failed/i.test(e.message)) return;
    reportError({
      message: e.message,
      stack: e.error?.stack,
      severity: "error",
      context: { filename: e.filename, line: e.lineno, col: e.colno },
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const msg = reason?.message || String(reason ?? "Unhandled rejection");
    reportError({
      message: `[unhandledrejection] ${msg}`,
      stack: reason?.stack,
      severity: "error",
    });
  });

  // Flush periódico
  setInterval(() => void flush(), 10000);
}
