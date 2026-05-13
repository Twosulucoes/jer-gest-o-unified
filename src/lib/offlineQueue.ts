import { supabase } from "@/integrations/supabase/client";

const SYNC_LOCK_KEY = "pwa_offline_queue_sync_lock";
const SYNC_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 min

function acquireSyncLock(): boolean {
  const raw = localStorage.getItem(SYNC_LOCK_KEY);
  if (raw) {
    const { ts } = JSON.parse(raw) as { ts: number };
    if (Date.now() - ts < SYNC_LOCK_TIMEOUT) return false;
  }
  localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({ ts: Date.now() }));
  return true;
}

function releaseSyncLock() {
  localStorage.removeItem(SYNC_LOCK_KEY);
}

function resetStuckSyncingItems() {
  const queue = getOfflineQueue();
  const lock = localStorage.getItem(SYNC_LOCK_KEY);
  if (lock) return; // lock ativo, outra aba ainda está sincronizando
  const changed = queue.map((item) =>
    item.status === "syncing" ? { ...item, status: "failed" as const, lastError: "Sync interrompido" } : item,
  );
  if (changed.some((i, idx) => i.status !== queue[idx].status)) {
    saveOfflineQueue(changed);
  }
}

export type OfflineQueueItem = {
  id: string;
  module: "alimentacao" | "transporte";
  data: Record<string, unknown>;
  timestamp: string;
  participantName?: string;
  attempts: number;
  status: "pending" | "syncing" | "failed" | "conflict";
  lastError?: string;
};

const STORAGE_KEY = "pwa_offline_queue";

export const OFFLINE_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const getOfflineQueue = (): OfflineQueueItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const purgeExpiredOfflineItems = (
  ttlMs: number = OFFLINE_QUEUE_TTL_MS,
): { expired: number } => {
  const queue = getOfflineQueue();
  const now = Date.now();
  let expired = 0;
  const next = queue.map((item) => {
    if (item.status === "conflict") return item;
    const age = now - new Date(item.timestamp).getTime();
    if (Number.isFinite(age) && age > ttlMs) {
      expired++;
      return {
        ...item,
        status: "conflict" as const,
        lastError:
          "Item expirado (mais de 7 dias offline). Revise manualmente antes de descartar.",
      };
    }
    return item;
  });
  if (expired > 0) saveOfflineQueue(next);
  return { expired };
};

export const saveOfflineQueue = (queue: OfflineQueueItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      // Remove itens já sincronizados ou conflitos mais antigos para liberar espaço
      const trimmed = queue.filter((i) => i.status === "pending" || i.status === "failed");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // Nada a fazer sem espaço
      }
    }
  }
};

/**
 * Etapa 6 (auditoria Alimentação): deduplicação determinística no ato
 * do enfileiramento. Para o mesmo `meal_window_id + participant_id` na
 * fila de alimentação ainda não sincronizado, mantém o registro original
 * em vez de empilhar duplicatas que iriam colidir no UNIQUE do banco.
 */
function findDuplicateMealItem(
  queue: OfflineQueueItem[],
  data: Record<string, unknown>,
): OfflineQueueItem | undefined {
  const windowId = (data as any)?.meal_window_id;
  const participantId = (data as any)?.participant_id;
  if (!windowId || !participantId) return undefined;
  return queue.find(
    (item) =>
      item.module === "alimentacao" &&
      item.status !== "conflict" &&
      (item.data as any)?.meal_window_id === windowId &&
      (item.data as any)?.participant_id === participantId,
  );
}

export type AddToOfflineQueueResult =
  | { item: OfflineQueueItem; deduped: false }
  | { item: OfflineQueueItem; deduped: true };

export const addToOfflineQueue = (
  module: "alimentacao" | "transporte",
  data: Record<string, unknown>,
  participantName?: string,
): AddToOfflineQueueResult => {
  const queue = getOfflineQueue();

  if (module === "alimentacao") {
    const existing = findDuplicateMealItem(queue, data);
    if (existing) {
      return { item: existing, deduped: true };
    }
  }

  const newItem: OfflineQueueItem = {
    id: crypto.randomUUID(),
    module,
    data,
    timestamp: new Date().toISOString(),
    participantName,
    attempts: 0,
    status: "pending",
  };
  queue.push(newItem);
  saveOfflineQueue(queue);
  return { item: newItem, deduped: false };
};

export const removeFromOfflineQueue = (id: string) => {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveOfflineQueue(filtered);
};

export const clearOfflineQueue = () => {
  localStorage.removeItem(STORAGE_KEY);
};

let isSyncing = false;

export const syncOfflineQueue = async () => {
  if (isSyncing || !navigator.onLine) return { success: false, count: 0 };
  if (!acquireSyncLock()) return { success: false, count: 0 };

  resetStuckSyncingItems();
  purgeExpiredOfflineItems();

  const queue = getOfflineQueue();
  const pending = queue.filter(item => item.status === "pending" || item.status === "failed");
  
  if (pending.length === 0) return { success: true, count: 0 };

  isSyncing = true;
  let successCount = 0;
  let errorCount = 0;
  const updatedQueue = [...queue];

  for (const item of pending) {
    const idx = updatedQueue.findIndex(i => i.id === item.id);
    if (idx === -1) continue;
    
    updatedQueue[idx].status = "syncing";
    saveOfflineQueue(updatedQueue);

    try {
      if (item.module === "alimentacao") {
        const mealData = item.data as { participant_id: string; meal_window_id: string; method: string; registered_by: string };
        const { data: rpcResult, error: rpcError } = await supabase.rpc("record_meal_consumption", {
          p_participant_id: mealData.participant_id,
          p_meal_window_id: mealData.meal_window_id,
          p_method: mealData.method,
          p_registered_by: mealData.registered_by,
        });

        if (rpcError) {
          // 23505 pode ocorrer por race no próprio RPC — tratar como duplicata
          if (rpcError.code === "23505") {
            const finalQueueDup = getOfflineQueue().filter((i) => i.id !== item.id);
            saveOfflineQueue(finalQueueDup);
            errorCount++;
            continue;
          }
          throw rpcError;
        }

        const mealRes = rpcResult as { ok: boolean; reason?: string };

        if (!mealRes.ok) {
          if (mealRes.reason === "ALREADY_REGISTERED") {
            // Registra incidente de duplicata para trilha de auditoria
            try {
              await (supabase as any).rpc("record_meal_incident", {
                p_meal_window_id: mealData.meal_window_id,
                p_incident_type: "DUPLICATE",
                p_participant_id: mealData.participant_id ?? null,
                p_is_offline: true,
                p_incident_at: item.timestamp,
                p_device_info: {
                  source: "offline_queue_sync",
                  attempts: item.attempts,
                  participantName: item.participantName ?? null,
                  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
                },
              });
            } catch (incidentErr) {
              // Se o registro do incidente falhar, mantém como conflict para revisão manual.
              const cur = getOfflineQueue();
              const cIdx = cur.findIndex((i) => i.id === item.id);
              if (cIdx !== -1) {
                cur[cIdx].status = "conflict";
                cur[cIdx].lastError = "Consumo já registrado (falha ao gravar incidente).";
                saveOfflineQueue(cur);
              }
              errorCount++;
              continue;
            }
            const finalQueueDup = getOfflineQueue().filter((i) => i.id !== item.id);
            saveOfflineQueue(finalQueueDup);
            errorCount++;
            continue;
          }

          // Falhas permanentes: participante não inscrito na etapa, janela inválida,
          // data errada, fora do horário, sem elegibilidade — nunca vão sincronizar.
          console.warn("[offlineQueue] Consumo offline descartado:", mealRes.reason);
          const finalQueueBlocked = getOfflineQueue().filter((i) => i.id !== item.id);
          saveOfflineQueue(finalQueueBlocked);
          errorCount++;
          continue;
        }
      } else if (item.module === "transporte") {
        const transportData = item.data as { trip_id: string; participant_id: string; status: string; boarded_at: string; boarded_by: string; is_manual?: boolean };
        const { data: rpcResult, error: rpcError } = await supabase.rpc("record_transport_boarding", {
          p_trip_id: transportData.trip_id,
          p_participant_id: transportData.participant_id,
          p_boarded_by: transportData.boarded_by,
          p_is_manual: transportData.is_manual ?? false,
          p_boarded_at: transportData.boarded_at,
        });

        if (rpcError) {
          if (rpcError.code === "23505") {
            const finalQueueDup = getOfflineQueue().filter((i) => i.id !== item.id);
            saveOfflineQueue(finalQueueDup);
            errorCount++;
            continue;
          }
          throw rpcError;
        }

        const boardingRes = rpcResult as { ok: boolean; reason?: string };
        if (!boardingRes.ok) {
          // Participante não inscrito na etapa: remove da fila (não vai sincronizar nunca).
          console.warn("[offlineQueue] Embarque offline descartado:", boardingRes.reason);
          const finalQueueBlocked = getOfflineQueue().filter((i) => i.id !== item.id);
          saveOfflineQueue(finalQueueBlocked);
          errorCount++;
          continue;
        }
      }
      
      successCount++;
      // Remove success items
      const finalQueue = getOfflineQueue().filter(i => i.id !== item.id);
      saveOfflineQueue(finalQueue);
    } catch (err: unknown) {
      const error = err as Error;
      console.error(`Error syncing item ${item.id}:`, error);
      
      const updatedQueueState = getOfflineQueue();
      const currentIdx = updatedQueueState.findIndex(i => i.id === item.id);
      
      if (currentIdx !== -1) {
        updatedQueueState[currentIdx].attempts += 1;
        updatedQueueState[currentIdx].lastError = error.message || "Erro de conexão";
        
        if (updatedQueueState[currentIdx].attempts >= 5) {
          updatedQueueState[currentIdx].status = "conflict";
          updatedQueueState[currentIdx].lastError = "Limite de tentativas excedido.";
        } else {
          updatedQueueState[currentIdx].status = "failed";
        }
        saveOfflineQueue(updatedQueueState);
      }
      errorCount++;
    }
  }

  isSyncing = false;
  releaseSyncLock();
  return { success: errorCount === 0, count: successCount, errors: errorCount };
};

export const isOnline = () => {
  return navigator.onLine;
};
