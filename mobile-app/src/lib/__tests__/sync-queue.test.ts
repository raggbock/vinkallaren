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

describe("drain", () => {
  test("successful handler removes item", async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true });
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    await syncQueue.drain({ upsert_session_tasting: handler, create_session: jest.fn(), add_session_wine: jest.fn(), submit_wset: jest.fn() });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await syncQueue.list()).toHaveLength(0);
  });

  test("handler failure keeps item and records lastError", async () => {
    const handler = jest.fn().mockResolvedValue({ ok: false, error: "rls denied" });
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    await syncQueue.drain({ upsert_session_tasting: handler, create_session: jest.fn(), add_session_wine: jest.fn(), submit_wset: jest.fn() });
    const list = await syncQueue.list();
    expect(list).toHaveLength(1);
    expect(list[0].attempts).toBe(1);
    expect(list[0].lastError).toBe("rls denied");
  });

  test("after 10 failures item is marked failed and skipped", async () => {
    const handler = jest.fn().mockResolvedValue({ ok: false, error: "x" });
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    const handlers = { upsert_session_tasting: handler, create_session: jest.fn(), add_session_wine: jest.fn(), submit_wset: jest.fn() };
    const realNow = Date.now;
    let t = realNow();
    jest.spyOn(Date, "now").mockImplementation(() => t);
    for (let i = 0; i < 11; i++) {
      await syncQueue.drain(handlers);
      t += 10 * 60 * 1000;
    }
    (Date.now as jest.Mock).mockRestore();
    expect(handler).toHaveBeenCalledTimes(10);
    const list = await syncQueue.list();
    expect(list[0].failed).toBe(true);
  });

  test("backoff prevents drain running item too soon", async () => {
    const handler = jest.fn().mockResolvedValue({ ok: false, error: "x" });
    const handlers = { upsert_session_tasting: handler, create_session: jest.fn(), add_session_wine: jest.fn(), submit_wset: jest.fn() };
    await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: { id: "a" } });
    await syncQueue.drain(handlers);
    await syncQueue.drain(handlers);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
