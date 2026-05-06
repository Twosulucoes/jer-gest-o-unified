import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import {
  addToOfflineQueue,
  clearOfflineQueue,
  getOfflineQueue,
  purgeExpiredOfflineItems,
  OFFLINE_QUEUE_TTL_MS,
  saveOfflineQueue,
} from "./offlineQueue";

describe("purgeExpiredOfflineItems", () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  it("marks items older than TTL as conflict", () => {
    addToOfflineQueue("alimentacao", { meal_window_id: "w1", participant_id: "p1" });

    const queue = getOfflineQueue();
    const old = new Date(Date.now() - OFFLINE_QUEUE_TTL_MS - 1000).toISOString();
    queue[0].timestamp = old;
    saveOfflineQueue(queue);

    const result = purgeExpiredOfflineItems();
    expect(result.expired).toBe(1);

    const after = getOfflineQueue();
    expect(after[0].status).toBe("conflict");
    expect(after[0].lastError).toMatch(/expirado/i);
  });

  it("leaves fresh items untouched", () => {
    addToOfflineQueue("transporte", {
      trip_id: "t1",
      participant_id: "p1",
      status: "boarded",
      boarded_at: new Date().toISOString(),
      boarded_by: "u1",
    });

    const result = purgeExpiredOfflineItems();
    expect(result.expired).toBe(0);

    const after = getOfflineQueue();
    expect(after[0].status).toBe("pending");
  });

  it("does not re-process items already in conflict", () => {
    addToOfflineQueue("alimentacao", { meal_window_id: "w2", participant_id: "p2" });
    const queue = getOfflineQueue();
    queue[0].status = "conflict";
    queue[0].lastError = "outro motivo";
    queue[0].timestamp = new Date(Date.now() - OFFLINE_QUEUE_TTL_MS - 1000).toISOString();
    saveOfflineQueue(queue);

    const result = purgeExpiredOfflineItems();
    expect(result.expired).toBe(0);
    expect(getOfflineQueue()[0].lastError).toBe("outro motivo");
  });

  it("respects custom TTL argument", () => {
    addToOfflineQueue("alimentacao", { meal_window_id: "w3", participant_id: "p3" });
    const queue = getOfflineQueue();
    queue[0].timestamp = new Date(Date.now() - 60_000).toISOString();
    saveOfflineQueue(queue);

    const result = purgeExpiredOfflineItems(30_000);
    expect(result.expired).toBe(1);
  });
});
