import { syncQueue } from "../sync-queue";
import { offlineStore, K } from "../offline-store";

beforeEach(async () => {
  await offlineStore.clear();
  syncQueue._resetForTests();
});

describe("syncQueue basic ops", () => {
  test("enqueue persists to storage", async () => {
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    const stored = await offlineStore.get<any[]>(K.queue);
    expect(stored).toHaveLength(1);
    expect(stored![0].kind).toBe("upsert_session_tasting");
    expect(stored![0].attempts).toBe(0);
  });

  test("list returns FIFO order", async () => {
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "b" } });
    const items = await syncQueue.list();
    expect(items.map((i) => i.payload.id)).toEqual(["a", "b"]);
  });

  test("hydrate reads persisted items", async () => {
    await offlineStore.set(K.queue, [{ id: "x", kind: "upsert_session_tasting", payload: {}, createdAt: 1, attempts: 0 }]);
    syncQueue._resetForTests();
    await syncQueue.hydrate();
    expect(await syncQueue.list()).toHaveLength(1);
  });
});
