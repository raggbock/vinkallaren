# Data Fetching Optimization — Design Spec

**Date:** 2026-04-02
**Status:** Draft

## Problem

`useCellarData` has 7 different post-mutation patterns with redundant network requests:

| Mutation | Current behavior | Cost |
|---|---|---|
| Save wine | refetch wines + catalog + reference | 3 requests, ~50+N+M rows |
| Save tasting | refetch history | 1 request |
| Drink wine | refetch history | 1 request |
| Edit wine | local setWines + refetch catalog | Inconsistent — skips reference |
| Delete wine | local state | Good |
| Save/delete storage | refetch storage (+ wines on delete) | OK |
| Catalog backfill | refetch catalog ~1-2s after mount | Redundant duplicate |

## Design

### 1. Optimistic updates — use mutation return values

Supabase `.insert()` / `.update()` already return the saved row via `.select()`. Use it instead of blind refetch.

**saveWine:**
```ts
// Before:
const { error } = await supabase.from('wines').insert(payload);
if (!error) { fetchWines(); fetchCatalogEntries(); fetchReferenceOptions(); }

// After:
const { data, error } = await supabase.from('wines').insert(payload).select().single();
if (!error && data) {
  const hydrated = await hydrateWineRecords([data]);
  setWines(prev => [...hydrated, ...prev]);
}
```

**saveTasting / drinkWine:** Return the row, prepend to `historyEntries` locally.

**editWine:** Already uses local `setWines` — just add `mergeReferenceOptions` for consistency.

### 2. mergeReferenceOptions — incremental update

Instead of refetching all reference options, extract relevant fields from the saved wine:

```ts
function mergeReferenceOptions(wine: WineRow) {
  setReferenceOptions(prev => {
    const additions: ReferenceOptionRow[] = [];
    for (const [category, value] of [
      ["grape", wine.grape], ["country", wine.country], ["region", wine.region],
    ] as const) {
      if (value && !prev.some(o => o.category === category && o.name === value)) {
        additions.push({ category, name: value, sort_order: 999, id: `local-${category}-${value}` });
      }
    }
    return additions.length > 0 ? [...prev, ...additions] : prev;
  });
}
```

~15 lines. Eliminates `fetchReferenceOptions()` after mutations entirely.

### 3. Skip redundant catalog backfill refetch

Track whether backfill actually inserted new entries:

```ts
// In backfill effect:
let insertedCount = 0;
for (const wine of completeWines) {
  const inserted = await cacheWineRecordAsCatalogEntry(wine, userId);
  if (inserted) insertedCount++;
}
if (insertedCount > 0) await fetchCatalogEntries();
// else: skip the refetch entirely
```

### 4. Fetch dedup guard

Simple guard against concurrent identical fetches (~10 lines):

```ts
function createGuardedFetcher<T>(fn: () => Promise<T>): () => Promise<T | undefined> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}
```

Wrap `fetchWines`, `fetchCatalogEntries`, `fetchHistoryEntries`.

### 5. Pull-to-refresh — make comprehensive

Current: wines + storage + history. Missing: catalog + reference options.

```ts
async function onPullToRefresh() {
  setRefreshing(true);
  await Promise.all([
    fetchWines(), fetchStorageSpaces(), fetchHistoryEntries(),
    fetchCatalogEntries(), fetchReferenceOptions(),
  ]);
  setRefreshing(false);
}
```

### 6. Image URL TTL — noted, not fixed here

Signed URLs (60 min TTL) with no refresh mechanism. Users with app open >60 min see broken images. Future fix: lazy-regenerate on Image `onError`. Out of scope for this spec.

## Consistent Post-Mutation Strategy

| Mutation | Local update | Network |
|---|---|---|
| Save wine | prepend to wines, mergeReferenceOptions | None |
| Edit wine | update in wines, mergeReferenceOptions | None |
| Delete wine | filter wines | None |
| Save tasting | prepend to historyEntries | None |
| Drink wine | prepend to historyEntries, update/filter wines | None |
| Save storage | refetch storage | 1 request |
| Delete storage | refetch storage + wines | 2 requests |
| Catalog backfill | merge new entries locally | Only if new entries |
| Pull-to-refresh | — | All 5 fetchers in parallel |

## Implementation Order

1. `createGuardedFetcher` + wrap 3 fetchers (~10 lines)
2. `mergeReferenceOptions` helper (~15 lines)
3. `saveWine` — use returned row, remove refetch calls
4. `saveTasting` / `drinkWine` — use returned row, remove fetchHistory
5. `editWine` — add mergeReferenceOptions
6. Pull-to-refresh — add catalog + reference options
7. Catalog backfill — skip refetch if 0 new entries

Each step independent and testable. Net: ~+40 lines helpers, -30 lines refetch calls.

## Files Affected

- `src/hooks/useCellarData.ts` — main changes
- `App.tsx` — update saveWine callback
- `src/lib/cellar-actions.ts` — return saved rows from mutations
- `src/lib/wine-helpers.ts` — `cacheWineRecordAsCatalogEntry` return boolean
