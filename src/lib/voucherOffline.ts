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
  status: "pending" | "synced" | "conflict";
  conflict_reason?: string;
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

export const syncVoucherQueue = async () => {
  const queue = getVoucherQueue();
  const pending = queue.filter(i => i.status === "pending");
  if (pending.length === 0) return { count: 0, conflicts: 0 };

  let syncedCount = 0;
  let conflictCount = 0;
  const updatedQueue = [...queue];

  for (const item of pending) {
    try {
      const { data, error } = await supabase.rpc("redeem_voucher" as any, {
        p_qr_value: item.qr_value,
        p_service_kind: item.service_kind,
        p_context_id: item.context_id,
        p_is_offline: true,
        p_offline_at: item.attempted_at
      });

      const res = data as VoucherRedeemResult;
      const idx = updatedQueue.findIndex(i => i.id === item.id);

      if (error || !res.ok) {
        updatedQueue[idx].status = "conflict";
        updatedQueue[idx].conflict_reason = res?.reason || error?.message || "unknown";
        conflictCount++;
      } else {
        updatedQueue[idx].status = "synced";
        syncedCount++;
      }
    } catch (err) {
      console.error("Erro ao sincronizar voucher offline", err);
    }
  }

  // Mantém conflitos para resolução manual no PWA
  saveVoucherQueue(updatedQueue.filter(i => i.status !== "synced"));
  return { count: syncedCount, conflicts: conflictCount };
};
