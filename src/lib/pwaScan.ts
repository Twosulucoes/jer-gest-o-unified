/**
 * Utilitários locais para scans PWA.
 * - Preferências persistidas por usuário (modo contínuo, delay de reabertura).
 * - Telemetria diária (contadores OK/erro/total) em localStorage.
 *
 * Tudo é client-side e tolerante a falhas — nunca lança.
 */

export type ScanModule = "transporte" | "alimentacao" | "alojamento";

export interface ScanPreferences {
  continuousMode: boolean;
  reopenDelayMs: number;
}

export interface ScanTelemetry {
  date: string; // YYYY-MM-DD
  ok: number;
  error: number;
  total: number;
}

const DEFAULT_PREFS: ScanPreferences = {
  continuousMode: true,
  reopenDelayMs: 450,
};

export const REOPEN_DELAY_OPTIONS = [
  { value: 300, label: "Rápido (0,3s)" },
  { value: 450, label: "Normal (0,45s)" },
  { value: 800, label: "Calmo (0,8s)" },
  { value: 1500, label: "Lento (1,5s)" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

const prefsKey = (module: ScanModule, userId?: string | null) =>
  `pwaScan:prefs:${module}:${userId ?? "anon"}`;

const telemetryKey = (module: ScanModule, userId?: string | null) =>
  `pwaScan:telemetry:${module}:${userId ?? "anon"}`;

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage cheio / privado: ignora */
  }
};

export function loadScanPreferences(module: ScanModule, userId?: string | null): ScanPreferences {
  const raw = safeGet(prefsKey(module, userId));
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<ScanPreferences>;
    return {
      continuousMode: parsed.continuousMode ?? DEFAULT_PREFS.continuousMode,
      reopenDelayMs: parsed.reopenDelayMs ?? DEFAULT_PREFS.reopenDelayMs,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveScanPreferences(
  module: ScanModule,
  prefs: ScanPreferences,
  userId?: string | null,
): void {
  safeSet(prefsKey(module, userId), JSON.stringify(prefs));
}

export function loadScanTelemetry(module: ScanModule, userId?: string | null): ScanTelemetry {
  const raw = safeGet(telemetryKey(module, userId));
  const fresh: ScanTelemetry = { date: today(), ok: 0, error: 0, total: 0 };
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw) as ScanTelemetry;
    if (parsed.date !== today()) return fresh; // reseta diariamente
    return {
      date: parsed.date,
      ok: parsed.ok ?? 0,
      error: parsed.error ?? 0,
      total: parsed.total ?? 0,
    };
  } catch {
    return fresh;
  }
}

export function bumpScanTelemetry(
  module: ScanModule,
  outcome: "ok" | "error",
  userId?: string | null,
): ScanTelemetry {
  const current = loadScanTelemetry(module, userId);
  const next: ScanTelemetry = {
    date: current.date,
    ok: current.ok + (outcome === "ok" ? 1 : 0),
    error: current.error + (outcome === "error" ? 1 : 0),
    total: current.total + 1,
  };
  safeSet(telemetryKey(module, userId), JSON.stringify(next));
  return next;
}

export function resetScanTelemetry(module: ScanModule, userId?: string | null): ScanTelemetry {
  const fresh: ScanTelemetry = { date: today(), ok: 0, error: 0, total: 0 };
  safeSet(telemetryKey(module, userId), JSON.stringify(fresh));
  return fresh;
}
