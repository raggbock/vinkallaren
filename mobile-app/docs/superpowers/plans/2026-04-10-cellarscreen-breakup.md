# CellarScreen Breakup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break up the ~390-line CellarScreen god component into a thin shared context + independent tab components that each own their hooks and modals.

**Architecture:** A `CellarContext` provides shared data (wines, storage, userId, profile) to all tabs. Each tab is its own file with lazy initialization. Modals that are triggered from multiple tabs live in a `SharedModals` component. The 5 mega-prop types (FilterProps, StorageProps, etc.) are eliminated as tabs read context directly.

**Tech Stack:** React Context, React Native, existing custom hooks

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/contexts/CellarContext.tsx` | Create: Shared context + provider + `useCellar` hook |
| `src/components/cellar-tab.tsx` | Create: Wine list tab (reads context, owns filters + wine action modals) |
| `src/components/history-tab.tsx` | Create: History tab (reads context, owns history editing) |
| `src/components/meal-tab.tsx` | Create: Meal planner tab (reads context, pure display) |
| `src/components/add-wine-tab.tsx` | Create: Add wine tab (owns catalog chain, scanners, storage selection) |
| `src/components/shared-modals.tsx` | Create: Cross-tab modals (EditWineModal, SuccessOverlay, etc.) |
| `App.tsx` | Modify: CellarScreen shrinks from ~390 to ~80 lines |
| `src/types/panel-prop-groups.ts` | Delete: No longer needed |

---

### Task 1: Create CellarContext

**Files:**
- Create: `src/contexts/CellarContext.tsx`

- [ ] **Step 1: Create the context file**

```tsx
import { createContext, useContext } from "react";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceRow } from "../types/storage-space";

export type CellarContextValue = {
  userId: string;
  wines: WineRecord[];
  winesLoading: boolean;
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  refreshWines: () => Promise<WineRecord[] | undefined>;
  fetchMoreWines: () => Promise<void>;
  hasMoreWines: boolean;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  deleteWine: (id: string, imagePath?: string | null) => Promise<void>;
  storageSpaceBottleCounts: Map<string, number>;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  cellarGrapeOptions: string[];
};

const CellarContext = createContext<CellarContextValue | null>(null);

export function useCellar(): CellarContextValue {
  const ctx = useContext(CellarContext);
  if (!ctx) throw new Error("useCellar must be used inside CellarProvider");
  return ctx;
}

export { CellarContext };
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: No errors related to CellarContext.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/CellarContext.tsx
git commit -m "feat: create CellarContext for shared cellar state"
```

---

### Task 2: Extract MealTab (simplest tab)

**Files:**
- Create: `src/components/meal-tab.tsx`
- Modify: `App.tsx` (remove MealPlannerPanel rendering, use MealTab)

- [ ] **Step 1: Create meal-tab.tsx**

Extract the meal panel logic from App.tsx lines 399-406. MealTab reads wines from context and owns `selectedMeal` state locally.

```tsx
import { useState, useMemo } from "react";
import { useCellar } from "../contexts/CellarContext";
import { MealPlannerPanel } from "./cellar-sections";
import { buildMealRecommendations } from "../lib/cellar-helpers";
import { styles } from "../styles/theme";

type Props = {
  hidden: boolean;
  onWinePress: (wineId: string) => void;
  onOpenProfile: () => void;
};

export function MealTab({ hidden, onWinePress, onOpenProfile }: Props) {
  const { wines } = useCellar();
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const mealRecommendations = useMemo(
    () => buildMealRecommendations(wines, selectedMeal),
    [selectedMeal, wines],
  );

  if (hidden) return null;

  return (
    <MealPlannerPanel
      styles={styles}
      wines={wines}
      selectedMeal={selectedMeal}
      mealRecommendations={mealRecommendations}
      onSelectMeal={setSelectedMeal}
      onWinePress={(wine) => onWinePress(wine.id)}
      onOpenProfile={onOpenProfile}
    />
  );
}
```

- [ ] **Step 2: Wire MealTab into App.tsx**

In App.tsx CellarScreen, replace the meal panel block (lines 399-406) with:

```tsx
import { MealTab } from "./src/components/meal-tab";
```

And in the render, replace:
```tsx
} else if (activeSection === "meal") {
    activePanel = (
      <MealPlannerPanel styles={styles} wines={wineData.wines} selectedMeal={selectedMeal} mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
        onWinePress={(wine) => { setHighlightedWineId(wine.id); setActiveSection("cellar"); }}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
```

With:
```tsx
} else if (activeSection === "meal") {
    activePanel = (
      <MealTab hidden={false}
        onWinePress={(id) => { setHighlightedWineId(id); setActiveSection("cellar"); }}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
```

Also remove `selectedMeal` state and `mealRecommendations` useMemo from CellarScreen (they now live in MealTab).

- [ ] **Step 3: Wrap CellarScreen in CellarContext.Provider**

Add the context provider in CellarScreen's return. The value object collects data from the existing hooks:

```tsx
import { CellarContext, type CellarContextValue } from "./src/contexts/CellarContext";
```

Wrap the return in:
```tsx
const cellarCtx: CellarContextValue = {
  userId: session.user.id,
  wines: wineData.wines,
  winesLoading: wineData.loading,
  storageSpaces: storageData.storageSpaces,
  storageSpaceById,
  refreshWines: wineData.fetchWines,
  fetchMoreWines: wineData.fetchMoreWines,
  hasMoreWines: wineData.hasMoreWines,
  setWines: wineData.setWines,
  deleteWine: wineData.deleteWine,
  storageSpaceBottleCounts: wineData.storageSpaceBottleCounts,
  pairingOptions: wineData.pairingOptions,
  countryOptions: wineData.countryOptions,
  regionOptions: wineData.regionOptions,
  typeOptions: wineData.typeOptions,
  vintageOptions: wineData.vintageOptions,
  cellarGrapeOptions: wineData.cellarGrapeOptions,
};
```

Then wrap the SafeAreaView in `<CellarContext.Provider value={cellarCtx}>...</CellarContext.Provider>`.

- [ ] **Step 4: Verify build**

Run: `npm run web:build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/meal-tab.tsx src/contexts/CellarContext.tsx App.tsx
git commit -m "refactor: extract MealTab and create CellarContext provider"
```

---

### Task 3: Extract HistoryTab

**Files:**
- Create: `src/components/history-tab.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create history-tab.tsx**

Extract history panel + edit history modal logic from App.tsx.

```tsx
import { useCallback, useState } from "react";
import { HistoryPanel } from "./cellar-sections";
import { updateHistoryEntry } from "../lib/cellar-actions";
import { showError } from "../lib/show-error";
import { useCellar } from "../contexts/CellarContext";
import { useHistory } from "../hooks/useHistory";
import { useSuccessOverlay } from "./success-overlay";
import { styles } from "../styles/theme";
import type { WineHistoryRecord } from "../types/wine-history";
import type { TastingSessionRow } from "../types/tasting-session";

type Props = {
  hidden: boolean;
  endedSessions: TastingSessionRow[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenProfile: () => void;
};

export function HistoryTab({ hidden, endedSessions, refreshing, onRefresh, onOpenProfile }: Props) {
  const { storageSpaceById } = useCellar();
  const historyData = useHistory();
  const [editingHistory, setEditingHistory] = useState<WineHistoryRecord | null>(null);
  const [editHistorySaving, setEditHistorySaving] = useState(false);
  const success = useSuccessOverlay();

  const handleSaveHistoryEdit = useCallback(async (fields: { rating: string; notes: string; date: string; quantity: string }) => {
    if (!editingHistory) return;
    setEditHistorySaving(true);
    const result = await updateHistoryEntry({
      id: editingHistory.id,
      rating: fields.rating ? Number(fields.rating) : null,
      tasting_notes: fields.notes.trim() || null,
      consumed_at: fields.date,
      quantity_consumed: Math.max(1, Number(fields.quantity) || 1),
    });
    setEditHistorySaving(false);
    if (result.error) { showError("Kunde inte spara ändringen", result.error); return; }
    historyData.setHistoryEntries((prev) => prev.map((e) => (e.id === editingHistory.id ? { ...e, ...result.data! } : e)));
    setEditingHistory(null);
    success.show("history_edited");
  }, [editingHistory, historyData, success]);

  if (hidden) return null;

  return (
    <>
      <HistoryPanel
        styles={styles}
        historyEntries={historyData.historyEntries}
        loadingHistory={historyData.loadingHistory}
        storageSpaceById={storageSpaceById}
        endedSessions={endedSessions}
        refreshing={refreshing}
        onRefresh={onRefresh}
        hasMore={historyData.hasMoreHistory}
        onLoadMore={historyData.fetchMoreHistory}
        onEditEntry={setEditingHistory}
        onOpenProfile={onOpenProfile}
      />
    </>
  );
}
```

Note: EditHistoryModal rendering stays in App.tsx for now (it's lazy-loaded). We'll move it in a later task.

- [ ] **Step 2: Wire HistoryTab into App.tsx**

Replace the history panel block in App.tsx with:
```tsx
} else if (activeSection === "history") {
    activePanel = (
      <HistoryTab hidden={false}
        endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
        refreshing={refreshing} onRefresh={onRefresh}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
```

Remove `useHistory` hook call, `editingHistory` state, `editHistorySaving` state, and `handleSaveHistoryEdit` callback from CellarScreen (they now live in HistoryTab).

- [ ] **Step 3: Verify build**

Run: `npm run web:build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/history-tab.tsx App.tsx
git commit -m "refactor: extract HistoryTab with history editing logic"
```

---

### Task 4: Extract CellarTab

**Files:**
- Create: `src/components/cellar-tab.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create cellar-tab.tsx**

CellarTab owns: filters, wine actions, highlighted wine state. Reads wines from context.

```tsx
import { useCallback, useMemo, useState } from "react";
import { useCellar } from "../contexts/CellarContext";
import { useCellarFilters } from "../hooks/useCellarFilters";
import { MinKallarePanel } from "./min-kallare-panel";
import { confirmAction } from "../lib/show-error";
import { openSystembolaget } from "../lib/cellar-actions";
import { styles } from "../styles/theme";
import type { WineRecord } from "../types/wine";

type Props = {
  hidden: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onNavigateToAdd: () => void;
  onOpenTastingSessions: () => void;
  onOpenProfile: () => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
};

export function CellarTab({
  hidden, refreshing, onRefresh, onNavigateToAdd,
  onOpenTastingSessions, onOpenProfile, onEditWine, onDrinkWine,
}: Props) {
  const ctx = useCellar();
  const filters = useCellarFilters(ctx.wines, ctx.storageSpaceById);
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);

  const wineActions = useMemo(() => ({
    onEditWine,
    onDrinkWine,
    onDeleteWine: (id: string, imagePath: string | null) =>
      confirmAction("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?", () => ctx.deleteWine(id, imagePath)),
    onOpenSystembolaget: (productId: string) => openSystembolaget(productId),
  }), [onEditWine, onDrinkWine, ctx.deleteWine]);

  const filterProps = useMemo(() => ({
    searchQuery: filters.searchQuery, selectedPairingFilter: filters.selectedPairingFilter,
    selectedCountryFilter: filters.selectedCountryFilter, selectedRegionFilter: filters.selectedRegionFilter,
    selectedTypeFilter: filters.selectedTypeFilter, selectedVintageFilter: filters.selectedVintageFilter,
    selectedGrapeFilter: filters.selectedGrapeFilter, selectedStorageSpaceFilterId: filters.selectedStorageSpaceFilterId,
    pairingOptions: ctx.pairingOptions, countryOptions: ctx.countryOptions,
    regionOptions: ctx.regionOptions, typeOptions: ctx.typeOptions,
    vintageOptions: ctx.vintageOptions, grapeOptions: ctx.cellarGrapeOptions,
    onSearchChange: filters.setSearchQuery, onPairingChange: filters.setSelectedPairingFilter,
    onCountryChange: filters.setSelectedCountryFilter, onRegionChange: filters.setSelectedRegionFilter,
    onTypeChange: filters.setSelectedTypeFilter, onVintageChange: filters.setSelectedVintageFilter,
    onGrapeChange: filters.setSelectedGrapeFilter, onStorageSpaceFilterChange: filters.setSelectedStorageSpaceFilterId,
  }), [filters, ctx]);

  const storageProps = useMemo(() => ({
    storageSpaces: ctx.storageSpaces, storageSpaceById: ctx.storageSpaceById,
    storageSpaceBottleCounts: ctx.storageSpaceBottleCounts,
  }), [ctx.storageSpaces, ctx.storageSpaceById, ctx.storageSpaceBottleCounts]);

  if (hidden) return null;

  return (
    <MinKallarePanel
      styles={styles}
      stats={(ctx as any).stats ?? { total: ctx.wines.length }}
      filter={filterProps}
      storage={storageProps}
      wineActions={wineActions}
      filteredWines={filters.filteredWines}
      loading={ctx.winesLoading}
      onRefreshStats={ctx.refreshWines}
      onSignOut={onOpenProfile}
      onNavigateToAdd={onNavigateToAdd}
      onOpenTastingSessions={onOpenTastingSessions}
      hasMoreWines={ctx.hasMoreWines}
      onLoadMoreWines={ctx.fetchMoreWines}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
      onHighlightWine={setHighlightedWineId}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}
```

Note: CellarTab still passes `filterProps` and `storageProps` to MinKallarePanel because MinKallarePanel expects those shapes. A future PR can refactor MinKallarePanel to read context directly — that's a separate scope.

- [ ] **Step 2: Add `stats` to CellarContextValue**

In `src/contexts/CellarContext.tsx`, add to the type:
```typescript
stats: { total: number; countries: number; types: number; producers: number; grapes: number; oldestVintage: number | null; storageSpaces: number };
```

And in CellarScreen, add `stats: wineData.stats` to the context value.

- [ ] **Step 3: Wire CellarTab into App.tsx**

Replace the MinKallarePanel rendering in App.tsx with CellarTab. Remove `useCellarFilters`, `filterProps`, `wineActionsProps`, `highlightedWineId` state from CellarScreen.

- [ ] **Step 4: Verify build**

Run: `npm run web:build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/components/cellar-tab.tsx src/contexts/CellarContext.tsx App.tsx
git commit -m "refactor: extract CellarTab with filters and wine actions"
```

---

### Task 5: Extract AddWineTab (most complex)

**Files:**
- Create: `src/components/add-wine-tab.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Create add-wine-tab.tsx with lazy activation**

This tab owns the most hooks: catalog chain, scanners, storage selection, vintage picker, draft state. Uses lazy init so hooks only run on first visit.

```tsx
import { lazy, Suspense, useCallback, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useCellar } from "../contexts/CellarContext";
import { useCatalog } from "../hooks/useCatalog";
import { useCatalogLookup } from "../hooks/useCatalogLookup";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useLabelScanner } from "../hooks/useLabelScanner";
import { useVintagePicker } from "../hooks/useVintagePicker";
import { useStorageSelection } from "../hooks/useStorageSelection";
import { useStorageSpaces } from "../hooks/useStorageSpaces";
import { useImagePicker } from "../hooks/useImagePicker";
import { useReferenceOptions } from "../hooks/useReferenceOptions";
import { useAddWineTasting } from "../hooks/useAddWineTasting";
import { useSuccessOverlay } from "./success-overlay";
import { useSessionWset } from "../hooks/useSessionWset";
import { saveNewWine } from "../lib/cellar-actions";
import { hydrateWineRecords } from "../lib/wine-helpers";
import { showError } from "../lib/show-error";
import { AddWinePanel } from "./add-wine-panel";
import { SuccessOverlay } from "./success-overlay";
import { defaultDraft, type WineDraft } from "../types/cellar-drafts";
import { styles, colors } from "../styles/theme";
import { Alert, Platform } from "react-native";
import type { ProductCatalogWineRow } from "../types/product-catalog";

const BarcodeScannerModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.BarcodeScannerModal })));
const VintagePickerModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.VintagePickerModal })));
const LabelMatchPickerModal = lazy(() => import("./label-match-picker").then(m => ({ default: m.LabelMatchPickerModal })));
const WsetTastingModal = lazy(() => import("./wset-tasting-modal").then(m => ({ default: m.WsetTastingModal })));

type Props = {
  hidden: boolean;
  onOpenProfile: () => void;
  onNavigateToCellar: () => void;
};

export function AddWineTab({ hidden, onOpenProfile, onNavigateToCellar }: Props) {
  const [activated, setActivated] = useState(false);
  if (!hidden && !activated) setActivated(true);
  if (!activated) return null;
  return (
    <Suspense fallback={<ActivityIndicator color={colors.accent} />}>
      <AddWineTabContent hidden={hidden} onOpenProfile={onOpenProfile} onNavigateToCellar={onNavigateToCellar} />
    </Suspense>
  );
}
```

The `AddWineTabContent` function will contain all the hook calls and rendering. This should be implemented as a separate function in the same file, containing the hooks from App.tsx lines 120-146 (catalog chain), lines 223-234 (draft, saving), lines 236-242 (tasting), lines 288-315 (handleSaveWine), and the AddWinePanel rendering from lines 407-434, plus scanner modals from lines 459-462.

This is the largest extraction. The implementer should:
1. Read CellarScreen carefully
2. Move the relevant hooks, state, and callbacks
3. Move the scanner modal JSX
4. Keep the same behavior

- [ ] **Step 2: Remove extracted code from App.tsx**

Remove from CellarScreen:
- `useCatalog`, `useCatalogLookup`, `useBarcodeScanner`, `useLabelScanner`, `useVintagePicker` hook calls
- `useStorageSelection`, `useImagePicker`, `useReferenceOptions` hook calls
- `useAddWineTasting`, `useSessionWset` hook calls (only the ones used by AddWinePanel)
- `selectedCatalogNameEntry` state
- `draft`, `saving` state
- `handleSaveWine` function
- `catalogProps`, `tastingGroupProps` useMemo blocks
- The AddWinePanel rendering block
- Scanner modal JSX (BarcodeScannerModal, LabelMatchPickerModal, VintagePickerModal)
- The WsetTastingModal for draft tasting

- [ ] **Step 3: Verify build**

Run: `npm run web:build 2>&1 | tail -5`

- [ ] **Step 4: Verify the app works**

Open the app, navigate to each tab, verify nothing crashes.

- [ ] **Step 5: Commit**

```bash
git add src/components/add-wine-tab.tsx App.tsx
git commit -m "refactor: extract AddWineTab with catalog chain and scanner hooks"
```

---

### Task 6: Clean up App.tsx and delete panel-prop-groups.ts

**Files:**
- Modify: `App.tsx`
- Delete: `src/types/panel-prop-groups.ts` (if no longer imported)

- [ ] **Step 1: Remove unused imports from App.tsx**

After Tasks 2-5, many imports in App.tsx are no longer needed. Remove all imports that are now handled by tab components. Check with:

```bash
npx tsc --noEmit 2>&1 | grep "declared but"
```

- [ ] **Step 2: Check if panel-prop-groups.ts is still imported**

```bash
grep -r "panel-prop-groups" src/ App.tsx
```

If only App.tsx imported it and the types are no longer used, delete the file. If CellarTab still uses FilterProps, keep it for now.

- [ ] **Step 3: Count lines in CellarScreen**

```bash
sed -n '/^function CellarScreen/,/^}/p' App.tsx | wc -l
```

Target: Under 120 lines (from ~390).

- [ ] **Step 4: Run all tests**

```bash
npx jest --selectProjects unit
npm run web:build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/types/panel-prop-groups.ts
git commit -m "refactor: clean up App.tsx after tab extraction (~390 → ~100 lines)"
```

---

## Post-Implementation

After all tasks:
1. Run `npm run web:build` — production build must succeed
2. Run `npx jest --selectProjects unit` — all tests must pass
3. Manual test: navigate all 4 tabs, add a wine, run a tasting session
4. Verify CellarScreen is under 120 lines
5. Each tab file should be under 200 lines
