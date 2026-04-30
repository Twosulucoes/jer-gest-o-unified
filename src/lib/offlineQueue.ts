import { supabase } from "@/integrations/supabase/client";

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

export const getOfflineQueue = (): OfflineQueueItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveOfflineQueue = (queue: OfflineQueueItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const addToOfflineQueue = (module: "alimentacao" | "transporte", data: Record<string, unknown>, participantName?: string) => {
  const queue = getOfflineQueue();
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
  return newItem;
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
          if (error.code === "23505") { // Unique violation
             updatedQueue[idx].status = "conflict";
             updatedQueue[idx].lastError = "Consumo já registrado para este período.";
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
      updatedQueue[idx].attempts += 1;
      updatedQueue[idx].lastError = error.message || "Erro de conexão";
      
      if (updatedQueue[idx].attempts >= 5) {
        updatedQueue[idx].status = "conflict";
        updatedQueue[idx].lastError = "Limite de tentativas excedido.";
      } else {
        updatedQueue[idx].status = "failed";
      }
      saveOfflineQueue(updatedQueue);
      errorCount++;
    }
  }

  isSyncing = false;
  return { success: errorCount === 0, count: successCount, errors: errorCount };
};

export const isOnline = () => {
  return navigator.onLine;
};