import { supabase } from "@/integrations/supabase/client";

export type OfflineQueueItem = {
  id: string;
  module: "alimentacao" | "transporte" | "credenciamento";
  data: Record<string, unknown>;
  timestamp: string;
  participantName?: string;
  attempts: number;
  status: "pending" | "syncing" | "failed" | "conflict";
  lastError?: string;
};

const STORAGE_KEY = "pwa_offline_queue";

export const getOfflineQueue = (): OfflineQueueItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveOfflineQueue = (queue: OfflineQueueItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
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

// Dedupe da fila de credenciamento: se já existe item pendente com a
// mesma idempotency_key (caso o operador toque "Vincular" 2x antes do
// online), retorna o existente em vez de empilhar duplicata. A
// idempotency_key também garante no-op no servidor (C5a).
function findDuplicateCredItem(
  queue: OfflineQueueItem[],
  data: Record<string, unknown>,
): OfflineQueueItem | undefined {
  const key = (data as any)?.idempotency_key;
  if (!key) return undefined;
  return queue.find(
    (item) =>
      item.module === "credenciamento" &&
      item.status !== "conflict" &&
      (item.data as any)?.idempotency_key === key,
  );
}

export const addToOfflineQueue = (
  module: "alimentacao" | "transporte" | "credenciamento",
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

  if (module === "credenciamento") {
    const existing = findDuplicateCredItem(queue, data);
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
        const { error } = await supabase.from("meal_consumptions").insert(item.data as any);
        if (error) {
          if (error.code === "23505") {
            // Etapa 6: ao bater no UNIQUE durante o sync (outro operador
            // já registrou o consumo, possivelmente em outro device),
            // gravamos meal_incidents.DUPLICATE marcado como offline e
            // descartamos o item da fila. O consumo "vencedor" continua
            // íntegro no banco; a tentativa offline ganha trilha de
            // auditoria em vez de sumir silenciosamente.
            try {
              const data = item.data as any;
              await (supabase as any).rpc("record_meal_incident", {
                p_meal_window_id: data?.meal_window_id,
                p_incident_type: "DUPLICATE",
                p_participant_id: data?.participant_id ?? null,
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
              // Se o registro do incidente também falhar, mantemos o
              // item como conflict para revisão manual em vez de perdê-lo.
              const cur = getOfflineQueue();
              const cIdx = cur.findIndex((i) => i.id === item.id);
              if (cIdx !== -1) {
                cur[cIdx].status = "conflict";
                cur[cIdx].lastError =
                  "Consumo já registrado para este período (falha ao gravar incidente).";
                saveOfflineQueue(cur);
              }
              errorCount++;
              continue;
            }
            // Sucesso na "resolução": remove da fila local.
            const finalQueueDup = getOfflineQueue().filter((i) => i.id !== item.id);
            saveOfflineQueue(finalQueueDup);
            errorCount++;
            continue;
          }
          throw error;
        }
      } else if (item.module === "credenciamento") {
        // Credenciamento usa RPC link_external_credential com
        // p_idempotency_key. Se a chave já foi consumida no servidor
        // (C5a), o RETURN da RPC é no-op e o item é descartado.
        const credData = item.data as {
          event_id: string;
          participant_id: string;
          credential_code: string;
          replace_id?: string | null;
          is_internal_mode?: boolean;
          idempotency_key: string;
        };
        const { error } = await (supabase as any).rpc("link_external_credential", {
          p_event_id: credData.event_id,
          p_participant_id: credData.participant_id,
          p_credential_code: credData.credential_code,
          p_user_id: null, // RPC sobrescreve com auth.uid() (C2)
          p_replace_id: credData.replace_id ?? null,
          p_is_internal_mode: credData.is_internal_mode ?? false,
          p_idempotency_key: credData.idempotency_key,
        });
        if (error) {
          // Erros de regra de negócio (já vinculada a outro, etc.) são
          // permanentes — vão para conflict e exigem ação manual.
          // Erros de rede/transientes são re-tentáveis.
          const code = String((error as any).code ?? "");
          const isPermanent = code === "23505" || code === "42501" || code === "P0002";
          if (isPermanent) {
            const cur = getOfflineQueue();
            const cIdx = cur.findIndex((i) => i.id === item.id);
            if (cIdx !== -1) {
              cur[cIdx].status = "conflict";
              cur[cIdx].lastError = error.message || "Conflito ao vincular credencial.";
              saveOfflineQueue(cur);
            }
            errorCount++;
            continue;
          }
          throw error;
        }
      } else if (item.module === "transporte") {
        const transportData = item.data as { trip_id: string; participant_id: string; status: string; boarded_at: string; boarded_by: string };
        const { data: existing } = await supabase
          .from("transport_passengers")
          .select("id")
          .eq("trip_id", transportData.trip_id)
          .eq("participant_id", transportData.participant_id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("transport_passengers")
            .update({ 
              status: transportData.status, 
              boarded_at: transportData.boarded_at, 
              boarded_by: transportData.boarded_by 
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("transport_passengers").insert(transportData as any);
          if (error) throw error;
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
  return { success: errorCount === 0, count: successCount, errors: errorCount };
};

export const isOnline = () => {
  return navigator.onLine;
};