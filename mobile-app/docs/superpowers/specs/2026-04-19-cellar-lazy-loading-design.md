# Min källare lazy loading — design

**Status:** approved 2026-04-19
**Problem:** initial load of "Min källare" is too slow. Current `useWines` fetches 50 wines with `select("*")`, then one signed-URLs call for all images, before anything renders. Worse: bottle counts per storage space, total stats, and filter options are derived only from the loaded page — so users with >50 wines see wrong counts until they scroll through everything.

## Goals

- First paint under ~300 ms after auth: storage-space cards with correct counts, stats, and filter options.
- No image round-trip until a space is expanded.
- Correctness: counts, stats, and filter dropdowns reflect the entire cellar, not the loaded page.
- Filter and search stay consistent: counts update as filters change.

Non-goals:

- Pagination within a single storage space.
- Persistent cache across sessions.
- Server-side sorting (client already sorts).

## Architecture

Replace `useWines` with two hooks:

### `useCellarAggregate(filters, searchQuery)`

One Supabase RPC (`get_cellar_overview`) returns everything needed to render the cellar list *without* wine rows:

```ts
type CellarAggregate = {
  stats: {
    totalBottles: number;
    totalLabels: number;
    averageVintage: string;
    topCountry: string;
    topType: string;
    topPairing: string;
  };
  bottleCountsBySpaceId: Record<string, number>;
  unplacedCount: number;
  filterOptions: {
    countries: string[];
    regions: string[];
    types: string[];
    vintages: number[];
    grapes: string[];
    pairings: string[];
  };
};
```

The RPC takes `filters jsonb` + `search text` and applies them when computing counts and stats. Filter *options* are always the full distinct set (so the user can switch filters without the dropdown emptying as matches narrow). Re-fetched whenever filters/search change.

### `useCellarSpaceWines(spaceId, filters, searchQuery)`

On-demand wines for one space, with filter + search applied server-side. Internally keeps an in-memory `Map<cacheKey, WineRecord[]>` where `cacheKey = serialize(spaceId, filters, searchQuery)`. Cache behavior:

- Hit → return cached wines synchronously, no network.
- Miss → fetch wines for that space with filters, hydrate signed URLs just for those images, store in cache.
- Invalidation:
  - Filter or search changes → cache cleared (keys are filter-scoped anyway, but we clear to avoid memory growth).
  - Wine in a cached space is edited/deleted/consumed → update that space's entry in place.
  - New wine added → increment aggregate count; if its space is cached, append to cached list.

`__unplaced__` is treated as a pseudo-space (storage_space_id IS NULL).

## UI flow

1. User opens Min källare → aggregate loads. Space cards render with correct counts, stats show correct totals, filter dropdowns populate. No wine rows, no images yet.
2. "Otilldelade" auto-expands by default → triggers `useCellarSpaceWines("__unplaced__")`.
3. User taps a space → fetch + render wines for that space.
4. Filter/search change → aggregate re-fetches (new counts), wine cache clears, currently-expanded spaces re-fetch.
5. When a filter or search is active, spaces with matches auto-expand so the user sees results instead of just counts. Spaces with zero matches stay visible with "0 st" but collapsed.

## Write path

Optimistic local updates only — avoid a full refetch on every mutation:

- **Add wine:** increment `bottleCountsBySpaceId[spaceId]` (or `unplacedCount`); if that space is currently cached, prepend the new wine to its cache entry.
- **Edit wine:** if the space is cached, replace the wine in place. If the storage_space_id changed, decrement old count and increment new.
- **Delete wine:** decrement count; remove from cache if present.
- **Drink wine:** same as delete when `quantity` hits 0, otherwise update quantity in cache.

`stats` (topCountry, averageVintage, etc.) is harder to update optimistically. Accept slight staleness — refresh the aggregate on pull-to-refresh and when the user leaves/returns to the tab.

## Files affected

- `src/hooks/useWines.ts` — removed. Replaced by:
  - `src/hooks/useCellarAggregate.ts` (new)
  - `src/hooks/useCellarSpaceWines.ts` (new)
- `src/contexts/CellarContext.tsx` — exposes `aggregate` (counts, stats, filterOptions) + `getSpaceWines(spaceId)` returning `{ wines, loading }`. Existing consumers migrate.
- `src/components/min-kallare-panel.tsx` — `toggleSpace` calls into space hook. `useCellarSections` builds from aggregate counts + per-space cache entries.
- `src/hooks/useCellarFilters.ts` — passes filter state to aggregate hook so re-fetches happen.
- `src/lib/cellar-helpers.ts` — `buildStats`, `buildStorageSpaceBottleCounts`, `buildValueOptions`, `buildVintageOptions`, `buildPairingOptions` are no longer called client-side on a wine list; either removed or kept only for optimistic stats updates.
- **New Supabase migration:** RPC `get_cellar_overview(filters jsonb, search text)` returning the aggregate shape above. Consistent with existing pattern of using RPC for complex reads (see `db_import_approach` memory).
- **Tests:** new unit tests for cache invalidation in `useCellarSpaceWines`; integration test that counts stay correct across filter changes.

## Edge cases

- **User with zero wines:** aggregate returns empty arrays and zeroed counts; no space fetches happen.
- **Space with zero wines after filter:** card shows "0 st", does not auto-expand.
- **Concurrent mutations:** guarded fetcher pattern from `useWines` carries over to both hooks.
- **Offline:** same behavior as today — Supabase client errors surface via `showError`.
- **Tests hitting the RPC:** integration tests need the RPC deployed to the test project (or a mock via supabase client).

## Rollout

Single PR. No feature flag — the old `useWines` is fully replaced once the new hooks and RPC are in place. The RPC migration ships in the same PR.
