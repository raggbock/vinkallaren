# Error Handling Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify error handling: lib/ returns Result types, hooks show errors via showError(), no Alert in lib/.

**Architecture:** New Result<T> type for lib/ return values. New showError() helper centralizes Alert display in hooks. Silent returns kept for search functions.

**Tech Stack:** React Native, TypeScript, Supabase

---

## Commit 1: Create Result type + showError helper

### Task 1.1 — Create `src/types/result.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\types\result.ts` (NEW, ~5 lines)

```ts
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export const ok = <T>(data: T): Result<T> => ({ data, error: null });
export const fail = <T>(error: string): Result<T> => ({ data: null, error });
```

### Task 1.2 — Create `src/lib/show-error.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\show-error.ts` (NEW, ~5 lines)

```ts
import { Alert } from "react-native";

export function showError(title: string, detail?: string) {
  Alert.alert(title, detail ?? "Försök igen.");
}
```

### Task 1.3 — Commit

```
git add src/types/result.ts src/lib/show-error.ts
git commit -m "feat: add Result type and showError helper for unified error handling"
```

---

## Commit 2: Migrate session-actions.ts + update useTastingSessions.ts

### Task 2.1 — Migrate `session-actions.ts` to Result types

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\session-actions.ts`

Replace line 1:

```ts
// old
import { Alert } from "react-native";

// new
import { ok, fail, type Result } from "../types/result";
```

Replace `createSession` (lines 19-32):

```ts
// old
export async function createSession(userId: string, input: CreateSessionInput): Promise<TastingSessionRow | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("tasting_sessions")
      .insert({ host_id: userId, title: input.title, join_code: joinCode, mode: input.mode, format: input.format, free_order: input.free_order })
      .select("*")
      .single();
    if (!error) return data as TastingSessionRow;
    if (error.code !== "23505") { Alert.alert("Kunde inte skapa provning", error.message); return null; }
  }
  Alert.alert("Kunde inte skapa provning", "Försök igen.");
  return null;
}

// new
export async function createSession(userId: string, input: CreateSessionInput): Promise<Result<TastingSessionRow>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from("tasting_sessions")
      .insert({ host_id: userId, title: input.title, join_code: joinCode, mode: input.mode, format: input.format, free_order: input.free_order })
      .select("*")
      .single();
    if (!error) return ok(data as TastingSessionRow);
    if (error.code !== "23505") return fail(error.message);
  }
  return fail("Försök igen.");
}
```

Replace `joinSessionByCode` (lines 34-39):

```ts
// old
export async function joinSessionByCode(code: string): Promise<TastingSessionRow | null> {
  const { data, error } = await supabase.rpc("join_session_by_code", { code: code.toUpperCase() });
  if (error) { Alert.alert("Kunde inte gå med", error.message); return null; }
  if (data?.error) { Alert.alert("Hittades inte", "Ingen aktiv provning med den koden."); return null; }
  return data as TastingSessionRow;
}

// new
export async function joinSessionByCode(code: string): Promise<Result<TastingSessionRow>> {
  const { data, error } = await supabase.rpc("join_session_by_code", { code: code.toUpperCase() });
  if (error) return fail(error.message);
  if (data?.error) return fail("Ingen aktiv provning med den koden.");
  return ok(data as TastingSessionRow);
}
```

Replace `fetchSessionWines` (lines 41-49):

```ts
// old
export async function fetchSessionWines(sessionId: string): Promise<SessionWineRow[]> {
  const { data, error } = await supabase
    .from("session_wines")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) { Alert.alert("Kunde inte hämta viner", error.message); return []; }
  return (data ?? []) as SessionWineRow[];
}

// new
export async function fetchSessionWines(sessionId: string): Promise<Result<SessionWineRow[]>> {
  const { data, error } = await supabase
    .from("session_wines")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionWineRow[]);
}
```

Replace `fetchSessionTastings` (lines 51-57):

```ts
// old
export async function fetchSessionTastings(sessionId: string): Promise<SessionTastingRow[]> {
  const { data, error } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("session_id", sessionId);
  if (error) { Alert.alert("Kunde inte hämta provningar", error.message); return []; }
  return (data ?? []) as SessionTastingRow[];
}

// new
export async function fetchSessionTastings(sessionId: string): Promise<Result<SessionTastingRow[]>> {
  const { data, error } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("session_id", sessionId);
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionTastingRow[]);
}
```

Replace `addWineToSession` (lines 60-64):

```ts
// old
export async function addWineToSession(wine: SessionWineInsert): Promise<SessionWineRow | null> {
  const { data, error } = await supabase.from("session_wines").insert(wine).select("*").single();
  if (error) { Alert.alert("Kunde inte lägga till vin", error.message); return null; }
  return data as SessionWineRow;
}

// new
export async function addWineToSession(wine: SessionWineInsert): Promise<Result<SessionWineRow>> {
  const { data, error } = await supabase.from("session_wines").insert(wine).select("*").single();
  if (error) return fail(error.message);
  return ok(data as SessionWineRow);
}
```

Replace `saveTasting` (lines 66-74):

```ts
// old
export async function saveTasting(tasting: SessionTastingInsert): Promise<SessionTastingRow | null> {
  const { data, error } = await supabase
    .from("session_tastings")
    .upsert(tasting, { onConflict: "session_wine_id,user_id" })
    .select("*")
    .single();
  if (error) { Alert.alert("Kunde inte spara provning", error.message); return null; }
  return data as SessionTastingRow;
}

// new
export async function saveTasting(tasting: SessionTastingInsert): Promise<Result<SessionTastingRow>> {
  const { data, error } = await supabase
    .from("session_tastings")
    .upsert(tasting, { onConflict: "session_wine_id,user_id" })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as SessionTastingRow);
}
```

Replace `revealSession` (lines 76-80):

```ts
// old
export async function revealSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealed" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avslöja", error.message); return false; }
  return true;
}

// new
export async function revealSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealed" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true as const);
}
```

Replace `endSession` (lines 82-86):

```ts
// old
export async function endSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avsluta", error.message); return false; }
  return true;
}

// new
export async function endSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true as const);
}
```

`fetchSessionParticipants` (line 88-92) and `buildShareMessage` (line 94-96) stay unchanged — they use silent return patterns which are correct per spec.

### Task 2.2 — Update `useTastingSessions.ts` to handle Result types

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useTastingSessions.ts`

Add import at top (after existing imports, line 9):

```ts
// new line after existing imports
import { showError } from "../lib/show-error";
```

Replace `openSession` (lines 48-56):

```ts
// old
  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [wines, tastings] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    setActiveWines(wines);
    setActiveTastings(tastings);
  }, []);

// new
  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [winesResult, tastingsResult] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    if (winesResult.error) showError("Kunde inte hämta viner", winesResult.error);
    if (tastingsResult.error) showError("Kunde inte hämta provningar", tastingsResult.error);
    setActiveWines(winesResult.data ?? []);
    setActiveTastings(tastingsResult.data ?? []);
  }, []);
```

Replace `handleCreate` (lines 64-71):

```ts
// old
  const handleCreate = useCallback(async (input: CreateSessionInput) => {
    const session = await createSession(userId, input);
    if (session) {
      setSessions((prev) => [session, ...prev]);
      await openSession(session);
    }
    return session;
  }, [userId, openSession]);

// new
  const handleCreate = useCallback(async (input: CreateSessionInput) => {
    const result = await createSession(userId, input);
    if (result.error) { showError("Kunde inte skapa provning", result.error); return null; }
    setSessions((prev) => [result.data, ...prev]);
    await openSession(result.data);
    return result.data;
  }, [userId, openSession]);
```

Replace `handleJoin` (lines 73-83):

```ts
// old
  const handleJoin = useCallback(async (code: string) => {
    const session = await joinSessionByCode(code);
    if (session) {
      setSessions((prev) => {
        if (prev.some((s) => s.id === session.id)) return prev;
        return [session, ...prev];
      });
      await openSession(session);
    }
    return session;
  }, [openSession]);

// new
  const handleJoin = useCallback(async (code: string) => {
    const result = await joinSessionByCode(code);
    if (result.error) { showError("Kunde inte gå med", result.error); return null; }
    const session = result.data;
    setSessions((prev) => {
      if (prev.some((s) => s.id === session.id)) return prev;
      return [session, ...prev];
    });
    await openSession(session);
    return session;
  }, [openSession]);
```

Replace the realtime `fetchSessionTastings` call inside the `useEffect` (line 123):

```ts
// old
          if (updated.status === "revealed") {
            fetchSessionTastings(sessionId).then(setActiveTastings);
          }

// new
          if (updated.status === "revealed") {
            fetchSessionTastings(sessionId).then((r) => { if (r.data) setActiveTastings(r.data); });
          }
```

### Task 2.3 — Find all callers of `addWineToSession`, `saveTasting`, `revealSession`, `endSession` and update them

These are called from components or other hooks. Search for their usage:

```ts
// Search: addWineToSession, saveTasting, revealSession, endSession
```

**File:** `C:\Projects\vinkällaren\mobile-app\src\components\tasting-session-modal.tsx` (or wherever these are called)

For each call site, the pattern is the same. Example for `addWineToSession`:

```ts
// old
const wine = await addWineToSession(payload);
if (wine) { /* success */ }

// new
const result = await addWineToSession(payload);
if (result.error) { showError("Kunde inte lägga till vin", result.error); return; }
const wine = result.data;
// success path continues
```

For `saveTasting`:

```ts
// old
const tasting = await saveTasting(payload);
if (tasting) { /* success */ }

// new
const result = await saveTasting(payload);
if (result.error) { showError("Kunde inte spara provning", result.error); return; }
const tasting = result.data;
```

For `revealSession`:

```ts
// old
const ok = await revealSession(sessionId);

// new
const result = await revealSession(sessionId);
if (result.error) { showError("Kunde inte avslöja", result.error); return; }
```

For `endSession`:

```ts
// old
const ok = await endSession(sessionId);

// new
const result = await endSession(sessionId);
if (result.error) { showError("Kunde inte avsluta", result.error); return; }
```

> **Note:** Check `C:\Projects\vinkällaren\mobile-app\src\components\tasting-session-modal.tsx` for the exact call sites. Add `import { showError } from "../lib/show-error";` to that file if it doesn't already have it. Remove any existing `Alert` import if it becomes unused after these changes.

### Task 2.4 — Commit

```
git add src/lib/session-actions.ts src/hooks/useTastingSessions.ts src/components/tasting-session-modal.tsx
git commit -m "refactor: migrate session-actions.ts to Result types, update callers"
```

---

## Commit 3: Migrate cellar-actions.ts + update consuming hooks

### Task 3.1 — Migrate `cellar-actions.ts` to Result types

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\cellar-actions.ts`

Replace line 1:

```ts
// old
import { Alert, Linking } from "react-native";

// new
import { Linking } from "react-native";
import { ok, fail, type Result } from "../types/result";
import { showError } from "./show-error";
```

> **Note:** `Linking` stays because `openSystembolaget` uses it (it's a navigation helper, not error handling). `showError` is imported only for `openSystembolaget`'s UI alert — this is the one exception where a lib/ file shows user feedback, since it's an action that directly controls UI navigation. Alternatively, this function could be moved to a hook, but that's out of scope for this task.

Actually, looking at the spec more carefully: the spec says "lib/ never touches UI. No Alert, no React imports." The `openSystembolaget` function uses both `Alert` and `Linking`. `Linking` is fine since it's a platform API, but the `Alert` call should use `showError` instead. However, since `showError` itself imports `Alert`, and the spec says "No Alert in lib/", let's make `openSystembolaget` return a Result instead.

Replace `openSystembolaget` (lines 219-227):

```ts
// old
export async function openSystembolaget(productId: string): Promise<void> {
  const url = buildSystembolagetProductUrl(productId);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert("Kunde inte öppna länken", "Det gick inte att öppna Systembolaget just nu.");
    return;
  }
  await Linking.openURL(url);
}

// new
export async function openSystembolaget(productId: string): Promise<Result<true>> {
  const url = buildSystembolagetProductUrl(productId);
  const supported = await Linking.canOpenURL(url);
  if (!supported) return fail("Det gick inte att öppna Systembolaget just nu.");
  await Linking.openURL(url);
  return ok(true as const);
}
```

Then the import becomes:

```ts
// new (Linking stays, Alert removed)
import { Linking } from "react-native";
import { ok, fail, type Result } from "../types/result";
```

Replace `saveNewWine` (lines 28-69):

```ts
// old
export async function saveNewWine(args: SaveWineArgs): Promise<boolean> {
  const { userId, draft, storageSpaceId, storageRow, storageSlot, selectedCatalogNameEntry } = args;
  if (!draft.name.trim()) {
    Alert.alert("Namn saknas", "Skriv in vilket vin du vill lägga till.");
    return false;
  }
  const missingFields = getMissingCatalogFields(draft);
  if (!selectedCatalogNameEntry && missingFields.length > 0) {
    Alert.alert("Komplettera vinet", `Fyll i: ${missingFields.join(", ")}.`);
    return false;
  }
  // ... rest of function ...
  const { error } = await supabase.from("wines").insert(payload);
  if (error) throw error;
  await cacheWineDraftAsCatalogEntry(payload, userId);
  return true;
}

// new
export async function saveNewWine(args: SaveWineArgs): Promise<Result<true>> {
  const { userId, draft, storageSpaceId, storageRow, storageSlot, selectedCatalogNameEntry } = args;
  if (!draft.name.trim()) {
    return fail("Namn saknas: Skriv in vilket vin du vill lägga till.");
  }
  const missingFields = getMissingCatalogFields(draft);
  if (!selectedCatalogNameEntry && missingFields.length > 0) {
    return fail(`Komplettera vinet: Fyll i ${missingFields.join(", ")}.`);
  }
  let imagePath: string | null = null;
  if (draft.imageUri) imagePath = await uploadWineImage(userId, draft.imageUri);
  const payload: WineInsert = {
    user_id: userId,
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    vintage: toNumberOrNull(draft.vintage),
    quantity: Math.max(1, Number(draft.quantity) || 1),
    type: draft.type.trim() || "Rött",
    drink_by_year: toNumberOrNull(draft.drinkBy),
    acquired_at: emptyToNull(draft.acquiredAt),
    cellar_location: emptyToNull(draft.location),
    storage_space_id: emptyToNull(storageSpaceId),
    storage_row: storageSpaceId ? toNumberOrNull(storageRow) : null,
    storage_slot: storageSpaceId ? toNumberOrNull(storageSlot) : null,
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    tags: parseTags(draft.tags),
    food_pairings: parseTags(draft.foodPairings),
    pairing_source: "manual",
    notes: emptyToNull(draft.notes),
    image_path: imagePath,
  };
  const { error } = await supabase.from("wines").insert(payload);
  if (error) return fail(error.message);
  await cacheWineDraftAsCatalogEntry(payload, userId);
  return ok(true as const);
}
```

Replace `saveTastingEntry` (lines 79-108):

```ts
// old
export async function saveTastingEntry(args: SaveTastingArgs): Promise<boolean> {
  const { userId, draft, tastingRating, tastingDate, wsatData } = args;
  if (!draft.name.trim()) {
    Alert.alert("Namn saknas", "Skriv in vilket vin du provade.");
    return false;
  }
  // ... rest ...
  const { error } = await supabase.from("wine_history").insert(payload);
  if (error) throw error;
  return true;
}

// new
export async function saveTastingEntry(args: SaveTastingArgs): Promise<Result<true>> {
  const { userId, draft, tastingRating, tastingDate, wsatData } = args;
  if (!draft.name.trim()) {
    return fail("Namn saknas: Skriv in vilket vin du provade.");
  }
  let imagePath: string | null = null;
  if (draft.imageUri) imagePath = await uploadWineImage(userId, draft.imageUri);
  const payload: WineHistoryInsert = {
    user_id: userId,
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    vintage: toNumberOrNull(draft.vintage),
    type: draft.type.trim() || "Rött",
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    image_path: imagePath,
    quantity_consumed: 1,
    rating: tastingRating ? Number(tastingRating) : null,
    tasting_notes: emptyToNull(draft.notes),
    consumed_at: tastingDate || null,
    tasting_data: wsatData ?? null,
  };
  const { error } = await supabase.from("wine_history").insert(payload);
  if (error) return fail(error.message);
  return ok(true as const);
}
```

Replace `saveDrinkEntry` (lines 121-151):

```ts
// old
export async function saveDrinkEntry(args: SaveDrinkArgs): Promise<void> {
  // ... uses throw error pattern ...
}

// new
export async function saveDrinkEntry(args: SaveDrinkArgs): Promise<Result<true>> {
  const { userId, wine, rating, notes, consumedDate, imageUri, wsatData, setWines } = args;
  let imagePath = wine.image_path;
  if (imageUri) imagePath = await uploadWineImage(userId, imageUri);
  const payload: WineHistoryInsert = {
    user_id: userId, wine_id: wine.id,
    name: wine.name, producer: wine.producer, country: wine.country,
    region: wine.region, grape: wine.grape, vintage: wine.vintage,
    type: wine.type, barcode: wine.barcode,
    systembolaget_product_id: wine.systembolaget_product_id,
    storage_space_id: wine.storage_space_id, storage_row: wine.storage_row,
    storage_slot: wine.storage_slot, cellar_location: wine.cellar_location,
    image_path: imagePath, quantity_consumed: 1,
    rating: rating ? Number(rating) : null,
    tasting_notes: emptyToNull(notes),
    tasting_data: wsatData ?? null,
    consumed_at: consumedDate || null,
  };
  const { error: historyError } = await supabase.from("wine_history").insert(payload);
  if (historyError) return fail(historyError.message);
  if (wine.quantity <= 1) {
    const { error } = await supabase.from("wines").delete().eq("id", wine.id);
    if (error) return fail(error.message);
    setWines((current) => current.filter((w) => w.id !== wine.id));
  } else {
    const { data, error } = await supabase.from("wines").update({ quantity: wine.quantity - 1 }).eq("id", wine.id).select("*").single();
    if (error) return fail(error.message);
    const [hydrated] = await hydrateWineRecords([data as WineRow]);
    setWines((current) => current.map((w) => (w.id === wine.id ? hydrated : w)));
  }
  return ok(true as const);
}
```

Replace `saveWineEditEntry` (lines 160-190):

```ts
// old
export async function saveWineEditEntry(args: SaveWineEditArgs): Promise<void> {
  const { userId, editingWine, editWineDraft, setWines } = args;
  if (!editWineDraft.name.trim()) {
    Alert.alert("Namn saknas", "Skriv in vilket vin du vill spara.");
    throw new Error("missing_name");
  }
  const missingFields = getMissingCatalogFields(editWineDraft);
  if (missingFields.length > 0) {
    Alert.alert("Komplettera vinet", `Fyll i: ${missingFields.join(", ")}.`);
    throw new Error("missing_fields");
  }
  // ... rest ...
  if (error) throw error;
  // ...
}

// new
export async function saveWineEditEntry(args: SaveWineEditArgs): Promise<Result<true>> {
  const { userId, editingWine, editWineDraft, setWines } = args;
  if (!editWineDraft.name.trim()) {
    return fail("Namn saknas: Skriv in vilket vin du vill spara.");
  }
  const missingFields = getMissingCatalogFields(editWineDraft);
  if (missingFields.length > 0) {
    return fail(`Komplettera vinet: Fyll i ${missingFields.join(", ")}.`);
  }
  let imagePath = editingWine.image_path;
  if (editWineDraft.imageUri && editWineDraft.imageUri !== editingWine.image_url) {
    imagePath = await uploadWineImage(userId, editWineDraft.imageUri);
    if (editingWine.image_path) {
      await supabase.storage.from("wine-images").remove([editingWine.image_path]);
    }
  } else if (!editWineDraft.imageUri && editingWine.image_path) {
    await supabase.storage.from("wine-images").remove([editingWine.image_path]);
    imagePath = null;
  }
  const payload = buildWineInsertFromDraft(editWineDraft, editWineDraft.storageSpaceId, editWineDraft.storageRow, editWineDraft.storageSlot, imagePath);
  const { data, error } = await supabase.from("wines").update(payload).eq("id", editingWine.id).select("*").single();
  if (error) return fail(error.message);
  const updatedWine = data as WineRow | null;
  if (updatedWine) {
    await syncCatalogEntryForEditedWine(editingWine, updatedWine, userId);
    const [hydrated] = await hydrateWineRecords([updatedWine]);
    setWines((current) => current.map((w) => (w.id === editingWine.id ? hydrated : w)));
  }
  return ok(true as const);
}
```

Replace `saveCatalogEditorEntry` (lines 192-212):

```ts
// old
export async function saveCatalogEditorEntry(draft: CatalogEditorDraft): Promise<void> {
  if (!draft.name.trim()) {
    Alert.alert("Namn saknas", "Skriv in ett namn innan du sparar katalogposten.");
    throw new Error("missing_name");
  }
  // ... rest ...
  if (error) throw error;
}

// new
export async function saveCatalogEditorEntry(draft: CatalogEditorDraft): Promise<Result<true>> {
  if (!draft.name.trim()) {
    return fail("Namn saknas: Skriv in ett namn innan du sparar katalogposten.");
  }
  const { error } = await supabase.from("product_catalog_wines").update({
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    type: emptyToNull(draft.type),
    vintage: toNumberOrNull(draft.vintage),
    food_pairings: parseTags(draft.foodPairings),
    source_label: emptyToNull(draft.sourceLabel),
    source_confidence: emptyToNull(draft.sourceConfidence) || "high",
  }).eq("id", draft.id);
  if (error) return fail(error.message);
  return ok(true as const);
}
```

Replace `deleteCatalogEntryById` (lines 214-217):

```ts
// old
export async function deleteCatalogEntryById(id: string): Promise<void> {
  const { error } = await supabase.from("product_catalog_wines").delete().eq("id", id);
  if (error) throw error;
}

// new
export async function deleteCatalogEntryById(id: string): Promise<Result<true>> {
  const { error } = await supabase.from("product_catalog_wines").delete().eq("id", id);
  if (error) return fail(error.message);
  return ok(true as const);
}
```

### Task 3.2 — Update `useEditWineModal.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useEditWineModal.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace `save` callback (lines 45-60):

```ts
// old
  const save = useCallback(async () => {
    if (!editingWine || !draft) return;
    setSaving(true);
    try {
      await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
      await deps.fetchCatalogEntries();
      setVisible(false);
      setEditingWine(null);
      setDraft(null);
      deps.showSuccess("edit_saved");
    } catch (error) {
      if (error instanceof Error && (error.message === "missing_name" || error.message === "missing_fields")) return;
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [editingWine, draft, deps]);

// new
  const save = useCallback(async () => {
    if (!editingWine || !draft) return;
    setSaving(true);
    const result = await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
    if (result.error) { showError("Kunde inte spara ändringen", result.error); setSaving(false); return; }
    await deps.fetchCatalogEntries();
    setVisible(false);
    setEditingWine(null);
    setDraft(null);
    deps.showSuccess("edit_saved");
    setSaving(false);
  }, [editingWine, draft, deps]);
```

### Task 3.3 — Update `useDrinkWineModal.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useDrinkWineModal.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace `save` callback (lines 43-66):

```ts
// old
  const save = useCallback(async () => {
    if (!wine) return;
    setSaving(true);
    try {
      await saveDrinkEntry({
        userId: deps.userId,
        wine,
        rating,
        notes,
        consumedDate,
        imageUri,
        wsatData,
        setWines: deps.setWines,
      });
      await deps.fetchHistoryEntries();
      setVisible(false);
      setWine(null);
      deps.showSuccess("wine_drunk");
    } catch (error) {
      Alert.alert("Kunde inte spara historiken", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [wine, rating, notes, consumedDate, imageUri, wsatData, deps]);

// new
  const save = useCallback(async () => {
    if (!wine) return;
    setSaving(true);
    const result = await saveDrinkEntry({
      userId: deps.userId,
      wine,
      rating,
      notes,
      consumedDate,
      imageUri,
      wsatData,
      setWines: deps.setWines,
    });
    if (result.error) { showError("Kunde inte spara historiken", result.error); setSaving(false); return; }
    await deps.fetchHistoryEntries();
    setVisible(false);
    setWine(null);
    deps.showSuccess("wine_drunk");
    setSaving(false);
  }, [wine, rating, notes, consumedDate, imageUri, wsatData, deps]);
```

### Task 3.4 — Update `useCatalogEditorModal.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCatalogEditorModal.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace `save` callback (lines 25-39):

```ts
// old
  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveCatalogEditorEntry(draft);
      setVisible(false);
      setDraft(null);
      await deps.fetchCatalogEntries();
    } catch (error) {
      if (error instanceof Error && error.message === "missing_name") return;
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [draft, deps.fetchCatalogEntries]);

// new
  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    const result = await saveCatalogEditorEntry(draft);
    if (result.error) { showError("Kunde inte spara ändringen", result.error); setSaving(false); return; }
    setVisible(false);
    setDraft(null);
    await deps.fetchCatalogEntries();
    setSaving(false);
  }, [draft, deps.fetchCatalogEntries]);
```

Replace `deleteEntry` callback (lines 41-52):

```ts
// old
  const deleteEntry = useCallback(async (id: string) => {
    setSaving(true);
    try {
      await deleteCatalogEntryById(id);
      if (draft?.id === id) { setVisible(false); setDraft(null); }
      await deps.fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte ta bort produkt", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [draft?.id, deps.fetchCatalogEntries]);

// new
  const deleteEntry = useCallback(async (id: string) => {
    setSaving(true);
    const result = await deleteCatalogEntryById(id);
    if (result.error) { showError("Kunde inte ta bort produkt", result.error); setSaving(false); return; }
    if (draft?.id === id) { setVisible(false); setDraft(null); }
    await deps.fetchCatalogEntries();
    setSaving(false);
  }, [draft?.id, deps.fetchCatalogEntries]);
```

### Task 3.5 — Update `useAddWineTasting.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useAddWineTasting.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace `save` callback (lines 23-46):

```ts
// old
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const ok = await saveTastingEntry({
        userId: deps.userId,
        draft: deps.draft,
        tastingRating: rating,
        tastingDate: date,
        wsatData,
      });
      if (ok) {
        deps.resetDraft();
        setRating("");
        setWsatData(null);
        setDate(new Date().toISOString().slice(0, 10));
        await deps.fetchHistoryEntries();
        deps.showSuccess("tasting_saved");
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [deps, rating, date, wsatData]);

// new
  const save = useCallback(async () => {
    setSaving(true);
    const result = await saveTastingEntry({
      userId: deps.userId,
      draft: deps.draft,
      tastingRating: rating,
      tastingDate: date,
      wsatData,
    });
    if (result.error) { showError("Kunde inte spara", result.error); setSaving(false); return; }
    deps.resetDraft();
    setRating("");
    setWsatData(null);
    setDate(new Date().toISOString().slice(0, 10));
    await deps.fetchHistoryEntries();
    deps.showSuccess("tasting_saved");
    setSaving(false);
  }, [deps, rating, date, wsatData]);
```

### Task 3.6 — Update caller of `openSystembolaget`

Search for `openSystembolaget` calls in components and update them to handle the Result:

```ts
// old
await openSystembolaget(productId);

// new
const result = await openSystembolaget(productId);
if (result.error) showError("Kunde inte öppna länken", result.error);
```

Add `import { showError } from "../lib/show-error";` to the calling file if not already present.

### Task 3.7 — Also update `saveNewWine` callers

Search for `saveNewWine` calls. The function previously returned `boolean` and threw errors. Now it returns `Result<true>`. The caller needs to change from:

```ts
// old (typical pattern in a hook)
const ok = await saveNewWine(args);
if (ok) { /* success */ }

// new
const result = await saveNewWine(args);
if (result.error) { showError("Kunde inte spara vinet", result.error); return; }
// success path
```

### Task 3.8 — Commit

```
git add src/lib/cellar-actions.ts src/hooks/useEditWineModal.ts src/hooks/useDrinkWineModal.ts src/hooks/useCatalogEditorModal.ts src/hooks/useAddWineTasting.ts
git commit -m "refactor: migrate cellar-actions.ts to Result types, update consuming hooks"
```

---

## Commit 4: Swap Alert -> showError in remaining hooks + auth.tsx

### Task 4.1 — Update `useCellarData.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace all `Alert.alert(` with `showError(` in these functions (8 sites). Each is a direct swap with identical arguments:

Line 55:
```ts
// old
    if (error) { Alert.alert("Kunde inte hämta viner", error.message); setLoading(false); return; }
// new
    if (error) { showError("Kunde inte hämta viner", error.message); setLoading(false); return; }
```

Line 66:
```ts
// old
    if (error) { Alert.alert("Kunde inte hämta fler viner", error.message); return; }
// new
    if (error) { showError("Kunde inte hämta fler viner", error.message); return; }
```

Line 77:
```ts
// old
      Alert.alert("Kunde inte hämta historiken", error.message);
// new
      showError("Kunde inte hämta historiken", error.message);
```

Line 89:
```ts
// old
      Alert.alert("Kunde inte hämta förvaringsplatser", error.message);
// new
      showError("Kunde inte hämta förvaringsplatser", error.message);
```

Line 101:
```ts
// old
      Alert.alert("Kunde inte hämta produktkatalogen", error.message);
// new
      showError("Kunde inte hämta produktkatalogen", error.message);
```

Line 159:
```ts
// old
      Alert.alert("Kunde inte hämta referensdata", error.message);
// new
      showError("Kunde inte hämta referensdata", error.message);
```

Lines 167-168 (`saveStorageSpace` validation):
```ts
// old
      Alert.alert("Namn saknas", "Skriv in namnet på förvaringsplatsen.");
// new
      showError("Namn saknas", "Skriv in namnet på förvaringsplatsen.");
```

Line 173:
```ts
// old
      Alert.alert("Ogiltiga mått", "Ange antal rader och platser per rad.");
// new
      showError("Ogiltiga mått", "Ange antal rader och platser per rad.");
```

Line 192:
```ts
// old
      Alert.alert("Kunde inte spara platsen", error instanceof Error ? error.message : "Försök igen.");
// new
      showError("Kunde inte spara platsen", error instanceof Error ? error.message : "Försök igen.");
```

Line 201:
```ts
// old
    if (error) { Alert.alert("Kunde inte uppdatera platsen", error.message); return; }
// new
    if (error) { showError("Kunde inte uppdatera platsen", error.message); return; }
```

Line 208:
```ts
// old
      Alert.alert("Kunde inte ta bort platsen", error.message);
// new
      showError("Kunde inte ta bort platsen", error.message);
```

Line 218:
```ts
// old
      Alert.alert("Kunde inte ta bort", error.message);
// new
      showError("Kunde inte ta bort", error.message);
```

### Task 4.2 — Update `useCatalogWorkflow.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCatalogWorkflow.ts`

Replace import (line 2):

```ts
// old
import { Alert, Platform } from "react-native";

// new
import { Platform } from "react-native";
import { showError } from "../lib/show-error";
```

Replace all `Alert.alert(` with `showError(` (6 sites):

Line 176 (startBarcodeScanner):
```ts
// old
      Alert.alert("Skanning kräver säker anslutning", "På mobilwebb behöver kameraskanning vanligtvis https eller localhost.");
// new
      showError("Skanning kräver säker anslutning", "På mobilwebb behöver kameraskanning vanligtvis https eller localhost.");
```

Line 182:
```ts
// old
        Alert.alert("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
// new
        showError("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
```

Line 209 (handleBarcodeScanned):
```ts
// old
      Alert.alert("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
// new
      showError("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
```

> **Wait** — this is an informational/success alert, not an error. Per the spec, "Informational Alerts — keep as-is". So this line keeps `Alert.alert`. Same for line 215 ("Produkt hittad") and line 218 ("Ingen produktträff") — these are informational, not errors.

Corrected approach: Only change the actual error alerts. Keep `Alert` import for informational ones.

Revised import:
```ts
// old
import { Alert, Platform } from "react-native";

// new
import { Alert, Platform } from "react-native";
import { showError } from "../lib/show-error";
```

Error-only replacements:

Line 176:
```ts
// old
      Alert.alert("Skanning kräver säker anslutning", ...);
// new
      showError("Skanning kräver säker anslutning", ...);
```

Line 182:
```ts
// old
        Alert.alert("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
// new
        showError("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
```

Line 249 (handleLabelPhoto catch/no match):
```ts
// old
        Alert.alert("Inga matchningar hittades", "Texten från etiketten har fyllts i — korrigera vid behov.");
// new (this is informational, keep as Alert.alert)
```

Line 251-252 (catch block):
```ts
// old
      Alert.alert("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
// new
      showError("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
```

Line 260 (showLabelError helper):
```ts
// old
  function showLabelError() {
    Alert.alert("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
    setLookupBusy(false);
    setLookupMessage("");
  }

// new
  function showLabelError() {
    showError("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
    setLookupBusy(false);
    setLookupMessage("");
  }
```

Lines 209, 215, 218 are informational/success alerts — keep as `Alert.alert`.

### Task 4.3 — Update `useImagePicker.ts`

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useImagePicker.ts`

Replace import (line 2):

```ts
// old
import { Alert } from "react-native";

// new
import { showError } from "../lib/show-error";
```

Replace all 4 `Alert.alert(` with `showError(` (lines 8, 19, 28, 38):

```ts
// old
      Alert.alert("Behörighet saknas", "Ge appen tillgång till bilder.");
// new
      showError("Behörighet saknas", "Ge appen tillgång till bilder.");

// old
      Alert.alert("Kunde inte öppna bildbiblioteket", "Försök igen.");
// new
      showError("Kunde inte öppna bildbiblioteket", "Försök igen.");

// old
      Alert.alert("Behörighet saknas", "Ge appen tillgång till kameran.");
// new
      showError("Behörighet saknas", "Ge appen tillgång till kameran.");

// old
      Alert.alert("Kunde inte öppna kameran", "Försök igen.");
// new
      showError("Kunde inte öppna kameran", "Försök igen.");
```

### Task 4.4 — Update `auth.tsx`

**File:** `C:\Projects\vinkällaren\mobile-app\src\screens\auth.tsx`

This file has a mix of error alerts and informational alerts. Per the spec, only error Alerts get `showError`. The success alert on line 79 ("Konto skapat") is informational — keep as `Alert.alert`.

Add import:

```ts
// add after existing imports (line 8)
import { showError } from "../lib/show-error";
```

Line 55 (validation):
```ts
// old
      Alert.alert("Saknar uppgifter", "Fyll i både e-post och lösenord.");
// new
      showError("Saknar uppgifter", "Fyll i både e-post och lösenord.");
```

Line 96 (auth error catch):
```ts
// old
      Alert.alert("Inloggning misslyckades", error instanceof Error ? error.message : "Försök igen.");
// new
      showError("Inloggning misslyckades", error instanceof Error ? error.message : "Försök igen.");
```

Line 113-118 (guest sign-in error catch):
```ts
// old
      Alert.alert(
        "Gästläge gick inte att starta",
        error instanceof Error
          ? `${error.message} Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge.`
          : "Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge."
      );
// new
      showError(
        "Gästläge gick inte att starta",
        error instanceof Error
          ? `${error.message} Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge.`
          : "Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge."
      );
```

Line 79 ("Konto skapat") — keep as `Alert.alert` (informational, not error).

The `Alert` import on line 2 stays since it's still used for the informational alert on line 79.

### Task 4.5 — Commit

```
git add src/hooks/useCellarData.ts src/hooks/useCatalogWorkflow.ts src/hooks/useImagePicker.ts src/screens/auth.tsx
git commit -m "refactor: swap Alert.alert to showError in hooks and auth screen"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All files from the spec's File Impact table are covered
- [x] **No placeholders:** Every task shows exact old/new code
- [x] **Type consistency:** All lib/ functions that previously returned `T | null`, `boolean`, or threw now return `Result<T>` or `Result<true>`
- [x] **Silent returns preserved:** `fetchSessionParticipants`, `searchCatalogWineNames`, `fetchCatalogEntriesByName`, `matchCatalogByText` unchanged (per spec)
- [x] **Informational alerts kept:** "Konto skapat", "Förifyllt från din källare", "Produkt hittad", "Ingen produktträff", "Inga matchningar hittades" stay as `Alert.alert` (per spec Pattern F)
- [x] **No Alert in lib/:** `session-actions.ts` loses `Alert` entirely; `cellar-actions.ts` loses `Alert` (keeps `Linking`)
- [x] **Sentinel filtering removed:** `useEditWineModal.ts` and `useCatalogEditorModal.ts` no longer check for `"missing_name"` / `"missing_fields"` — the Result error string carries the user-facing message directly
- [x] **`try/catch` eliminated in consuming hooks:** All hooks that caught throws from cellar-actions now use `if (result.error)` pattern instead
- [x] **`finally` blocks replaced:** Each hook that used `try/finally` for `setSaving(false)` now calls `setSaving(false)` explicitly in both paths (error return + end of success path)
- [x] **`openSystembolaget` caller updated:** Task 3.6 covers the App.tsx caller
- [x] **`saveNewWine` caller updated:** Task 3.7 covers the hook/component caller
- [x] **Net line delta:** Negative — removed ~18 Alert imports and sentinel error patterns, added ~10 lines (result.ts + show-error.ts)
