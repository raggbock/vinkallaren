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

  _resetForTests() {
    items = [];
    hydrated = false;
  },
};
