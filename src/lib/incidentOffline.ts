import { supabase } from "@/integrations/supabase/client";

/**
 * Fila offline de meal_incidents.
 *
 * Auditoria PWA Alimentação (bloqueador 3): recusas (sem credencial,
 * inativo, NEEDS_MEALS_FALSE, LEFT_EVENT, voucher inválido etc.) ficavam
 * sem trilha quando o operador estava offline porque `recordIncident`
 * fazia early-return em `!isOnline()`. Esta fila persiste a tentativa
 * com `incident_at` original e flusha ao voltar online via
 * `record_meal_incident` (RPC SECURITY DEFINER que respeita auth.uid()).
 */

export type IncidentQueueItem = {
  id: string;
  meal_window_id: string;
  incident_type: string;
  participant_id: string | null;
  incident_at: string;
  device_info: Record<string, unknown> | null;
  attempts: number;
  status: "pending" | "syncing" | "synced" | "failed";
  last_error?: string;
};

const STORAGE_KEY = "pwa_meal_incident_offline_queue";
const MAX_ATTEMPTS = 5;

export function getIncidentQueue(): IncidentQueueItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as IncidentQueueItem[];
  } catch {
    return [];
  }
}

function saveIncidentQueue(queue: IncidentQueueItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueIncident(input: {
  meal_window_id: string;
  incident_type: string;
  participant_id?: string | null;
  device_info?: Record<string, unknown> | null;
}): IncidentQueueItem {
  const item: IncidentQueueItem = {
    id: crypto.randomUUID(),
    meal_window_id: input.meal_window_id,
    incident_type: input.incident_type,
    participant_id: input.participant_id ?? null,
    incident_at: new Date().toISOString(),
    device_info: input.device_info ?? null,
    attempts: 0,
    status: "pending",
  };
  const queue = getIncidentQueue();
  queue.push(item);
  saveIncidentQueue(queue);
  return item;
}

let isSyncing = false;

export async function syncIncidentQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  if (isSyncing || typeof navigator === "undefined" || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  const pending = getIncidentQueue().filter(
    (i) => i.status === "pending" || i.status === "failed",
  );
  if (pending.length === 0) return { synced: 0, failed: 0 };

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    // Re-leitura defensiva do storage entre iterações: outra aba/sync
    // pode ter mexido na fila. Abortamos o item se sumiu.
    const cur = getIncidentQueue();
    const idx = cur.findIndex((i) => i.id === item.id);
    if (idx === -1) continue;
    cur[idx].status = "syncing";
    saveIncidentQueue(cur);

    try {
      const { error } = await (supabase as any).rpc("record_meal_incident", {
        p_meal_window_id: item.meal_window_id,
        p_incident_type: item.incident_type,
        p_participant_id: item.participant_id,
        p_is_offline: true,
        p_incident_at: item.incident_at,
        p_device_info: item.device_info,
      });
      if (error) throw error;
      const after = getIncidentQueue().filter((i) => i.id !== item.id);
      saveIncidentQueue(after);
      synced++;
    } catch (err) {
      const after = getIncidentQueue();
      const j = after.findIndex((i) => i.id === item.id);
      if (j !== -1) {
        after[j].attempts += 1;
        after[j].last_error = (err as Error)?.message ?? "erro desconhecido";
        after[j].status = after[j].attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        saveIncidentQueue(after);
      }
      failed++;
    }
  }

  isSyncing = false;
  return { synced, failed };
}

export function getPendingIncidentCount(): number {
  return getIncidentQueue().filter(
    (i) => i.status === "pending" || i.status === "failed",
  ).length;
}
