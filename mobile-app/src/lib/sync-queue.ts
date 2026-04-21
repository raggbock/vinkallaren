import { offlineStore, K } from "./offline-store";

export type QueueKind =
  | "upsert_session_tasting"
  | "create_session"
  | "add_session_wine"
  | "submit_wset";

export type QueueItem = {
  id: string;
  kind: QueueKind;
  payload: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
  failed?: boolean;
};

export type HandlerResult = { ok: true } | { ok: false; error: string };
export type Handlers = Record<QueueKind, (payload: any) => Promise<HandlerResult>>;

function backoffMs(attempts: number): number {
  const ladder = [1000, 4000, 15000, 60000];
  return attempts < ladder.length ? ladder[attempts] : 5 * 60 * 1000;
}

let items: QueueItem[] = [];
let hydrated = false;

async function persist() {
  await offlineStore.set(K.queue, items);
}

export const syncQueue = {
  async hydrate() {
    if (hydrated) return;
    items = (await offlineStore.get<QueueItem[]>(K.queue)) ?? [];
    hydrated = true;
  },

  async enqueue(input: { kind: QueueKind; payload: any }): Promise<QueueItem> {
    await syncQueue.hydrate();
    const item: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: input.kind,
      payload: input.payload,
      createdAt: Date.now(),
      attempts: 0,
    };
    items.push(item);
    await persist();
    return item;
  },

  async list(): Promise<QueueItem[]> {
    await syncQueue.hydrate();
    return [...items];
  },

  async _remove(id: string) {
    items = items.filter((i) => i.id !== id);
    await persist();
  },

  async _updateAttempts(id: string, error?: string, failed?: boolean) {
    items = items.map((i) =>
      i.id === id ? { ...i, attempts: i.attempts + 1, lastError: error, failed, createdAt: Date.now() } : i,
    );
    await persist();
  },

  async drain(handlers: Handlers): Promise<{ succeeded: number; failed: number }> {
    await syncQueue.hydrate();
    const now = Date.now();
    let succeeded = 0;
    let failed = 0;
    const snapshot = [...items];
    for (const item of snapshot) {
      if (item.failed) continue;
      const nextAttemptAt = item.createdAt + (item.attempts === 0 ? 0 : backoffMs(item.attempts - 1));
      if (now < nextAttemptAt) continue;
      const handler = handlers[item.kind];
      const result = await handler(item.payload);
      if (result.ok) {
        await syncQueue._remove(item.id);
        succeeded++;
      } else {
        const willFail = item.attempts + 1 >= 10;
        await syncQueue._updateAttempts(item.id, result.error, willFail);
        if (willFail) failed++;
      }
    }
    return { succeeded, failed };
  },

  _resetForTests() {
    items = [];
    hydrated = false;
  },
};
