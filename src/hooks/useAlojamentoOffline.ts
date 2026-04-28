import { useState, useEffect, useCallback, useRef } from "react";
import { rpcCheckin, rpcCheckout, rpcAssignBed, rpcRegisterPresence, getDeviceId } from "./useAlojamento";
import { toast } from "sonner";

export interface OfflineOp {
  op_id: string;
  type: "checkin" | "checkout" | "assign" | "incident_create" | "presence";
  payload: Record<string, any>;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: "pending" | "syncing" | "failed";
}

const STORAGE_KEY = "jer_alj_offline_queue";

export function getAlojamentoQueue(): OfflineOp[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: OfflineOp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useAlojamentoOffline() {
  const [queue, setQueue] = useState<OfflineOp[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncingRef = useRef(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const enqueue = useCallback((type: OfflineOp["type"], payload: Record<string, any>) => {
    const op: OfflineOp = {
      op_id: crypto.randomUUID(),
      type,
      payload,
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
      status: "pending",
    };
    setQueue((prev) => {
      const next = [...prev, op];
      saveQueue(next);
      return next;
    });
    return op.op_id;
  }, []);

  const removeOp = useCallback((opId: string) => {
    setQueue((prev) => {
      const next = prev.filter((o) => o.op_id !== opId);
      saveQueue(next);
      return next;
    });
  }, []);

  const syncOne = useCallback(async (op: OfflineOp): Promise<boolean> => {
    const deviceId = getDeviceId();
    try {
      let result: any;
      if (op.type === "checkin") {
        result = await rpcCheckin(deviceId, op.payload.token, op.payload.location_id || op.payload.facility_id, op.payload.unit_id, op.payload.mode || "person_qr");
      } else if (op.type === "checkout") {
        result = await rpcCheckout(deviceId, op.payload.token, op.payload.location_id || op.payload.facility_id);
      } else if (op.type === "assign") {
        result = await rpcAssignBed(deviceId, op.payload.person_token, op.payload.bed_token);
      } else if (op.type === "presence") {
        result = await rpcRegisterPresence(deviceId, op.payload.token, op.payload.unit_id, op.payload.mode || "person_qr");
      }
      if (result && !result.ok) {
        // Definitive error (business rule)
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    const pending = loadQueue().filter((o) => o.status === "pending" || o.status === "failed");

    for (const op of pending) {
      const success = await syncOne(op);
      if (success) {
        setQueue((prev) => {
          const next = prev.filter((o) => o.op_id !== op.op_id);
          saveQueue(next);
          return next;
        });
        toast.success(`Operação ${op.type} sincronizada`);
      } else {
        setQueue((prev) => {
          const next = prev.map((o) =>
            o.op_id === op.op_id ? { ...o, attempts: o.attempts + 1, status: "failed" as const, last_error: "Falha ao sincronizar" } : o
          );
          saveQueue(next);
          return next;
        });
      }
    }
    syncingRef.current = false;
  }, [syncOne]);

  // Auto-sync every 30s when online
  useEffect(() => {
    if (!isOnline) return;
    syncAll();
    const interval = setInterval(syncAll, 30000);
    return () => clearInterval(interval);
  }, [isOnline, syncAll]);

  const pendingCount = queue.filter((o) => o.status === "pending" || o.status === "failed").length;

  return { queue, pendingCount, isOnline, enqueue, removeOp, syncAll };
}
