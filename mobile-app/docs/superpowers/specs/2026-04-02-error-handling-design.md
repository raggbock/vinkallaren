# Error Handling Unification — Design Spec

**Date:** 2026-04-02
**Status:** Draft

## Problem

22 error handling call sites across 10 files using 3 inconsistent patterns:

| Pattern | Where | Count | Problem |
|---------|-------|-------|---------|
| `Alert.alert` directly in `lib/` | session-actions.ts, cellar-actions.ts | ~18 | `lib/` should be pure logic — `Alert` is a React Native UI API |
| `throw` from `lib/`, caught by hook `try/catch` that Alerts | cellar-actions.ts → useEditWineModal.ts etc. | ~5 | Validation throws use sentinel messages (`"missing_name"`) that callers must know to filter |
| Silent return of `[]`/`null` | product-catalog.ts, fetchSessionParticipants | ~4 | Fine for search, but inconsistent when mixed with Alert in same file |

The worst violation: `session-actions.ts` and `cellar-actions.ts` both import `Alert` from `react-native` — these are `src/lib/` files that should contain zero React Native APIs.

## Design Goals

1. **`lib/` never touches UI.** No `Alert`, no React imports.
2. **One error pattern per layer.** `lib/` returns results; `hooks/` shows errors.
3. **Minimal code change.** No new abstractions beyond one small utility type + one small helper.
4. **Keep it under 40 lines of new code total.**

## Approach

### 1. Result type for `lib/` functions

New file `src/types/result.ts` (~5 lines):

```ts
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export const ok = <T>(data: T): Result<T> => ({ data, error: null });
export const fail = <T>(error: string): Result<T> => ({ data: null, error });
```

Mirrors how Supabase already returns `{ data, error }`.

### 2. Shared `showError` helper for hooks

New file `src/lib/show-error.ts` (~5 lines):

```ts
import { Alert } from "react-native";

export function showError(title: string, detail?: string) {
  Alert.alert(title, detail ?? "Försök igen.");
}
```

One import controlling all error display — easy to swap to toast/banner later.

### 3. Silent returns for search — keep as-is

Functions returning `[]`/`null` on no-match (`searchCatalogWineNames`, `fetchCatalogEntriesByName`, `matchCatalogByText`, `fetchSessionParticipants`) are correct behavior. No change.

## Migration Patterns

### Pattern A: `session-actions.ts` (Alert + return null)

**Before:**
```ts
if (error.code !== "23505") { Alert.alert("Kunde inte skapa provning", error.message); return null; }
```

**After:**
```ts
if (error.code !== "23505") return fail("Kunde inte skapa provning");
```

Hook caller changes to:
```ts
const result = await createSession(userId, input);
if (result.error) { showError("Kunde inte skapa provning", result.error); return; }
const session = result.data;
```

### Pattern B: `cellar-actions.ts` validation (Alert + throw sentinel)

**Before:**
```ts
if (!editWineDraft.name.trim()) {
  Alert.alert("Namn saknas", "Skriv in vilket vin du vill spara.");
  throw new Error("missing_name");
}
```

**After:**
```ts
if (!editWineDraft.name.trim()) {
  return fail("Namn saknas: Skriv in vilket vin du vill spara.");
}
```

Hook caller — no more sentinel filtering:
```ts
const result = await saveWineEditEntry(args);
if (result.error) { showError("Kunde inte spara", result.error); return; }
```

### Pattern C: `cellar-actions.ts` Supabase throws

**Before:** `if (error) throw error;`
**After:** `if (error) return fail(error.message);`

### Pattern D: `useCellarData.ts` inline Alerts (8 fetch functions)

Already in hooks — just swap to `showError` for consistency:

**Before:** `if (error) { Alert.alert("Kunde inte hämta viner", error.message); setLoading(false); return; }`
**After:** `if (error) { showError("Kunde inte hämta viner", error.message); setLoading(false); return; }`

### Pattern E: Component-level validation Alerts — keep as-is

Inline one-liner guards in UI (`if (!title.trim()) { Alert.alert("Titel saknas"); return; }`) stay in components where `Alert` belongs.

### Pattern F: Informational Alerts — keep as-is

Success/info notifications (`Alert.alert("Kopierat!", ...)`) are not error handling. Out of scope.

## What NOT to do

- No ErrorBoundary (app has ~10 screens, no component crashes worth catching)
- No global error context/provider (overkill — `showError()` is sufficient)
- No error codes enum (messages are user-facing Swedish strings)
- No retry logic abstraction (only `createSession` retries, keep inline)

## File Impact

| File | Change |
|------|--------|
| `src/types/result.ts` | **New** (~5 lines) |
| `src/lib/show-error.ts` | **New** (~5 lines) |
| `src/lib/session-actions.ts` | Remove `Alert` import, return `Result<T>` |
| `src/lib/cellar-actions.ts` | Remove `Alert` import, return `Result<T>` |
| `src/hooks/useTastingSessions.ts` | Handle `result.error` from session-actions |
| `src/hooks/useEditWineModal.ts` | Handle `result.error`, remove sentinel filtering |
| `src/hooks/useDrinkWineModal.ts` | Handle `result.error` |
| `src/hooks/useCatalogEditorModal.ts` | Handle `result.error` |
| `src/hooks/useAddWineTasting.ts` | Handle `result.error` |
| `src/hooks/useCellarData.ts` | Replace `Alert.alert` → `showError` (8 sites) |
| `src/hooks/useCatalogWorkflow.ts` | Replace error Alerts → `showError` |
| `src/hooks/useImagePicker.ts` | Replace Alerts → `showError` |
| `src/screens/auth.tsx` | Replace error Alerts → `showError` |

**Net:** ~10 new lines, ~20 removed. Negative line delta.

## Migration Order

1. Create `src/types/result.ts` and `src/lib/show-error.ts`
2. Migrate `session-actions.ts` → update `useTastingSessions.ts`
3. Migrate `cellar-actions.ts` → update consuming hooks
4. Swap `Alert.alert` → `showError` in remaining hooks + auth.tsx

Each step independently testable. Steps 2-3 are natural commit pairs.
