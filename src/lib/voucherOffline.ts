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
const SYNC_LOCK_KEY = "pwa_voucher_queue_sync_lock";
const SYNC_LOCK_TIMEOUT = 5 * 60 * 1000;

function acquireVoucherLock(): boolean {
  const raw = localStorage.getItem(SYNC_LOCK_KEY);
  if (raw) {
    try {
      const { ts } = JSON.parse(raw) as { ts: number };
      if (Date.now() - ts < SYNC_LOCK_TIMEOUT) return false;
    } catch {
      // Corrupted lock data — remove and proceed to acquire
    }
  }
  localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({ ts: Date.now() }));
  return true;
}

function releaseVoucherLock() {
  localStorage.removeItem(SYNC_LOCK_KEY);
}

function resetStuckVoucherItems() {
  const queue = getVoucherQueue();
  const hasLock = !!localStorage.getItem(SYNC_LOCK_KEY);
  if (hasLock) return;
  const changed = queue.map((item) =>
    item.status === "syncing" ? { ...item, status: "failed" as const, last_error: "Sync interrompido" } : item,
  );
  if (changed.some((i, idx) => i.status !== queue[idx].status)) {
    saveVoucherQueue(changed);
  }
}

export const getVoucherQueue = (): VoucherOfflineItem[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as VoucherOfflineItem[];
  } catch {
    return [];
  }
};

export const saveVoucherQueue = (queue: VoucherOfflineItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const trimmed = queue.filter((i) => i.status === "pending" || i.status === "conflict");
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* sem espaço */ }
    }
  }
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

  resetStuckVoucherItems();

  if (!acquireVoucherLock()) return { count: 0, conflicts: 0 };

  const queue = getVoucherQueue();
  const pending = queue.filter(i => i.status === "pending" || i.status === "failed");
  if (pending.length === 0) {
    releaseVoucherLock();
    return { count: 0, conflicts: 0 };
  }

  isVoucherSyncing = true;
  let syncedCount = 0;
  let conflictCount = 0;

  for (const item of pending) {
    // Re-read fresh from localStorage before each status update
    const currentQueue = getVoucherQueue();
    const idx = currentQueue.findIndex(i => i.id === item.id);
    if (idx === -1) continue;

    currentQueue[idx].status = "syncing";
    saveVoucherQueue(currentQueue);

    try {
      const { data, error } = await supabase.rpc("redeem_voucher" as any, {
        p_qr_value: item.qr_value,
        p_service_kind: item.service_kind,
        p_context_id: item.context_id,
        p_is_offline: true,
        p_offline_at: item.attempted_at,
      });

      const res = data as VoucherRedeemResult;

      if (error || !res.ok) {
        const afterQueue = getVoucherQueue();
        const afterIdx = afterQueue.findIndex(i => i.id === item.id);
        if (afterIdx !== -1) {
          afterQueue[afterIdx].status = "conflict";
          afterQueue[afterIdx].conflict_reason = res?.reason || error?.message || "unknown";
          afterQueue[afterIdx].conflict_context = {
            used_at: res?.used_at,
            operator_name: res?.operator_name,
            ...res
          };
          saveVoucherQueue(afterQueue);
        }
        conflictCount++;
      } else {
        const afterQueue = getVoucherQueue();
        const afterIdx = afterQueue.findIndex(i => i.id === item.id);
        if (afterIdx !== -1) {
          afterQueue[afterIdx].status = "synced";
          saveVoucherQueue(afterQueue);
        }
        syncedCount++;
      }
    } catch (err: any) {
      console.error("Erro ao sincronizar voucher offline", err);
      const afterQueue = getVoucherQueue();
      const afterIdx = afterQueue.findIndex(i => i.id === item.id);
      if (afterIdx !== -1) {
        afterQueue[afterIdx].attempts += 1;
        afterQueue[afterIdx].last_error = err.message || "Erro de conexão";

        if (afterQueue[afterIdx].attempts >= 5) {
          afterQueue[afterIdx].status = "conflict";
          afterQueue[afterIdx].conflict_reason = "Limite de tentativas excedido.";
        } else {
          afterQueue[afterIdx].status = "failed";
        }
        saveVoucherQueue(afterQueue);
      }
    }
  }

  isVoucherSyncing = false;
  releaseVoucherLock();
  // Mantém conflitos para resolução manual no PWA
  saveVoucherQueue(getVoucherQueue().filter(i => i.status !== "synced"));
  return { count: syncedCount, conflicts: conflictCount };
};
