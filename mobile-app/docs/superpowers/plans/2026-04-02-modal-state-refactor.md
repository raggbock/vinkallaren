# RFC: Extract Modal State from App.tsx into Dedicated Workflow Hooks

**Status:** Proposed
**Date:** 2026-04-02
**Category:** Refactor

## Problem

`App.tsx` (`CellarScreen`) currently manages **~37 `useState` calls**, of which **~25 are modal-related**. Each modal workflow (drink, edit, catalog editor, WSAT×3, tasting sessions, privacy) requires:

- Visibility flag (`xxxVisible`)
- Entity/draft data (`selectedXxx`, `xxxDraft`)
- Form field state (`xxxRating`, `xxxNotes`, etc.)
- Saving flag (`savingXxx`)
- Open/close/save handler functions

This results in:
- **Massive prop drilling** — `MinKallarePanel` receives 40+ props
- **Hard to trace** which state belongs to which modal
- **Impossible to test** modal lifecycle independently
- **Adding a new modal** requires 3-4 new state variables + handler functions scattered across App.tsx

## Proposed Solution: Dedicated Hooks Per Modal

Each modal workflow gets its own hook that encapsulates **all** state for that workflow. App.tsx calls the hooks and passes minimal props.

**Design principle:** Extend the existing pattern. The codebase already uses `useCellarData`, `useCatalogWorkflow`, `useTastingSessions`. This adds `useDrinkWineModal`, `useEditWineModal`, `useCatalogEditorModal`.

## Interface

Each hook takes a shared `ModalDeps` bag and returns `[actions, modalProps]`:

```typescript
// Shared dependency bag — built once in CellarScreen
interface ModalDeps {
  userId: string;
  fetchWines: () => Promise<void>;
  fetchHistoryEntries: () => Promise<void>;
  fetchCatalogEntries: () => Promise<void>;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  showSuccess: (key: string) => void;
}

// Each hook returns actions (for callers) + props (for the modal component)
const [drinkActions, drinkProps, drinkWsatProps] = useDrinkWineModal(deps);
const [editActions, editProps] = useEditWineModal(deps);
const [catalogActions, catalogProps] = useCatalogEditorModal(deps);
const privacy = useModalToggle(); // simple visibility toggle
```

## What Changes

**Before** — App.tsx CellarScreen:
```typescript
// 9 useState calls just for the drink modal
const [drinkModalVisible, setDrinkModalVisible] = useState(false);
const [selectedDrinkWine, setSelectedDrinkWine] = useState<WineRecord | null>(null);
const [drinkRating, setDrinkRating] = useState("");
const [drinkNotes, setDrinkNotes] = useState("");
const [drinkConsumedDate, setDrinkConsumedDate] = useState("");
const [drinkImageUri, setDrinkImageUri] = useState("");
const [drinkWsatData, setDrinkWsatData] = useState<WsatTastingData | null>(null);
const [drinkWsatModalVisible, setDrinkWsatModalVisible] = useState(false);
const [savingDrinkHistory, setSavingDrinkHistory] = useState(false);
// ... repeat for edit (4), catalog (3), WSAT (6), privacy (1), tasting (5)
// Plus 8 handler functions (openDrinkModal, closeDrinkModal, handleSaveDrink, ...)
```

**After** — App.tsx CellarScreen:
```typescript
const deps: ModalDeps = useMemo(() => ({
  userId: session.user.id,
  fetchWines: data.fetchWines,
  fetchHistoryEntries: data.fetchHistoryEntries,
  fetchCatalogEntries: data.fetchCatalogEntries,
  setWines: data.setWines,
  showSuccess: success.show,
}), [/* ... */]);

const [drinkActions, drinkProps, drinkWsatProps] = useDrinkWineModal(deps);
const [editActions, editProps] = useEditWineModal(deps);
const [catalogActions, catalogProps] = useCatalogEditorModal(deps);
const privacy = useModalToggle();

// Pass stable action refs to child components:
<MinKallarePanel onDrinkWine={drinkActions.open} onEditWine={editActions.open} ... />

// Spread props to modals:
<DrinkWineModal {...drinkProps} styles={styles} />
<WsatTastingModal {...drinkWsatProps} wineType={drinkProps.wine?.type || ""} />
<EditWineModal {...editProps} styles={styles} ... />
```

## State Removed From App.tsx Per Workflow

| Workflow | useState removed | Functions removed |
|---|---|---|
| DrinkWine | 9 | 3 (open, close, save) |
| EditWine | 4 | 3 (open, close, save) |
| CatalogEditor | 3 | 3 (save, delete, close) |
| WSAT toggles (×3) | 6 | 0 |
| Privacy | 1 | 0 |
| Tasting mode | 5 | 1 (save) |
| **Total** | **~28** | **~10** |

App.tsx drops from **~493 lines to ~250 lines**.

## New Files

| File | Lines (est.) | Purpose |
|---|---|---|
| `src/hooks/useDrinkWineModal.ts` | ~100 | Drink modal state + save handler |
| `src/hooks/useEditWineModal.ts` | ~80 | Edit modal state + hydration + save |
| `src/hooks/useCatalogEditorModal.ts` | ~70 | Catalog editor state + save/delete |
| `src/hooks/useModalToggle.ts` | ~15 | Simple visibility toggle (privacy, WSAT) |
| `src/types/modal-deps.ts` | ~15 | Shared `ModalDeps` interface |

All files well within the 500-line limit.

## Migration Path

Incremental — one modal per commit:

1. Extract `useDrinkWineModal` (most complex, 9 state vars) — verify App.tsx shrinks
2. Extract `useEditWineModal` — same pattern, simpler
3. Extract `useCatalogEditorModal`
4. Extract WSAT toggles + privacy into `useModalToggle`
5. Clean up: remove dead state, verify no regressions

Each step is independently reviewable and revertable.

## Alternatives Considered

### Discriminated Union Reducer

Single `useReducer` with a union type per modal kind. Guarantees only one modal open at a time. **Rejected because:** all-or-nothing migration, introduces a new pattern (reducer) foreign to the codebase, and we actually do need multiple modals open simultaneously (WSAT sub-modal on top of drink modal).

### Generic `useModalWorkflow<TEntity, TDraft>`

Reusable hook with config object per workflow. Elegant but adds indirection — callers must understand the generic type parameters and config shape. The dedicated hook pattern is simpler and matches existing conventions.

## Dependencies

- No external libraries needed
- No database changes
- No component API changes (modal components keep their current props)

## Quick Wins (can be done alongside or before this refactor)

These came from the same codebase review:

| Issue | Location | Fix |
|---|---|---|
| Dead code: `buildMealSuggestions()` | `cellar-helpers.ts:107` | Delete |
| Dead code: `toWineNameReferenceRows()` | `wine-helpers.ts:304` | Delete |
| Duplicated SPACE_TYPE constants | `form-controls.tsx` + `min-kallare-panel.tsx` | Extract to shared constants |
| Re-export shims | `cellar-sections.tsx`, `cellar-workflows.tsx` | Update App.tsx imports, remove shims |
| Vintage range mismatch | `wines.vintage` CHECK 1900 vs catalog 1800 | Align to 1800-2100 |
| theme.ts over 500 lines (679) | `src/styles/theme.ts` | Split by domain |
