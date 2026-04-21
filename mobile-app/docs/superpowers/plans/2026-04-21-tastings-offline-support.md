# Offline-stöd för vinprovningar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline-first för grupp-provningar (`tasting_sessions`) och WSET-solo-provningar via `tasting-session-modal`.

**Architecture:** Thin cross-platform key-value store (AsyncStorage på RN, localStorage på web). FIFO-kö med exponentiell backoff drainas vid online+foreground. Optimistiska skrivningar via befintliga hooks; realtime-subscriptions pausas när offline.

**Tech Stack:** React Native + Expo, TypeScript, Supabase JS v2, `@react-native-async-storage/async-storage` (redan installerat), Jest + React Testing Library (befintlig test-setup).

**Spec:** `mobile-app/docs/superpowers/specs/2026-04-21-tastings-offline-support-design.md`

---

## File Structure

**Create:**
- `mobile-app/src/lib/offline-store.ts` — KV-wrapper över AsyncStorage/localStorage (~80 rader)
- `mobile-app/src/lib/sync-queue.ts` — FIFO-kö, backoff, drain mot Supabase (~180 rader)
- `mobile-app/src/lib/sync-handlers.ts` — per-kind handler-mapping (~80 rader)
- `mobile-app/src/hooks/useOnlineStatus.ts` — NetInfo+navigator.onLine, auto-drain (~60 rader)
- `mobile-app/src/components/offline-badge.tsx` — visningskomponent (~40 rader)
- `mobile-app/src/lib/__tests__/offline-store.test.ts`
- `mobile-app/src/lib/__tests__/sync-queue.test.ts`
- `mobile-app/src/hooks/__tests__/useOnlineStatus.test.tsx`

**Modify:**
- `mobile-app/src/lib/session-actions.ts` — lägg till `queueSaveTasting`, `queueCreateSession`, `queueAddWineToSession` (cirka +80 rader, deprecate inget)
- `mobile-app/src/hooks/useTastingSessions.ts` — läs cache först, skriv via kö, pausa realtime offline
- `mobile-app/src/components/tasting-session-modal.tsx` — auto-spara WSET-draft
- `mobile-app/App.tsx` — montera offline-badge globalt

---

## Task 1: Offline KV-store

**Files:**
- Create: `mobile-app/src/lib/offline-store.ts`
- Test: `mobile-app/src/lib/__tests__/offline-store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// mobile-app/src/lib/__tests__/offline-store.test.ts
import { offlineStore } from "../offline-store";

describe("offlineStore", () => {
  beforeEach(async () => {
    await offlineStore.clear();
  });

  test("get returns null for missing key", async () => {
    expect(await offlineStore.get("missing")).toBeNull();
  });

  test("set then get roundtrips JSON", async () => {
    await offlineStore.set("k", { a: 1, b: "x" });
    expect(await offlineStore.get("k")).toEqual({ a: 1, b: "x" });
  });

  test("remove deletes a key", async () => {
    await offlineStore.set("k", 1);
    await offlineStore.remove("k");
    expect(await offlineStore.get("k")).toBeNull();
  });

  test("corrupt JSON returns null rather than throwing", async () => {
    // Simulate corruption by writing raw
    const mod = await import("@react-native-async-storage/async-storage");
    await (mod.default as any).setItem("k", "{not json");
    expect(await offlineStore.get("k")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `cd mobile-app && npx jest src/lib/__tests__/offline-store.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `offline-store.ts`**

```ts
// mobile-app/src/lib/offline-store.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage has a web shim that uses localStorage, so one API works for both.
export const offlineStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};

export const K = {
  sessions: "tasting:sessions",
  sessionWines: (id: string) => `tasting:session:${id}:wines`,
  sessionTastings: (id: string) => `tasting:session:${id}:tastings`,
  queue: "tasting:queue",
  wsetDraft: (wineId: string) => `wset:draft:${wineId}`,
  lastSync: (id: string) => `offline:lastSync:${id}`,
};
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd mobile-app && npx jest src/lib/__tests__/offline-store.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/lib/offline-store.ts mobile-app/src/lib/__tests__/offline-store.test.ts
git commit -m "feat(offline): key-value store wrapper"
```

---

## Task 2: Sync queue — types + persistence

**Files:**
- Create: `mobile-app/src/lib/sync-queue.ts`
- Test: `mobile-app/src/lib/__tests__/sync-queue.test.ts`

- [ ] **Step 1: Write failing tests for enqueue/peek/remove**

```ts
// mobile-app/src/lib/__tests__/sync-queue.test.ts
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
```

- [ ] **Step 2: Run tests, confirm fail**

Run: `cd mobile-app && npx jest src/lib/__tests__/sync-queue.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement minimal sync-queue (enqueue/list/hydrate only)**

```ts
// mobile-app/src/lib/sync-queue.ts
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
    items = items.map((i) => (i.id === id ? { ...i, attempts: i.attempts + 1, lastError: error, failed } : i));
    await persist();
  },

  _resetForTests() {
    items = [];
    hydrated = false;
  },
};
```

- [ ] **Step 4: Run tests, confirm pass**

Run: `cd mobile-app && npx jest src/lib/__tests__/sync-queue.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/lib/sync-queue.ts mobile-app/src/lib/__tests__/sync-queue.test.ts
git commit -m "feat(offline): sync queue scaffolding"
```

---

## Task 3: Sync handlers (per-kind dispatch)

**Files:**
- Create: `mobile-app/src/lib/sync-handlers.ts`

- [ ] **Step 1: Write test for handler dispatch + success removes item**

Append to `mobile-app/src/lib/__tests__/sync-queue.test.ts`:

```ts
import { syncQueue } from "../sync-queue";

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
    for (let i = 0; i < 11; i++) await syncQueue.drain(handlers);
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
    expect(handler).toHaveBeenCalledTimes(1); // second call skipped due to backoff
  });
});
```

- [ ] **Step 2: Add `drain` to sync-queue.ts**

Replace the `syncQueue` object with this extended version (adds `drain`, keeps everything else):

```ts
// backoff in ms: 1s, 4s, 15s, 60s, then 5min cap
function backoffMs(attempts: number): number {
  const ladder = [1000, 4000, 15000, 60000];
  return attempts < ladder.length ? ladder[attempts] : 5 * 60 * 1000;
}

export type HandlerResult = { ok: true } | { ok: false; error: string };
export type Handlers = Record<QueueKind, (payload: any) => Promise<HandlerResult>>;

// add to syncQueue object:
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
```

Update `_updateAttempts` so subsequent backoff is based on last attempt time. Replace implementation:

```ts
  async _updateAttempts(id: string, error?: string, failed?: boolean) {
    items = items.map((i) =>
      i.id === id ? { ...i, attempts: i.attempts + 1, lastError: error, failed, createdAt: Date.now() } : i,
    );
    await persist();
  },
```

(We reuse `createdAt` as "last attempt time" for backoff — simple and keeps the type flat.)

- [ ] **Step 3: Run tests, confirm pass**

Run: `cd mobile-app && npx jest src/lib/__tests__/sync-queue.test.ts`
Expected: all 7 passing.

- [ ] **Step 4: Create `sync-handlers.ts` that wires queue kinds to Supabase**

```ts
// mobile-app/src/lib/sync-handlers.ts
import { supabase } from "./supabase";
import type { Handlers } from "./sync-queue";

export const supabaseHandlers: Handlers = {
  upsert_session_tasting: async (payload) => {
    const { error } = await supabase
      .from("session_tastings")
      .upsert(payload, { onConflict: "session_wine_id,user_id" });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  create_session: async (payload) => {
    const { error } = await supabase.from("tasting_sessions").insert(payload);
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  add_session_wine: async (payload) => {
    const { error } = await supabase.from("session_wines").insert(payload);
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  submit_wset: async (payload) => {
    // WSET-submit writes a row in session_tastings with wset_* columns populated
    const { error } = await supabase
      .from("session_tastings")
      .upsert(payload, { onConflict: "session_wine_id,user_id" });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/lib/sync-queue.ts mobile-app/src/lib/sync-handlers.ts mobile-app/src/lib/__tests__/sync-queue.test.ts
git commit -m "feat(offline): drain + supabase sync handlers"
```

---

## Task 4: useOnlineStatus hook

**Files:**
- Create: `mobile-app/src/hooks/useOnlineStatus.ts`
- Test: `mobile-app/src/hooks/__tests__/useOnlineStatus.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// mobile-app/src/hooks/__tests__/useOnlineStatus.test.tsx
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "../useOnlineStatus";

describe("useOnlineStatus", () => {
  test("returns true when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.online).toBe(true);
  });

  test("updates when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    const { result } = renderHook(() => useOnlineStatus());
    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.online).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd mobile-app && npx jest src/hooks/__tests__/useOnlineStatus.test.tsx`

- [ ] **Step 3: Implement**

```ts
// mobile-app/src/hooks/useOnlineStatus.ts
import { useEffect, useState } from "react";
import { Platform } from "react-native";

function readInitial(): boolean {
  if (Platform.OS === "web") return typeof navigator !== "undefined" ? navigator.onLine : true;
  return true;
}

export function useOnlineStatus(): { online: boolean } {
  const [online, setOnline] = useState<boolean>(readInitial);

  useEffect(() => {
    if (Platform.OS === "web") {
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
    // RN: lazy require so web bundle doesn't pull it in
    const NetInfo = require("@react-native-community/netinfo").default;
    const sub = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
      setOnline(Boolean(state.isConnected));
    });
    return () => sub();
  }, []);

  return { online };
}
```

- [ ] **Step 4: Install netinfo if missing**

Run: `cd mobile-app && npm ls @react-native-community/netinfo || npm install @react-native-community/netinfo`
Expected: package resolves (already present or installs cleanly).

- [ ] **Step 5: Run tests, confirm pass**

Run: `cd mobile-app && npx jest src/hooks/__tests__/useOnlineStatus.test.tsx`
Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add mobile-app/src/hooks/useOnlineStatus.ts mobile-app/src/hooks/__tests__/useOnlineStatus.test.tsx mobile-app/package.json mobile-app/package-lock.json
git commit -m "feat(offline): useOnlineStatus hook (web + RN)"
```

---

## Task 5: Queue-aware session-actions

**Files:**
- Modify: `mobile-app/src/lib/session-actions.ts`
- Test: `mobile-app/src/lib/__tests__/session-actions.test.ts` (extend)

- [ ] **Step 1: Write failing tests for queueSaveTasting**

Append to `mobile-app/src/lib/__tests__/session-actions.test.ts`:

```ts
import { queueSaveTasting } from "../session-actions";
import { syncQueue } from "../sync-queue";
import { offlineStore, K } from "../offline-store";

beforeEach(async () => {
  await offlineStore.clear();
  syncQueue._resetForTests();
});

describe("queueSaveTasting", () => {
  test("enqueues upsert_session_tasting item with payload", async () => {
    await queueSaveTasting({
      session_id: "s1",
      session_wine_id: "w1",
      user_id: "u1",
      rating: 4,
      notes: null,
    });
    const items = await syncQueue.list();
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("upsert_session_tasting");
    expect(items[0].payload.rating).toBe(4);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `cd mobile-app && npx jest src/lib/__tests__/session-actions.test.ts -t queueSaveTasting`
Expected: FAIL (export missing).

- [ ] **Step 3: Add queue-aware wrappers to session-actions.ts**

Append at the bottom of `mobile-app/src/lib/session-actions.ts`:

```ts
import { syncQueue } from "./sync-queue";

export async function queueSaveTasting(row: SessionTastingInsert): Promise<void> {
  await syncQueue.enqueue({ kind: "upsert_session_tasting", payload: row });
}

export async function queueAddWineToSession(wine: SessionWineInsert): Promise<void> {
  await syncQueue.enqueue({ kind: "add_session_wine", payload: wine });
}

export async function queueCreateSession(
  row: { host_id: string; title: string; join_code: string; mode: string; format: string; free_order: boolean },
): Promise<void> {
  await syncQueue.enqueue({ kind: "create_session", payload: { ...row, status: "setup" } });
}
```

Note the existing `import` block at the top already brings in `SessionTastingInsert` and `SessionWineInsert`, so no change needed there.

- [ ] **Step 4: Run, confirm pass**

Run: `cd mobile-app && npx jest src/lib/__tests__/session-actions.test.ts`
Expected: all passing (existing + new).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/lib/session-actions.ts mobile-app/src/lib/__tests__/session-actions.test.ts
git commit -m "feat(offline): queue-aware session-action wrappers"
```

---

## Task 6: Cache session state & serve from cache in useTastingSessions

**Files:**
- Modify: `mobile-app/src/hooks/useTastingSessions.ts`

- [ ] **Step 1: Update `openSession` to read cache first, then revalidate**

In `useTastingSessions.ts`, replace the current `openSession`:

```ts
  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    // Read cache first for instant UI
    const [cachedWines, cachedTastings] = await Promise.all([
      offlineStore.get<SessionWineRow[]>(K.sessionWines(session.id)),
      offlineStore.get<SessionTastingRow[]>(K.sessionTastings(session.id)),
    ]);
    if (cachedWines) setActiveWines(cachedWines);
    if (cachedTastings) setActiveTastings(cachedTastings);

    // Revalidate in background
    const [winesResult, tastingsResult] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    if (winesResult.data) {
      setActiveWines(winesResult.data);
      await offlineStore.set(K.sessionWines(session.id), winesResult.data);
    }
    if (tastingsResult.data) {
      setActiveTastings(tastingsResult.data);
      await offlineStore.set(K.sessionTastings(session.id), tastingsResult.data);
    }
  }, []);
```

Add at the top of file (after existing imports):

```ts
import { offlineStore, K } from "../lib/offline-store";
```

- [ ] **Step 2: Persist sessions list whenever it's fetched**

Update `fetchSessions`:

```ts
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    // Seed from cache
    const cached = await offlineStore.get<TastingSessionRow[]>(K.sessions);
    if (cached) setSessions(cached);
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setSessions(data as TastingSessionRow[]);
      await offlineStore.set(K.sessions, data);
    }
    setLoading(false);
  }, []);
```

- [ ] **Step 3: Smoke-test manually**

Run: `cd mobile-app && npm run web`
Expected: dev server starts; open provning → reload offline → data still visible. (No automated test here — the hook is tightly coupled to Supabase realtime; manual verification is the pragmatic call.)

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/hooks/useTastingSessions.ts
git commit -m "feat(offline): SWR cache for session lists + session state"
```

---

## Task 7: Optimistic write path for ratings/notes

**Files:**
- Modify: `mobile-app/src/hooks/useTastingSessions.ts`
- Modify: `mobile-app/src/components/session-tasting-view.tsx` (or wherever ratings are saved — verify with grep)

- [ ] **Step 1: Verify call site**

Run: `grep -rn "saveTasting(" mobile-app/src`
Expected: one or two call sites in components. Note them.

- [ ] **Step 2: Add `saveTastingOptimistic` to `useTastingSessions`**

Inside the hook, before the return block:

```ts
  const saveTastingOptimistic = useCallback(async (row: SessionTastingInsert) => {
    // 1. Optimistic state update
    setActiveTastings((prev) => {
      const existing = prev.find((t) => t.session_wine_id === row.session_wine_id && t.user_id === row.user_id);
      const merged: SessionTastingRow = {
        ...(existing ?? { id: `local-${Date.now()}`, created_at: new Date().toISOString() } as any),
        ...row,
      } as SessionTastingRow;
      const next = existing
        ? prev.map((t) => (t === existing ? merged : t))
        : [...prev, merged];
      // 2. Persist cache
      if (row.session_id) offlineStore.set(K.sessionTastings(row.session_id), next);
      return next;
    });
    // 3. Enqueue
    await queueSaveTasting(row);
  }, []);
```

Add `queueSaveTasting` to the `session-actions` import at the top of the file.

Export `saveTastingOptimistic` from the return object.

- [ ] **Step 3: Update call sites to use `saveTastingOptimistic`**

In each component that currently calls `saveTasting` from `session-actions`, replace with `saveTastingOptimistic` from the hook. Example diff:

```ts
// before
await saveTasting({ session_id, session_wine_id, user_id, rating, notes });
// after
await saveTastingOptimistic({ session_id, session_wine_id, user_id, rating, notes });
```

- [ ] **Step 4: Manual smoke test**

Run: `cd mobile-app && npm run web`
Steps:
1. Öppna en provning, stäng av nätet i DevTools (Network → Offline).
2. Ge ett betyg. UI ska svara direkt.
3. Ladda om sidan offline. Betyget ska fortfarande visas.
4. Slå på nätet. Betyget ska synkas (se Network-panelen).

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/hooks/useTastingSessions.ts mobile-app/src/components
git commit -m "feat(offline): optimistic write path for session tastings"
```

---

## Task 8: Auto-drain queue on online + foreground

**Files:**
- Modify: `mobile-app/App.tsx`

- [ ] **Step 1: Add drain trigger in App.tsx**

Add near the top of the App component body:

```tsx
import { useOnlineStatus } from "./src/hooks/useOnlineStatus";
import { syncQueue } from "./src/lib/sync-queue";
import { supabaseHandlers } from "./src/lib/sync-handlers";

// inside App():
const { online } = useOnlineStatus();
useEffect(() => {
  if (!online) return;
  syncQueue.drain(supabaseHandlers);
  // also retry periodically while app is open and online
  const iv = setInterval(() => syncQueue.drain(supabaseHandlers), 30000);
  return () => clearInterval(iv);
}, [online]);
```

- [ ] **Step 2: Manual test**

Run: `cd mobile-app && npm run web`
Steps: Gå offline, betygsätt, gå online → nätverksanropet ska gå fram inom 30 s.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/App.tsx
git commit -m "feat(offline): auto-drain queue on reconnect"
```

---

## Task 9: Offline badge in provning header

**Files:**
- Create: `mobile-app/src/components/offline-badge.tsx`
- Modify: the component that renders the session header (verify with grep: look for "activeSession" in components)

- [ ] **Step 1: Create badge component**

```tsx
// mobile-app/src/components/offline-badge.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineBadge() {
  const { online } = useOnlineStatus();
  if (online) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Offline — ändringar synkas automatiskt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#8b5e34",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 2: Mount globally in App.tsx**

Place `<OfflineBadge />` right after the root view opens, so it's visible everywhere when offline.

- [ ] **Step 3: Manual verification**

DevTools → offline → badge ska synas högst upp på alla skärmar.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/components/offline-badge.tsx mobile-app/App.tsx
git commit -m "feat(offline): show global offline banner"
```

---

## Task 10: WSET draft auto-save

**Files:**
- Modify: `mobile-app/src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Locate WSET form state**

Read `mobile-app/src/components/tasting-session-modal.tsx` and identify the form state (likely a `useState` of WSET fields) and the `wineId` prop.

- [ ] **Step 2: Add debounced auto-save**

Add at the top:

```ts
import { offlineStore, K } from "../lib/offline-store";
```

Inside the component, after the form state is declared (pseudocode — use actual state variable name `form` or equivalent):

```tsx
useEffect(() => {
  if (!wineId) return;
  offlineStore.get(K.wsetDraft(wineId)).then((draft) => {
    if (draft) setForm((f) => ({ ...f, ...draft }));
  });
}, [wineId]);

useEffect(() => {
  if (!wineId) return;
  const t = setTimeout(() => {
    offlineStore.set(K.wsetDraft(wineId), form);
  }, 500);
  return () => clearTimeout(t);
}, [wineId, form]);
```

On successful submit, clear the draft:

```ts
await offlineStore.remove(K.wsetDraft(wineId));
```

- [ ] **Step 3: Route submit through queue**

Replace the direct Supabase call in submit with:

```ts
await syncQueue.enqueue({ kind: "submit_wset", payload: submitRow });
```

Add at top: `import { syncQueue } from "../lib/sync-queue";`

- [ ] **Step 4: Manual test**

DevTools offline → fyll i WSET → stäng modal → öppna igen → fälten ska vara kvar. Slå på nätet → ska synka.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/components/tasting-session-modal.tsx
git commit -m "feat(offline): WSET draft auto-save + queued submit"
```

---

## Task 11: Pausa realtime-subscriptions när offline

**Files:**
- Modify: `mobile-app/src/hooks/useTastingSessions.ts`

- [ ] **Step 1: Wire online state into realtime effect**

Add to the hook signature: accept `online` as second argument, or read from `useOnlineStatus` inside. Keep it local:

```ts
import { useOnlineStatus } from "./useOnlineStatus";
// inside hook:
const { online } = useOnlineStatus();
```

Update the realtime `useEffect`:

```ts
  useEffect(() => {
    if (!activeSession) return;
    if (!online) return; // skip subscribe while offline
    const sessionId = activeSession.id;
    // ... existing subscribe code ...
  }, [activeSession?.id, online]);
```

- [ ] **Step 2: When online returns, refetch to reconcile**

Add after the existing effect:

```ts
  useEffect(() => {
    if (!online || !activeSession) return;
    fetchSessionTastings(activeSession.id).then((r) => {
      if (r.data) {
        setActiveTastings(r.data);
        offlineStore.set(K.sessionTastings(activeSession.id), r.data);
      }
    });
  }, [online, activeSession?.id]);
```

- [ ] **Step 3: Manual test**

Offline → ändra på annan enhet → återanslut → första enhetens UI ska synka in ändringen.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/hooks/useTastingSessions.ts
git commit -m "feat(offline): pause realtime while offline, reconcile on reconnect"
```

---

## Task 12: Städning + bloat-check

**Files:** all touched files.

- [ ] **Step 1: Run bloat-check**

Delegate to bloat-checker agent: check line counts on:
- `mobile-app/src/lib/offline-store.ts`
- `mobile-app/src/lib/sync-queue.ts`
- `mobile-app/src/lib/sync-handlers.ts`
- `mobile-app/src/lib/session-actions.ts`
- `mobile-app/src/hooks/useTastingSessions.ts`
- `mobile-app/src/components/tasting-session-modal.tsx`
- `mobile-app/App.tsx`

Expected: all under 500 rader; individual functions under 50 rader. If any exceed, split.

- [ ] **Step 2: Run full test suite**

Run: `cd mobile-app && npm test`
Expected: all tests pass.

- [ ] **Step 3: Typecheck**

Run: `cd mobile-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore(offline): tidy up after offline-support rollout"
```

---

## Manual verification checklist (final)

After Task 12, run through these on web dev server (`npm run web`):

- [ ] Öppna en provning online → gå offline (DevTools) → ändringar sparas lokalt
- [ ] Reload offline → senaste provnings-state synligt
- [ ] Starta en ny provning offline → skapas lokalt, kod kommer efter återanslutning
- [ ] Lägg till vin från källaren offline → funkar; katalog-sök är gråad ut
- [ ] WSET-draft överlever modal close + reload
- [ ] Återanslut → kö tömmer sig, Network-panel visar POST/PATCH → Supabase
- [ ] Offline-badge syns när nätet är av, försvinner när det är på
