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
    const { ts } = JSON.parse(raw) as { ts: number };
    if (Date.now() - ts < SYNC_LOCK_TIMEOUT) return false;
  }
  localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({ ts: Date.now() }));
  return true;
}

function releaseVoucherLock() {
  localStorage.removeItem(SYNC_LOCK_KEY);
}

function resetStuckVoucherItems() {
  const queue = getVoucherQueue();
  // Ignora o reset apenas se houver um lock RECENTE; um lock expirado (sync anterior
  // interrompido) deve ser tratado como ausente para reclamar itens presos em "syncing".
  const raw = localStorage.getItem(SYNC_LOCK_KEY);
  if (raw) {
    try {
      const { ts } = JSON.parse(raw) as { ts: number };
      if (Date.now() - ts < SYNC_LOCK_TIMEOUT) return;
    } catch {
      /* lock corrompido: trata como ausente */
    }
  }
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
  return stored ? JSON.parse(stored) : [];
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
  // Reclama itens presos ANTES de adquirir o lock (o reset é no-op sob lock recente).
  resetStuckVoucherItems();
  if (!acquireVoucherLock()) return { count: 0, conflicts: 0 };

  const queue = getVoucherQueue();
  const pending = queue.filter(i => i.status === "pending" || i.status === "failed");
  if (pending.length === 0) {
    releaseVoucherLock(); // libera o lock adquirido acima; senão vazaria até o timeout
    return { count: 0, conflicts: 0 };
  }

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
  releaseVoucherLock();
  // Mantém conflitos para resolução manual no PWA
  saveVoucherQueue(getVoucherQueue().filter(i => i.status !== "synced"));
  return { count: syncedCount, conflicts: conflictCount };
};
