import { supabase } from "@/integrations/supabase/client";
import { ServiceKind, VoucherRedeemResult } from "./voucherScan";

export interface VoucherOfflineItem {
  id: string;
  qr_value: string;
  service_kind: ServiceKind;
  context_id: string;
  attempted_at: string;
  attempted_by: string;
  person_name?: string;
  status: "pending" | "synced" | "conflict" | "syncing" | "failed";
  attempts: number;
  last_error?: string;
  conflict_reason?: string;
  conflict_context?: Record<string, any>;
  resolved_at?: string;
}

const STORAGE_KEY = "pwa_voucher_offline_queue";

export const getVoucherQueue = (): VoucherOfflineItem[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveVoucherQueue = (queue: VoucherOfflineItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

export const addToVoucherQueue = (
  qr_value: string,
  service_kind: ServiceKind,
  context_id: string,
  userId: string,
  person_name?: string
) => {
  const queue = getVoucherQueue();
  const newItem: VoucherOfflineItem = {
    id: crypto.randomUUID(),
    qr_value,
    service_kind,
    context_id,
    attempted_at: new Date().toISOString(),
    attempted_by: userId,
    person_name,
    status: "pending",
    attempts: 0,
  };
  queue.push(newItem);
  saveVoucherQueue(queue);
  return newItem;
};

export const resolveVoucherConflict = (itemId: string, action: "resolved" | "discard") => {
  const queue = getVoucherQueue();
  const idx = queue.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  if (action === "discard") {
    queue.splice(idx, 1);
  } else {
    queue[idx].status = "synced"; // Marcamos como sincronizado/resolvido para sair da lista de conflitos
    queue[idx].resolved_at = new Date().toISOString();
  }
  saveVoucherQueue(queue);
};

let isVoucherSyncing = false;

export const syncVoucherQueue = async () => {
  if (isVoucherSyncing || !navigator.onLine) return { count: 0, conflicts: 0 };
  
  const queue = getVoucherQueue();
  const pending = queue.filter(i => i.status === "pending" || i.status === "failed");
  if (pending.length === 0) return { count: 0, conflicts: 0 };

  isVoucherSyncing = true;
  let syncedCount = 0;
  let conflictCount = 0;
  const updatedQueue = [...queue];

  for (const item of pending) {
    const idx = updatedQueue.findIndex(i => i.id === item.id);
    updatedQueue[idx].status = "syncing";
    saveVoucherQueue(updatedQueue);

    try {
      const { data, error } = await supabase.rpc("redeem_voucher" as any, {
        p_qr_value: item.qr_value,
        p_service_kind: item.service_kind,
        p_context_id: item.context_id,
        p_is_offline: true,
        p_offline_at: item.attempted_at,
        p_metadata: {
          offline_id: item.id,
          attempted_by: item.attempted_by,
          person_name: item.person_name
        }
      });

      const res = data as VoucherRedeemResult;

      if (error || !res.ok) {
        updatedQueue[idx].status = "conflict";
        updatedQueue[idx].conflict_reason = res?.reason || error?.message || "unknown";
        updatedQueue[idx].conflict_context = {
          used_at: res?.used_at,
          operator_name: res?.operator_name,
          ...res
        };
        conflictCount++;
      } else {
        updatedQueue[idx].status = "synced";
        syncedCount++;
      }
      saveVoucherQueue(updatedQueue);
    } catch (err: any) {
      console.error("Erro ao sincronizar voucher offline", err);
      updatedQueue[idx].attempts += 1;
      updatedQueue[idx].last_error = err.message || "Erro de conexão";
      
      if (updatedQueue[idx].attempts >= 5) {
        updatedQueue[idx].status = "conflict";
        updatedQueue[idx].conflict_reason = "Limite de tentativas excedido.";
      } else {
        updatedQueue[idx].status = "failed";
      }
      saveVoucherQueue(updatedQueue);
    }
  }

  isVoucherSyncing = false;
  // Mantém conflitos para resolução manual no PWA
  saveVoucherQueue(getVoucherQueue().filter(i => i.status !== "synced"));
  return { count: syncedCount, conflicts: conflictCount };
};
