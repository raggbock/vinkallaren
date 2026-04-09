# Data Fetching Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate redundant network requests by using mutation return values, incremental reference updates, and fetch dedup guards.

**Architecture:** Mutations return saved rows for optimistic local updates. mergeReferenceOptions() adds new values without refetch. createGuardedFetcher() prevents concurrent duplicate requests. Pull-to-refresh becomes comprehensive.

**Tech Stack:** React Native, TypeScript, Supabase

---

## Commit 1: Add createGuardedFetcher utility + wrap fetchers

### Task 1.1 — Add createGuardedFetcher helper function

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

Add the utility function before the `useCellarData` function definition.

**Old (line 33):**
```ts
const WINES_PAGE_SIZE = 50;
```

**New:**
```ts
const WINES_PAGE_SIZE = 50;

function createGuardedFetcher<T>(fn: () => Promise<T>): () => Promise<T | undefined> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}
```

### Task 1.2 — Wrap fetchWines, fetchHistoryEntries, fetchCatalogEntries with guards

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

Rename the raw functions and create guarded versions. Each fetcher keeps its original name for external consumers.

**Old (lines 52–59):**
```ts
  async function fetchWines() {
    setLoading(true);
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).limit(WINES_PAGE_SIZE);
    if (error) { Alert.alert("Kunde inte hämta viner", error.message); setLoading(false); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    setWines(await hydrateWineRecords(rows));
    setLoading(false);
  }
```

**New:**
```ts
  async function fetchWinesRaw() {
    setLoading(true);
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).limit(WINES_PAGE_SIZE);
    if (error) { Alert.alert("Kunde inte hämta viner", error.message); setLoading(false); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    setWines(await hydrateWineRecords(rows));
    setLoading(false);
  }
  const fetchWines = createGuardedFetcher(fetchWinesRaw);
```

**Old (lines 73–83):**
```ts
  async function fetchHistoryEntries() {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(100);
    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }
    setHistoryEntries(await hydrateWineHistoryRecords((data ?? []) as WineHistoryRow[]));
    setLoadingHistory(false);
  }
```

**New:**
```ts
  async function fetchHistoryEntriesRaw() {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(100);
    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }
    setHistoryEntries(await hydrateWineHistoryRecords((data ?? []) as WineHistoryRow[]));
    setLoadingHistory(false);
  }
  const fetchHistoryEntries = createGuardedFetcher(fetchHistoryEntriesRaw);
```

**Old (lines 97–107):**
```ts
  async function fetchCatalogEntries() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) {
      Alert.alert("Kunde inte hämta produktkatalogen", error.message);
      setLoadingCatalogEntries(false);
      return;
    }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }
```

**New:**
```ts
  async function fetchCatalogEntriesRaw() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) {
      Alert.alert("Kunde inte hämta produktkatalogen", error.message);
      setLoadingCatalogEntries(false);
      return;
    }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }
  const fetchCatalogEntries = createGuardedFetcher(fetchCatalogEntriesRaw);
```

No other changes needed — the return object already exposes `fetchWines`, `fetchHistoryEntries`, `fetchCatalogEntries` by name. The guards are transparent to consumers.

---

## Commit 2: Add mergeReferenceOptions helper

### Task 2.1 — Add mergeReferenceOptions inside useCellarData

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

Add this helper right after the `fetchReferenceOptions` function (after line 163).

**Insert after the `fetchReferenceOptions` function:**
```ts
  function mergeReferenceOptions(wine: WineRow) {
    setReferenceOptions(prev => {
      const additions: ReferenceOptionRow[] = [];
      for (const [category, value] of [
        ["grape", wine.grape], ["country", wine.country], ["region", wine.region],
      ] as const) {
        if (value && !prev.some(o => o.category === category && o.name === value)) {
          additions.push({ category, name: value, sort_order: 999, id: `local-${category}-${value}`, aliases: [], parent_name: null });
        }
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }
```

### Task 2.2 — Export mergeReferenceOptions from useCellarData

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

Add `mergeReferenceOptions` to the return object, in the "Fetchers" section.

**Old:**
```ts
    fetchReferenceOptions,
```

**New:**
```ts
    fetchReferenceOptions,
    mergeReferenceOptions,
```

---

## Commit 3: Update saveNewWine to return saved row + use it in App.tsx

### Task 3.1 — Make saveNewWine return the saved WineRow

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\cellar-actions.ts`

Change the return type and add `.select().single()` to the insert.

**Old (line 28):**
```ts
export async function saveNewWine(args: SaveWineArgs): Promise<boolean> {
```

**New:**
```ts
export async function saveNewWine(args: SaveWineArgs): Promise<WineRow | null> {
```

**Old (lines 65–68):**
```ts
  const { error } = await supabase.from("wines").insert(payload);
  if (error) throw error;
  await cacheWineDraftAsCatalogEntry(payload, userId);
  return true;
```

**New:**
```ts
  const { data, error } = await supabase.from("wines").insert(payload).select().single();
  if (error) throw error;
  const savedRow = data as WineRow;
  void cacheWineDraftAsCatalogEntry(payload, userId);
  return savedRow;
```

### Task 3.2 — Update handleSaveWine in App.tsx to use returned row

**File:** `C:\Projects\vinkällaren\mobile-app\App.tsx`

Add `hydrateWineRecords` import and update the handler.

**Old (line 8):**
```ts
import { openSystembolaget, saveNewWine } from "./src/lib/cellar-actions";
```

**New:**
```ts
import { openSystembolaget, saveNewWine } from "./src/lib/cellar-actions";
import { hydrateWineRecords } from "./src/lib/wine-helpers";
```

**Old (lines 154–180):**
```ts
  async function handleSaveWine() {
    setSaving(true);
    try {
      const ok = await saveNewWine({
        userId: session.user.id,
        draft,
        storageSpaceId: storage.selectedStorageSpaceId,
        storageRow: storage.selectedStorageRow,
        storageSlot: storage.selectedStorageSlot,
        selectedCatalogNameEntry: catalog.selectedCatalogNameEntry,
      });
      if (ok) {
        setDraft(defaultDraft); catalog.setSelectedCatalogNameEntry(null);
        storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1");
        await Promise.all([data.fetchWines(), data.fetchCatalogEntries(), data.fetchReferenceOptions()]);
        success.show("wine_added");
        Alert.alert("Vinet är sparat!", "Vad vill du göra nu?", [
          { text: "Lägg till fler", style: "default" },
          { text: "Gå till min källare", onPress: () => setActiveSection("cellar") },
        ]);
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }
```

**New:**
```ts
  async function handleSaveWine() {
    setSaving(true);
    try {
      const savedRow = await saveNewWine({
        userId: session.user.id,
        draft,
        storageSpaceId: storage.selectedStorageSpaceId,
        storageRow: storage.selectedStorageRow,
        storageSlot: storage.selectedStorageSlot,
        selectedCatalogNameEntry: catalog.selectedCatalogNameEntry,
      });
      if (savedRow) {
        setDraft(defaultDraft); catalog.setSelectedCatalogNameEntry(null);
        storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1");
        const [hydrated] = await hydrateWineRecords([savedRow]);
        data.setWines(prev => [hydrated, ...prev]);
        data.mergeReferenceOptions(savedRow);
        success.show("wine_added");
        Alert.alert("Vinet är sparat!", "Vad vill du göra nu?", [
          { text: "Lägg till fler", style: "default" },
          { text: "Gå till min källare", onPress: () => setActiveSection("cellar") },
        ]);
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }
```

Key changes: Replaces `Promise.all([fetchWines, fetchCatalogEntries, fetchReferenceOptions])` (3 network requests) with local state updates (0 network requests).

---

## Commit 4: Update saveTasting and drinkWine to return rows, update locally

### Task 4.1 — Make saveTastingEntry return the saved WineHistoryRow

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\cellar-actions.ts`

**Old (line 79):**
```ts
export async function saveTastingEntry(args: SaveTastingArgs): Promise<boolean> {
```

**New:**
```ts
export async function saveTastingEntry(args: SaveTastingArgs): Promise<WineHistoryRow | null> {
```

Add `WineHistoryRow` to the import:

**Old (line 14):**
```ts
import type { WineHistoryInsert } from "../types/wine-history";
```

**New:**
```ts
import type { WineHistoryInsert, WineHistoryRow } from "../types/wine-history";
```

**Old (lines 105–107):**
```ts
  const { error } = await supabase.from("wine_history").insert(payload);
  if (error) throw error;
  return true;
```

**New:**
```ts
  const { data, error } = await supabase.from("wine_history").insert(payload).select().single();
  if (error) throw error;
  return data as WineHistoryRow;
```

### Task 4.2 — Make saveDrinkEntry return the saved WineHistoryRow

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\cellar-actions.ts`

**Old (line 121):**
```ts
export async function saveDrinkEntry(args: SaveDrinkArgs): Promise<void> {
```

**New:**
```ts
export async function saveDrinkEntry(args: SaveDrinkArgs): Promise<WineHistoryRow> {
```

**Old (lines 139–140):**
```ts
  const { error: historyError } = await supabase.from("wine_history").insert(payload);
  if (historyError) throw historyError;
```

**New:**
```ts
  const { data: historyData, error: historyError } = await supabase.from("wine_history").insert(payload).select().single();
  if (historyError) throw historyError;
  const savedHistory = historyData as WineHistoryRow;
```

At the end of the function (after the if/else for quantity), add a return:

**Old — end of saveDrinkEntry (the closing `}` of the function, after the quantity if/else block):**
```ts
    setWines((current) => current.map((w) => (w.id === wine.id ? hydrated : w)));
  }
}
```

**New:**
```ts
    setWines((current) => current.map((w) => (w.id === wine.id ? hydrated : w)));
  }
  return savedHistory;
}
```

### Task 4.3 — Update useAddWineTasting to prepend history locally

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useAddWineTasting.ts`

Add new imports and update the Deps type:

**Old (lines 2–5):**
```ts
import { Alert } from "react-native";
import type { WineDraft } from "../types/cellar-drafts";
import type { WsatTastingData } from "../lib/wsat-data";
import { saveTastingEntry } from "../lib/cellar-actions";
```

**New:**
```ts
import { Alert } from "react-native";
import type { WineDraft } from "../types/cellar-drafts";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WsatTastingData } from "../lib/wsat-data";
import { saveTastingEntry } from "../lib/cellar-actions";
import { hydrateWineHistoryRecords } from "../lib/wine-helpers";
```

**Old (lines 8–13):**
```ts
type Deps = {
  userId: string;
  draft: WineDraft;
  resetDraft: () => void;
  fetchHistoryEntries: () => Promise<void>;
  showSuccess: (key: string) => void;
};
```

**New:**
```ts
type Deps = {
  userId: string;
  draft: WineDraft;
  resetDraft: () => void;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  showSuccess: (key: string) => void;
};
```

**Old (lines 23–45 — the `save` callback):**
```ts
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
```

**New:**
```ts
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const savedRow = await saveTastingEntry({
        userId: deps.userId,
        draft: deps.draft,
        tastingRating: rating,
        tastingDate: date,
        wsatData,
      });
      if (savedRow) {
        deps.resetDraft();
        setRating("");
        setWsatData(null);
        setDate(new Date().toISOString().slice(0, 10));
        const [hydrated] = await hydrateWineHistoryRecords([savedRow]);
        deps.setHistoryEntries(prev => [hydrated, ...prev]);
        deps.showSuccess("tasting_saved");
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [deps, rating, date, wsatData]);
```

### Task 4.4 — Update useAddWineTasting call site in App.tsx

**File:** `C:\Projects\vinkällaren\mobile-app\App.tsx`

**Old (lines 144–150):**
```ts
  const tasting = useAddWineTasting({
    userId: session.user.id,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    fetchHistoryEntries: data.fetchHistoryEntries,
    showSuccess: success.show,
  });
```

**New:**
```ts
  const tasting = useAddWineTasting({
    userId: session.user.id,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    setHistoryEntries: data.setHistoryEntries,
    showSuccess: success.show,
  });
```

### Task 4.5 — Export setHistoryEntries from useCellarData

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

**Old (in the return object):**
```ts
    historyEntries,
    storageSpaces,
```

**New:**
```ts
    historyEntries,
    setHistoryEntries,
    storageSpaces,
```

### Task 4.6 — Update useDrinkWineModal to prepend history locally

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useDrinkWineModal.ts`

Update imports and Deps type:

**Old (lines 3–5):**
```ts
import type { WineRecord } from "../types/wine";
import type { WsatTastingData } from "../lib/wsat-data";
import { saveDrinkEntry } from "../lib/cellar-actions";
```

**New:**
```ts
import type { WineRecord } from "../types/wine";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WsatTastingData } from "../lib/wsat-data";
import { saveDrinkEntry } from "../lib/cellar-actions";
import { hydrateWineHistoryRecords } from "../lib/wine-helpers";
```

**Old (lines 7–14):**
```ts
type Deps = {
  userId: string;
  fetchHistoryEntries: () => Promise<void>;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  showSuccess: (key: string) => void;
  pickImageFromLibrary: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
};
```

**New:**
```ts
type Deps = {
  userId: string;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  showSuccess: (key: string) => void;
  pickImageFromLibrary: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
};
```

**Old (lines 43–66 — the `save` callback):**
```ts
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
```

**New:**
```ts
  const save = useCallback(async () => {
    if (!wine) return;
    setSaving(true);
    try {
      const savedHistory = await saveDrinkEntry({
        userId: deps.userId,
        wine,
        rating,
        notes,
        consumedDate,
        imageUri,
        wsatData,
        setWines: deps.setWines,
      });
      const [hydrated] = await hydrateWineHistoryRecords([savedHistory]);
      deps.setHistoryEntries(prev => [hydrated, ...prev]);
      setVisible(false);
      setWine(null);
      deps.showSuccess("wine_drunk");
    } catch (error) {
      Alert.alert("Kunde inte spara historiken", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }, [wine, rating, notes, consumedDate, imageUri, wsatData, deps]);
```

### Task 4.7 — Update useDrinkWineModal call site in App.tsx

**File:** `C:\Projects\vinkällaren\mobile-app\App.tsx`

**Old (lines 106–113):**
```ts
  const drink = useDrinkWineModal({
    userId: session.user.id,
    fetchHistoryEntries: data.fetchHistoryEntries,
    setWines: data.setWines,
    showSuccess: success.show,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
```

**New:**
```ts
  const drink = useDrinkWineModal({
    userId: session.user.id,
    setHistoryEntries: data.setHistoryEntries,
    setWines: data.setWines,
    showSuccess: success.show,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
```

---

## Commit 5: Update editWine to add mergeReferenceOptions

### Task 5.1 — Pass mergeReferenceOptions to useEditWineModal

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useEditWineModal.ts`

Add to Deps type:

**Old (in Deps type):**
```ts
  fetchCatalogEntries: () => Promise<void>;
```

**New:**
```ts
  fetchCatalogEntries: () => Promise<void>;
  mergeReferenceOptions: (wine: import("../types/wine").WineRow) => void;
```

Add `mergeReferenceOptions` call after save:

**Old (in `save` callback, after `saveWineEditEntry`):**
```ts
      await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
      await deps.fetchCatalogEntries();
```

**New:**
```ts
      await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
      deps.mergeReferenceOptions(editingWine as any);
      await deps.fetchCatalogEntries();
```

Note: `saveWineEditEntry` already does local `setWines` update internally. The `mergeReferenceOptions` call ensures any new grape/country/region values from the edit appear in reference options without a refetch. We pass the updated wine data — but since `saveWineEditEntry` already hydrates from the returned row, we need the updated row. Let's refactor slightly:

**Better approach — make saveWineEditEntry return the updated WineRow:**

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\cellar-actions.ts`

**Old (line 160):**
```ts
export async function saveWineEditEntry(args: SaveWineEditArgs): Promise<void> {
```

**New:**
```ts
export async function saveWineEditEntry(args: SaveWineEditArgs): Promise<WineRow | null> {
```

**Old (lines 185–189):**
```ts
  if (updatedWine) {
    await syncCatalogEntryForEditedWine(editingWine, updatedWine, userId);
    const [hydrated] = await hydrateWineRecords([updatedWine]);
    setWines((current) => current.map((w) => (w.id === editingWine.id ? hydrated : w)));
  }
}
```

**New:**
```ts
  if (updatedWine) {
    void syncCatalogEntryForEditedWine(editingWine, updatedWine, userId);
    const [hydrated] = await hydrateWineRecords([updatedWine]);
    setWines((current) => current.map((w) => (w.id === editingWine.id ? hydrated : w)));
  }
  return updatedWine;
}
```

### Task 5.2 — Update useEditWineModal save to use mergeReferenceOptions

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useEditWineModal.ts`

**Old (lines 45–61 — save callback):**
```ts
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
```

**New:**
```ts
  const save = useCallback(async () => {
    if (!editingWine || !draft) return;
    setSaving(true);
    try {
      const updatedRow = await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
      if (updatedRow) deps.mergeReferenceOptions(updatedRow);
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
```

Note: removed `await deps.fetchCatalogEntries()` — the catalog sync is already handled inside `saveWineEditEntry` via `syncCatalogEntryForEditedWine`, and we made that fire-and-forget with `void`. The local catalog display (12 recent entries) will update on next pull-to-refresh.

### Task 5.3 — Update useEditWineModal call site in App.tsx

**File:** `C:\Projects\vinkällaren\mobile-app\App.tsx`

**Old (lines 114–124):**
```ts
  const edit = useEditWineModal({
    userId: session.user.id,
    setWines: data.setWines,
    fetchCatalogEntries: data.fetchCatalogEntries,
    showSuccess: success.show,
    storageSpaces: data.storageSpaces,
    saveStorageSpace: data.saveStorageSpace,
    getOccupiedPositions: storage.getOccupiedPositions,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
```

**New:**
```ts
  const edit = useEditWineModal({
    userId: session.user.id,
    setWines: data.setWines,
    fetchCatalogEntries: data.fetchCatalogEntries,
    mergeReferenceOptions: data.mergeReferenceOptions,
    showSuccess: success.show,
    storageSpaces: data.storageSpaces,
    saveStorageSpace: data.saveStorageSpace,
    getOccupiedPositions: storage.getOccupiedPositions,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
```

---

## Commit 6: Make pull-to-refresh comprehensive

### Task 6.1 — Add catalog + reference options to onRefresh

**File:** `C:\Projects\vinkällaren\mobile-app\App.tsx`

**Old (lines 136–140):**
```ts
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([data.fetchWines(), data.fetchStorageSpaces(), data.fetchHistoryEntries()]);
    setRefreshing(false);
  }, [data.fetchWines, data.fetchStorageSpaces, data.fetchHistoryEntries]);
```

**New:**
```ts
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      data.fetchWines(), data.fetchStorageSpaces(), data.fetchHistoryEntries(),
      data.fetchCatalogEntries(), data.fetchReferenceOptions(),
    ]);
    setRefreshing(false);
  }, [data.fetchWines, data.fetchStorageSpaces, data.fetchHistoryEntries, data.fetchCatalogEntries, data.fetchReferenceOptions]);
```

---

## Commit 7: Skip redundant catalog backfill refetch

### Task 7.1 — Make cacheWineRecordAsCatalogEntry return boolean

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\wine-helpers.ts`

**Old (lines 359–377):**
```ts
export async function cacheWineRecordAsCatalogEntry(wine: WineRecord, userId: string) {
  await cacheCatalogEntry(
    {
      barcode: wine.barcode?.trim() || undefined,
      systembolagetProductId: wine.systembolaget_product_id?.trim() || undefined,
      name: wine.name,
      producer: wine.producer ?? undefined,
      country: wine.country ?? undefined,
      region: wine.region ?? undefined,
      grape: wine.grape ?? undefined,
      type: wine.type ?? undefined,
      vintage: wine.vintage ?? undefined,
      foodPairings: wine.food_pairings ?? [],
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}
```

**New:**
```ts
export async function cacheWineRecordAsCatalogEntry(wine: WineRecord, userId: string): Promise<boolean> {
  return await cacheCatalogEntry(
    {
      barcode: wine.barcode?.trim() || undefined,
      systembolagetProductId: wine.systembolaget_product_id?.trim() || undefined,
      name: wine.name,
      producer: wine.producer ?? undefined,
      country: wine.country ?? undefined,
      region: wine.region ?? undefined,
      grape: wine.grape ?? undefined,
      type: wine.type ?? undefined,
      vintage: wine.vintage ?? undefined,
      foodPairings: wine.food_pairings ?? [],
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}
```

### Task 7.2 — Make cacheCatalogEntry return boolean (true = inserted new)

**File:** `C:\Projects\vinkällaren\mobile-app\src\lib\product-catalog.ts`

**Old (lines 251–285):**
```ts
export async function cacheCatalogEntry(entry: ProductCatalogEntry, userId?: string | null) {
  const payload = mapEntryToCatalogInsert(entry, userId);

  if (!payload.name?.trim()) {
    return;
  }

  let error: { message: string } | null = null;

  // Find existing entry by barcode, systembolaget_product_id, or name+producer+vintage
  let existingId: string | null = null;
  if (payload.barcode) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("barcode", payload.barcode).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId && payload.systembolaget_product_id) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("systembolaget_product_id", payload.systembolaget_product_id).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId) {
    existingId = await findExistingManualCatalogEntryId(payload);
  }

  if (existingId) {
    const result = await supabase.from("product_catalog_wines").update(payload).eq("id", existingId);
    error = result.error;
  } else {
    const result = await supabase.from("product_catalog_wines").insert(payload);
    error = result.error;
  }

  if (error) {
    console.warn("Could not cache product catalog entry", error.message);
  }
}
```

**New:**
```ts
export async function cacheCatalogEntry(entry: ProductCatalogEntry, userId?: string | null): Promise<boolean> {
  const payload = mapEntryToCatalogInsert(entry, userId);

  if (!payload.name?.trim()) {
    return false;
  }

  let error: { message: string } | null = null;
  let inserted = false;

  // Find existing entry by barcode, systembolaget_product_id, or name+producer+vintage
  let existingId: string | null = null;
  if (payload.barcode) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("barcode", payload.barcode).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId && payload.systembolaget_product_id) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("systembolaget_product_id", payload.systembolaget_product_id).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId) {
    existingId = await findExistingManualCatalogEntryId(payload);
  }

  if (existingId) {
    const result = await supabase.from("product_catalog_wines").update(payload).eq("id", existingId);
    error = result.error;
  } else {
    const result = await supabase.from("product_catalog_wines").insert(payload);
    error = result.error;
    inserted = !error;
  }

  if (error) {
    console.warn("Could not cache product catalog entry", error.message);
  }
  return inserted;
}
```

### Task 7.3 — Update catalog backfill to skip refetch when no new entries

**File:** `C:\Projects\vinkällaren\mobile-app\src\hooks\useCellarData.ts`

**Old (lines 239–259):**
```ts
  useEffect(() => {
    if (catalogBackfillDone || loading || wines.length === 0) return;
    const completeWines = wines.filter((wine) => canBeSavedAsCatalogEntry(wine));
    if (completeWines.length === 0) {
      setCatalogBackfillDone(true);
      return;
    }
    let cancelled = false;
    const runBackfill = async () => {
      for (const wine of completeWines) {
        if (cancelled) return;
        await cacheWineRecordAsCatalogEntry(wine, userId);
      }
      if (!cancelled) {
        await fetchCatalogEntries();
        setCatalogBackfillDone(true);
      }
    };
    void runBackfill();
    return () => { cancelled = true; };
  }, [catalogBackfillDone, loading, userId, wines]);
```

**New:**
```ts
  useEffect(() => {
    if (catalogBackfillDone || loading || wines.length === 0) return;
    const completeWines = wines.filter((wine) => canBeSavedAsCatalogEntry(wine));
    if (completeWines.length === 0) {
      setCatalogBackfillDone(true);
      return;
    }
    let cancelled = false;
    const runBackfill = async () => {
      let insertedCount = 0;
      for (const wine of completeWines) {
        if (cancelled) return;
        const inserted = await cacheWineRecordAsCatalogEntry(wine, userId);
        if (inserted) insertedCount++;
      }
      if (!cancelled) {
        if (insertedCount > 0) await fetchCatalogEntries();
        setCatalogBackfillDone(true);
      }
    };
    void runBackfill();
    return () => { cancelled = true; };
  }, [catalogBackfillDone, loading, userId, wines]);
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered | Task |
|---|---|---|
| createGuardedFetcher + wrap 3 fetchers | Yes | 1.1, 1.2 |
| mergeReferenceOptions helper | Yes | 2.1, 2.2 |
| saveWine — use returned row, no refetch | Yes | 3.1, 3.2 |
| saveTasting — return row, local update | Yes | 4.1, 4.3, 4.4 |
| drinkWine — return row, local update | Yes | 4.2, 4.6, 4.7 |
| editWine — add mergeReferenceOptions | Yes | 5.1, 5.2, 5.3 |
| Pull-to-refresh — add catalog + reference | Yes | 6.1 |
| Catalog backfill — conditional refetch | Yes | 7.1, 7.2, 7.3 |
| Image URL TTL — out of scope | N/A | Noted in spec |

### Placeholder scan
No TODOs, no placeholder values. All code is complete.

### Type consistency check
- `saveNewWine` returns `WineRow | null` (was `boolean`) — call site updated to check truthiness (works identically since `null` is falsy, `WineRow` is truthy)
- `saveTastingEntry` returns `WineHistoryRow | null` (was `boolean`) — call site checks `savedRow` truthiness
- `saveDrinkEntry` returns `WineHistoryRow` (was `void`) — call site captures return value
- `saveWineEditEntry` returns `WineRow | null` (was `void`) — call site checks with `if (updatedRow)`
- `cacheCatalogEntry` returns `Promise<boolean>` (was `Promise<void>`) — callers that don't use return value are unaffected
- `cacheWineRecordAsCatalogEntry` returns `Promise<boolean>` (was `Promise<void>`) — backfill uses it, other callers ignore it
- `mergeReferenceOptions` parameter is `WineRow` — compatible with `WineRecord` (which extends `WineRow`)
- `ReferenceOptionRow` in `mergeReferenceOptions` additions includes `aliases` and `parent_name` fields to match the type

### Net line delta estimate
- +10 lines: `createGuardedFetcher` utility
- +12 lines: `mergeReferenceOptions` helper
- +3 lines: guarded fetcher wrappers (3 lines of `const fetchX = createGuardedFetcher(fetchXRaw)`)
- -3 lines: removed `Promise.all([fetchWines, fetchCatalogEntries, fetchReferenceOptions])` in handleSaveWine
- -2 lines: removed `await deps.fetchHistoryEntries()` in two hooks
- -1 line: removed `await deps.fetchCatalogEntries()` in useEditWineModal
- +5 lines: local prepend logic in hooks
- +3 lines: `insertedCount` tracking in backfill
- **Net: ~+27 lines** across 7 files
