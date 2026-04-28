import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type OfflineQueueItem = {
  id: string;
  module: "alimentacao" | "transporte";
  data: any;
  timestamp: string;
  participantName?: string;
};

const STORAGE_KEY = "pwa_offline_queue";

export const getOfflineQueue = (): OfflineQueueItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveOfflineQueue = (queue: OfflineQueueItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const addToOfflineQueue = (module: "alimentacao" | "transporte", data: any, participantName?: string) => {
  const queue = getOfflineQueue();
  const newItem: OfflineQueueItem = {
    id: crypto.randomUUID(),
    module,
    data,
    timestamp: new Date().toISOString(),
    participantName,
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

export const syncOfflineQueue = async () => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: true, count: 0 };

  let successCount = 0;
  let errorCount = 0;

  for (const item of queue) {
    try {
      if (item.module === "alimentacao") {
        const { error } = await supabase.from("meal_consumptions").insert(item.data);
        if (error) {
          // If it's a "already registered" error, record incident and remove from queue
          if (error.code === "23505") { // Unique violation
             await (supabase as any).from("meal_incidents").insert({
               meal_window_id: item.data.meal_window_id,
               incident_type: 'DUPLICATE',
               participant_id: item.data.participant_id,
               registered_by: item.data.registered_by,
               is_offline: true,
               incident_at: item.timestamp,
               device_info: { offline_sync: true }
             });
             removeFromOfflineQueue(item.id);
             successCount++;
             continue;
          }
          throw error;
        }
      } else if (item.module === "transporte") {
        const { data: existing } = await supabase
          .from("transport_passengers")
          .select("id")
          .eq("trip_id", item.data.trip_id)
          .eq("participant_id", item.data.participant_id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("transport_passengers")
            .update({ 
              status: item.data.status, 
              boarded_at: item.data.boarded_at, 
              boarded_by: item.data.boarded_by 
            })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("transport_passengers").insert(item.data);
          if (error) throw error;
        }
      }
      
      removeFromOfflineQueue(item.id);
      successCount++;
    } catch (err) {
      console.error(`Error syncing item ${item.id}:`, err);
      errorCount++;
    }
  }

  return { success: errorCount === 0, count: successCount, errors: errorCount };
};

export const isOnline = () => {
  return navigator.onLine;
};