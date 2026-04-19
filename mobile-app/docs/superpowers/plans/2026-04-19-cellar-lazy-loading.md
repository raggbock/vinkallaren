# Min källare Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut initial paint time of the "Min källare" tab from seconds (scan of 50 wines + image signed-URL batch) to sub-second (one aggregate RPC), and fix the correctness bug where counts, stats, and filter options are derived from only the first 50 loaded wines.

**Architecture:** Two new hooks replace how Min källare reads data. `useCellarAggregate` calls a new Supabase RPC `get_cellar_overview` that returns counts, stats, and full-cellar filter options in a single round-trip without fetching wine rows. `useCellarSpaceWines(spaceId)` lazy-fetches wines for one storage space on expand, with filter+search applied server-side, and caches results in-memory keyed by `(spaceId, filters, search)`. Filters/search now drive server queries instead of client-side filtering. Legacy `useWines` is kept (for Tasting tab, Edit modal, Storage selection occupancy, and Catalog backfill) but no longer blocks Min källare's render path.

**Tech Stack:** React Native / Expo, TypeScript, Supabase (Postgres RPC with RLS), Jest + @testing-library/react-native

**Spec:** `mobile-app/docs/superpowers/specs/2026-04-19-cellar-lazy-loading-design.md`

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `supabase/migrations/20260419100000_get_cellar_overview.sql` | RPC `get_cellar_overview(p_filters jsonb, p_search text)` returning stats, per-space counts, and distinct filter options for the caller's cellar |
| `src/hooks/useCellarAggregate.ts` | Calls the RPC; exposes `aggregate` + `refresh()` + `loading`; re-fetches when filters/search change |
| `src/hooks/useCellarSpaceWines.ts` | Per-space lazy loader with in-memory `Map` cache; `getSpaceWines(spaceId)` returns `{ wines, loading, loaded }`; invalidated on filter/search change and on write-path mutations |
| `src/types/cellar-aggregate.ts` | TypeScript types for the aggregate payload and filter state |
| `src/hooks/__tests__/useCellarAggregate.test.tsx` | Unit tests for the aggregate hook |
| `src/hooks/__tests__/useCellarSpaceWines.test.tsx` | Unit tests for cache + invalidation behavior |

### Modified files

| File | Change |
|---|---|
| `src/contexts/CellarContext.tsx` | Expose `aggregate`, `getSpaceWines`, `invalidateSpaceWines`, plus existing `wines` (unchanged for legacy consumers); keep `useWines` but stop using its outputs for Min källare derived data |
| `src/hooks/useCellarFilters.ts` | Remove client-side `filteredWines` computation; only holds filter state + setters. Export `filtersToRpcShape()` helper |
| `src/components/min-kallare-panel.tsx` | Drop `filteredWines` prop. Sections built from `aggregate.bottleCountsBySpaceId` + per-space cache. Toggle triggers `getSpaceWines` |
| `src/components/cellar-list-header.tsx` | Filter dropdowns source options from `aggregate.filterOptions` instead of `ctx.*Options` |
| `src/components/cellar-tab.tsx` | Remove `filteredWines` threading; pass aggregate + space-wines accessor into panel |
| `src/types/panel-prop-groups.ts` | Filter props get new shape; no `filteredWines` in panel props |
| `src/lib/cellar-actions.ts` | On save/edit/delete/drink: call `invalidateSpaceWines(spaceId)` and `aggregate.refresh()` (debounced) |
| `src/hooks/useWines.ts` | Remove now-unused derived data (`stats`, `storageSpaceBottleCounts`, `pairingOptions`, `countryOptions`, etc.). These move to aggregate. Keep wine list + pagination for legacy consumers |
| `src/hooks/__tests__/useWinesAndHistory.test.tsx` | Drop assertions for removed derived data |
| `src/lib/__tests__/cellar-helpers.test.ts` | Drop tests for `buildStats` / `buildStorageSpaceBottleCounts` / `buildValueOptions` / `buildVintageOptions` / `buildPairingOptions` (functions removed) |
| `src/lib/cellar-helpers.ts` | Remove the now-unused aggregate builder functions |

### Deleted files

None.

---

## Task 1: Database Migration — `get_cellar_overview` RPC

**Files:**
- Create: `mobile-app/supabase/migrations/20260419100000_get_cellar_overview.sql`

- [ ] **Step 1: Write the migration**

```sql
-- RPC returning cellar overview for the authenticated user:
-- per-space bottle counts, headline stats, and distinct filter options.
-- Counts + stats respect p_filters and p_search; filter option lists
-- always reflect the caller's full cellar so dropdowns don't empty.

CREATE OR REPLACE FUNCTION get_cellar_overview(
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_search  text  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_search  text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_like    text := CASE WHEN v_search IS NULL THEN NULL ELSE '%' || v_search || '%' END;
  result    jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH all_mine AS (
    SELECT * FROM wines WHERE user_id = v_user_id AND quantity > 0
  ),
  filtered AS (
    SELECT * FROM all_mine
    WHERE (NOT p_filters ? 'country'  OR country  = p_filters->>'country')
      AND (NOT p_filters ? 'region'   OR region   = p_filters->>'region')
      AND (NOT p_filters ? 'type'     OR type     = p_filters->>'type')
      AND (NOT p_filters ? 'grape'    OR grape    = p_filters->>'grape')
      AND (NOT p_filters ? 'vintage'  OR vintage::text = p_filters->>'vintage')
      AND (NOT p_filters ? 'pairing'  OR p_filters->>'pairing' = ANY(food_pairings))
      AND (NOT p_filters ? 'storage_space_id'
           OR storage_space_id::text = p_filters->>'storage_space_id')
      AND (v_like IS NULL OR (
        name ILIKE v_like
        OR COALESCE(producer, '') ILIKE v_like
        OR COALESCE(country, '')  ILIKE v_like
        OR COALESCE(region, '')   ILIKE v_like
        OR COALESCE(grape, '')    ILIKE v_like
        OR COALESCE(type, '')     ILIKE v_like
        OR COALESCE(cellar_location, '') ILIKE v_like
      ))
  ),
  counts_by_space AS (
    SELECT storage_space_id, SUM(quantity)::int AS cnt
    FROM filtered
    WHERE storage_space_id IS NOT NULL
    GROUP BY storage_space_id
  ),
  unplaced AS (
    SELECT COALESCE(SUM(quantity), 0)::int AS cnt
    FROM filtered WHERE storage_space_id IS NULL
  ),
  top_country AS (
    SELECT country, SUM(quantity)::int AS cnt
    FROM filtered WHERE country IS NOT NULL
    GROUP BY country ORDER BY cnt DESC LIMIT 1
  ),
  top_type AS (
    SELECT type, SUM(quantity)::int AS cnt
    FROM filtered
    GROUP BY type ORDER BY cnt DESC LIMIT 1
  ),
  top_pairing AS (
    SELECT p, SUM(quantity)::int AS cnt FROM (
      SELECT unnest(food_pairings) AS p, quantity FROM filtered
    ) s
    WHERE p IS NOT NULL AND p <> ''
    GROUP BY p ORDER BY cnt DESC LIMIT 1
  )
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'totalBottles',  COALESCE((SELECT SUM(quantity) FROM filtered), 0),
      'totalLabels',   (SELECT COUNT(*) FROM filtered),
      'averageVintage', COALESCE(
        (SELECT ROUND(AVG(vintage))::text FROM filtered WHERE vintage IS NOT NULL),
        '-'
      ),
      'topCountry', COALESCE(
        (SELECT country || ' (' || cnt || ')' FROM top_country), 'Ingen data'),
      'topType', COALESCE(
        (SELECT type || ' (' || cnt || ')' FROM top_type), 'Ingen data'),
      'topPairing', COALESCE(
        (SELECT p || ' (' || cnt || ')' FROM top_pairing), 'Ingen data')
    ),
    'bottleCountsBySpaceId', COALESCE(
      (SELECT jsonb_object_agg(storage_space_id::text, cnt) FROM counts_by_space),
      '{}'::jsonb
    ),
    'unplacedCount', (SELECT cnt FROM unplaced),
    'filterOptions', jsonb_build_object(
      'countries', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT country AS v FROM all_mine WHERE country IS NOT NULL) s),
        '[]'::jsonb),
      'regions', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT region AS v FROM all_mine WHERE region IS NOT NULL) s),
        '[]'::jsonb),
      'types', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT type AS v FROM all_mine WHERE type IS NOT NULL) s),
        '[]'::jsonb),
      'vintages', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v DESC) FROM (SELECT DISTINCT vintage AS v FROM all_mine WHERE vintage IS NOT NULL) s),
        '[]'::jsonb),
      'grapes', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT grape AS v FROM all_mine WHERE grape IS NOT NULL) s),
        '[]'::jsonb),
      'pairings', COALESCE(
        (SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT unnest(food_pairings) AS v FROM all_mine) s WHERE v IS NOT NULL AND v <> ''),
        '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_cellar_overview(jsonb, text) TO authenticated;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Per the `db_import_approach` memory: use the plugin supabase MCP to apply. Run (via MCP):

```
mcp__plugin_supabase_supabase__apply_migration
  name: get_cellar_overview
  query: <contents of 20260419100000_get_cellar_overview.sql>
```

Expected: success. If it fails with "function exists", check if this is a re-run — the `CREATE OR REPLACE` should handle that; only drop if parameter signature changed.

- [ ] **Step 3: Manual smoke test against live schema**

Run (via MCP `execute_sql`):

```sql
SELECT get_cellar_overview('{}'::jsonb, NULL);
```

Expected: JSON object with keys `stats`, `bottleCountsBySpaceId`, `unplacedCount`, `filterOptions`. Values reflect the test user's cellar.

Also run a filtered call:

```sql
SELECT get_cellar_overview('{"type":"Rött"}'::jsonb, NULL);
```

Expected: `stats.totalBottles` equals sum of red-wine quantities; `filterOptions.countries` still contains all countries (not narrowed).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/supabase/migrations/20260419100000_get_cellar_overview.sql
git commit -m "feat(db): get_cellar_overview RPC for cellar aggregate"
```

---

## Task 2: Aggregate Types

**Files:**
- Create: `mobile-app/src/types/cellar-aggregate.ts`

- [ ] **Step 1: Write the types file**

```ts
export type CellarStats = {
  totalBottles: number;
  totalLabels: number;
  averageVintage: string;
  topCountry: string;
  topType: string;
  topPairing: string;
};

export type CellarFilterOptions = {
  countries: string[];
  regions: string[];
  types: string[];
  vintages: number[];
  grapes: string[];
  pairings: string[];
};

export type CellarAggregate = {
  stats: CellarStats;
  bottleCountsBySpaceId: Record<string, number>;
  unplacedCount: number;
  filterOptions: CellarFilterOptions;
};

// Filter state as sent to the RPC. Keys are omitted when "Alla".
export type CellarFilterState = {
  country?: string;
  region?: string;
  type?: string;
  grape?: string;
  vintage?: string;
  pairing?: string;
  storage_space_id?: string;
};

export const EMPTY_AGGREGATE: CellarAggregate = {
  stats: {
    totalBottles: 0,
    totalLabels: 0,
    averageVintage: "-",
    topCountry: "Ingen data",
    topType: "Ingen data",
    topPairing: "Ingen data",
  },
  bottleCountsBySpaceId: {},
  unplacedCount: 0,
  filterOptions: {
    countries: [], regions: [], types: [], vintages: [], grapes: [], pairings: [],
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add mobile-app/src/types/cellar-aggregate.ts
git commit -m "feat(types): CellarAggregate + filter state types"
```

---

## Task 3: `useCellarAggregate` hook

**Files:**
- Create: `mobile-app/src/hooks/useCellarAggregate.ts`
- Test: `mobile-app/src/hooks/__tests__/useCellarAggregate.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/hooks/__tests__/useCellarAggregate.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useCellarAggregate } from "../useCellarAggregate";
import { EMPTY_AGGREGATE } from "../../types/cellar-aggregate";

const mockRpc = jest.fn();
jest.mock("../../lib/supabase", () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));
jest.mock("../../lib/show-error", () => ({ showError: jest.fn() }));

const samplePayload = {
  stats: { totalBottles: 7, totalLabels: 5, averageVintage: "2018",
           topCountry: "Italien (4)", topType: "Rött (5)", topPairing: "lamm (2)" },
  bottleCountsBySpaceId: { "sp-1": 4, "sp-2": 3 },
  unplacedCount: 0,
  filterOptions: {
    countries: ["Italien", "Frankrike"], regions: ["Piemonte"], types: ["Rött"],
    vintages: [2018, 2015], grapes: ["Nebbiolo"], pairings: ["lamm"],
  },
};

describe("useCellarAggregate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("starts with EMPTY_AGGREGATE and loading=true", () => {
    mockRpc.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    expect(result.current.aggregate).toEqual(EMPTY_AGGREGATE);
    expect(result.current.loading).toBe(true);
  });

  test("calls RPC with filters and search on mount", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    renderHook(() => useCellarAggregate({ type: "Rött" }, "barolo"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith("get_cellar_overview", {
      p_filters: { type: "Rött" },
      p_search: "barolo",
    });
  });

  test("sets aggregate from RPC response", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.aggregate.stats.totalBottles).toBe(7);
    expect(result.current.aggregate.bottleCountsBySpaceId["sp-1"]).toBe(4);
  });

  test("refetches when filters change", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result, rerender } = renderHook(
      ({ f, s }: { f: Record<string, string>; s: string }) => useCellarAggregate(f, s),
      { initialProps: { f: {}, s: "" } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    rerender({ f: { type: "Rött" }, s: "" });
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  });

  test("passes null p_search when search is empty/whitespace", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    renderHook(() => useCellarAggregate({}, "   "));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenLastCalledWith("get_cellar_overview", {
      p_filters: {}, p_search: null,
    });
  });

  test("refresh() triggers re-fetch", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refresh(); });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile-app && npx jest src/hooks/__tests__/useCellarAggregate.test.tsx
```

Expected: all tests fail with "Cannot find module '../useCellarAggregate'".

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useCellarAggregate.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { EMPTY_AGGREGATE, type CellarAggregate, type CellarFilterState } from "../types/cellar-aggregate";

export function useCellarAggregate(filters: CellarFilterState, search: string) {
  const [aggregate, setAggregate] = useState<CellarAggregate>(EMPTY_AGGREGATE);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const searchArg = useMemo(() => {
    const trimmed = search.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [search]);

  const fetchAggregate = useCallback(async () => {
    const token = ++inFlight.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_cellar_overview", {
      p_filters: JSON.parse(filtersKey),
      p_search: searchArg,
    });
    if (token !== inFlight.current) return; // stale response
    if (error) {
      showError("Kunde inte hämta källaren", error.message);
      setLoading(false);
      return;
    }
    setAggregate((data as CellarAggregate | null) ?? EMPTY_AGGREGATE);
    setLoading(false);
  }, [filtersKey, searchArg]);

  useEffect(() => { void fetchAggregate(); }, [fetchAggregate]);

  return { aggregate, loading, refresh: fetchAggregate };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile-app && npx jest src/hooks/__tests__/useCellarAggregate.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/hooks/useCellarAggregate.ts mobile-app/src/hooks/__tests__/useCellarAggregate.test.tsx
git commit -m "feat(hooks): useCellarAggregate — RPC-backed cellar overview"
```

---

## Task 4: `useCellarSpaceWines` hook (per-space lazy loader + cache)

**Files:**
- Create: `mobile-app/src/hooks/useCellarSpaceWines.ts`
- Test: `mobile-app/src/hooks/__tests__/useCellarSpaceWines.test.tsx`

Design: a single hook instance owns the cache `Map<cacheKey, WineRecord[]>`. `cacheKey = spaceId + ":" + filtersKey + ":" + searchKey`. The hook returns both `getSpaceWines(spaceId)` (imperative — triggers fetch on first call, returns cached entry) and `invalidateSpace(spaceId)` / `invalidateAll()`. Consumers subscribe per-space via React state updates.

- [ ] **Step 1: Write failing tests**

```tsx
// src/hooks/__tests__/useCellarSpaceWines.test.tsx
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useCellarSpaceWines } from "../useCellarSpaceWines";

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockGt = jest.fn();
const mockOrder = jest.fn();
const mockOr = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    storage: { from: () => ({ createSignedUrls: jest.fn().mockResolvedValue({ data: [] }) }) },
  },
}));
jest.mock("../../lib/wine-helpers", () => ({
  hydrateWineRecords: (rows: any[]) => Promise.resolve(rows),
}));
jest.mock("../../lib/show-error", () => ({ showError: jest.fn() }));

function setupQueryChain(rows: any[]) {
  const terminal = Promise.resolve({ data: rows, error: null });
  mockOrder.mockReturnValue(terminal);
  mockOr.mockReturnValue({ order: mockOrder });
  mockIs.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
  mockEq.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
  mockGt.mockReturnValue({ order: mockOrder, or: mockOr });
  mockSelect.mockReturnValue({ eq: mockEq, is: mockIs, gt: mockGt, order: mockOrder });
  mockFrom.mockReturnValue({ select: mockSelect });
}

const wineRow = (id: string, spaceId: string | null = "sp-1") => ({
  id, user_id: "u1", name: "Barolo", storage_space_id: spaceId,
  quantity: 1, type: "Rött", food_pairings: [], tags: [],
  producer: null, country: null, region: null, grape: null, vintage: null,
  storage_row: null, storage_slot: null, barcode: null,
  systembolaget_product_id: null, pairing_source: null, notes: null,
  cellar_location: null, image_path: null, acquired_at: null, drink_by_year: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
});

describe("useCellarSpaceWines", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("returns loaded=false with empty wines for a never-requested space", () => {
    setupQueryChain([]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    const s = result.current.getSpaceWines("sp-1");
    expect(s.loaded).toBe(false);
    expect(s.wines).toEqual([]);
  });

  test("requestSpace triggers fetch; getSpaceWines returns results after load", async () => {
    setupQueryChain([wineRow("w1"), wineRow("w2")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    expect(result.current.getSpaceWines("sp-1").wines).toHaveLength(2);
  });

  test("second requestSpace on same cacheKey does NOT refetch", async () => {
    setupQueryChain([wineRow("w1")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    const callsAfterFirst = mockFrom.mock.calls.length;
    act(() => { result.current.requestSpace("sp-1"); });
    expect(mockFrom.mock.calls.length).toBe(callsAfterFirst);
  });

  test("filter change clears cache; next requestSpace refetches", async () => {
    setupQueryChain([wineRow("w1")]);
    const { result, rerender } = renderHook(
      ({ f }: { f: Record<string, string> }) => useCellarSpaceWines(f, ""),
      { initialProps: { f: {} } }
    );
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    rerender({ f: { type: "Rött" } });
    const before = mockFrom.mock.calls.length;
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(mockFrom.mock.calls.length).toBeGreaterThan(before));
  });

  test("invalidateSpace clears only that space", async () => {
    setupQueryChain([wineRow("w1", "sp-1")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    setupQueryChain([wineRow("w2", "sp-2")]);
    act(() => { result.current.requestSpace("sp-2"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-2").loaded).toBe(true));
    act(() => { result.current.invalidateSpace("sp-1"); });
    expect(result.current.getSpaceWines("sp-1").loaded).toBe(false);
    expect(result.current.getSpaceWines("sp-2").loaded).toBe(true);
  });

  test("__unplaced__ triggers an `.is('storage_space_id', null)` query", async () => {
    setupQueryChain([wineRow("w1", null)]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("__unplaced__"); });
    await waitFor(() => expect(result.current.getSpaceWines("__unplaced__").loaded).toBe(true));
    expect(mockIs).toHaveBeenCalledWith("storage_space_id", null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile-app && npx jest src/hooks/__tests__/useCellarSpaceWines.test.tsx
```

Expected: all fail with "Cannot find module".

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useCellarSpaceWines.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { hydrateWineRecords } from "../lib/wine-helpers";
import type { CellarFilterState } from "../types/cellar-aggregate";
import type { WineRecord, WineRow } from "../types/wine";

export const UNPLACED_SPACE_ID = "__unplaced__";

type SpaceState = { wines: WineRecord[]; loading: boolean; loaded: boolean };

const EMPTY_STATE: SpaceState = { wines: [], loading: false, loaded: false };

function buildCacheKey(filters: CellarFilterState, search: string) {
  return JSON.stringify(filters) + "|" + search.trim().toLowerCase();
}

export function useCellarSpaceWines(filters: CellarFilterState, search: string) {
  const cacheKey = useMemo(() => buildCacheKey(filters, search), [filters, search]);
  const [states, setStates] = useState<Record<string, SpaceState>>({});
  const activeCacheKey = useRef(cacheKey);

  // Filter/search changed → drop previous cache entirely.
  useEffect(() => {
    if (activeCacheKey.current !== cacheKey) {
      activeCacheKey.current = cacheKey;
      setStates({});
    }
  }, [cacheKey]);

  const fetchSpace = useCallback(async (spaceId: string, keyAtStart: string) => {
    let query = supabase.from("wines").select("*").gt("quantity", 0);
    if (spaceId === UNPLACED_SPACE_ID) {
      query = query.is("storage_space_id", null);
    } else {
      query = query.eq("storage_space_id", spaceId);
    }

    const f = filters;
    if (f.country)  query = query.eq("country", f.country);
    if (f.region)   query = query.eq("region", f.region);
    if (f.type)     query = query.eq("type", f.type);
    if (f.grape)    query = query.eq("grape", f.grape);
    if (f.vintage)  query = query.eq("vintage", Number(f.vintage));
    if (f.pairing)  query = query.contains("food_pairings", [f.pairing]);

    const searchTrim = search.trim();
    if (searchTrim.length > 0) {
      const like = `%${searchTrim}%`;
      query = query.or(
        `name.ilike.${like},producer.ilike.${like},country.ilike.${like},` +
        `region.ilike.${like},grape.ilike.${like},type.ilike.${like},` +
        `cellar_location.ilike.${like}`
      );
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (keyAtStart !== activeCacheKey.current) return; // stale
    if (error) {
      showError("Kunde inte hämta viner", error.message);
      setStates((s) => ({ ...s, [spaceId]: { ...EMPTY_STATE, loaded: true } }));
      return;
    }
    const hydrated = await hydrateWineRecords((data ?? []) as WineRow[]);
    if (keyAtStart !== activeCacheKey.current) return;
    setStates((s) => ({ ...s, [spaceId]: { wines: hydrated, loading: false, loaded: true } }));
  }, [filters, search]);

  const requestSpace = useCallback((spaceId: string) => {
    setStates((s) => {
      if (s[spaceId]?.loaded || s[spaceId]?.loading) return s;
      void fetchSpace(spaceId, activeCacheKey.current);
      return { ...s, [spaceId]: { wines: [], loading: true, loaded: false } };
    });
  }, [fetchSpace]);

  const invalidateSpace = useCallback((spaceId: string) => {
    setStates((s) => {
      const next = { ...s };
      delete next[spaceId];
      return next;
    });
  }, []);

  const invalidateAll = useCallback(() => { setStates({}); }, []);

  const getSpaceWines = useCallback((spaceId: string): SpaceState => {
    return states[spaceId] ?? EMPTY_STATE;
  }, [states]);

  return { getSpaceWines, requestSpace, invalidateSpace, invalidateAll };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile-app && npx jest src/hooks/__tests__/useCellarSpaceWines.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/hooks/useCellarSpaceWines.ts mobile-app/src/hooks/__tests__/useCellarSpaceWines.test.tsx
git commit -m "feat(hooks): useCellarSpaceWines — lazy per-space loader with cache"
```

---

## Task 5: Rework `useCellarFilters` — filter state only, no client-side filtering

**Files:**
- Modify: `mobile-app/src/hooks/useCellarFilters.ts`
- Modify: `mobile-app/src/hooks/__tests__/useCellarFilters.test.tsx`

- [ ] **Step 1: Rewrite the hook**

```ts
// src/hooks/useCellarFilters.ts
import { useCallback, useMemo, useState } from "react";
import type { CellarFilterState } from "../types/cellar-aggregate";

export function useCellarFilters() {
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [selectedGrapeFilter, setSelectedGrapeFilter] = useState("Alla");
  const [selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filterState: CellarFilterState = useMemo(() => {
    const f: CellarFilterState = {};
    if (selectedCountryFilter !== "Alla") f.country = selectedCountryFilter;
    if (selectedRegionFilter !== "Alla")  f.region  = selectedRegionFilter;
    if (selectedTypeFilter !== "Alla")    f.type    = selectedTypeFilter;
    if (selectedGrapeFilter !== "Alla")   f.grape   = selectedGrapeFilter;
    if (selectedVintageFilter !== "Alla") f.vintage = selectedVintageFilter;
    if (selectedPairingFilter !== "Alla") f.pairing = selectedPairingFilter;
    if (selectedStorageSpaceFilterId)     f.storage_space_id = selectedStorageSpaceFilterId;
    return f;
  }, [
    selectedCountryFilter, selectedRegionFilter, selectedTypeFilter,
    selectedGrapeFilter, selectedVintageFilter, selectedPairingFilter,
    selectedStorageSpaceFilterId,
  ]);

  const resetFilters = useCallback(() => {
    setSelectedPairingFilter("Alla");
    setSelectedCountryFilter("Alla");
    setSelectedRegionFilter("Alla");
    setSelectedTypeFilter("Alla");
    setSelectedVintageFilter("Alla");
    setSelectedGrapeFilter("Alla");
    setSelectedStorageSpaceFilterId("");
    setSearchQuery("");
  }, []);

  return {
    searchQuery, setSearchQuery,
    selectedPairingFilter, setSelectedPairingFilter,
    selectedCountryFilter, setSelectedCountryFilter,
    selectedRegionFilter, setSelectedRegionFilter,
    selectedTypeFilter, setSelectedTypeFilter,
    selectedVintageFilter, setSelectedVintageFilter,
    selectedGrapeFilter, setSelectedGrapeFilter,
    selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId,
    filterState, resetFilters,
  };
}
```

- [ ] **Step 2: Update test file**

Open `src/hooks/__tests__/useCellarFilters.test.tsx`. The existing tests call `useCellarFilters(wines, storageSpaceById)` and assert on `filteredWines`. Rewrite them to assert on `filterState` instead. Full replacement:

```tsx
// src/hooks/__tests__/useCellarFilters.test.tsx
import { renderHook, act } from "@testing-library/react-native";
import { useCellarFilters } from "../useCellarFilters";

describe("useCellarFilters", () => {
  test("filterState is empty object when all set to Alla", () => {
    const { result } = renderHook(() => useCellarFilters());
    expect(result.current.filterState).toEqual({});
  });

  test("selecting a country adds it to filterState", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSelectedCountryFilter("Italien"); });
    expect(result.current.filterState).toEqual({ country: "Italien" });
  });

  test("selecting a storage space id adds storage_space_id key", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSelectedStorageSpaceFilterId("sp-1"); });
    expect(result.current.filterState).toEqual({ storage_space_id: "sp-1" });
  });

  test("resetFilters clears all state", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => {
      result.current.setSelectedCountryFilter("Italien");
      result.current.setSearchQuery("barolo");
    });
    act(() => { result.current.resetFilters(); });
    expect(result.current.filterState).toEqual({});
    expect(result.current.searchQuery).toBe("");
  });

  test("searchQuery is independent of filterState", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSearchQuery("hello"); });
    expect(result.current.searchQuery).toBe("hello");
    expect(result.current.filterState).toEqual({});
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd mobile-app && npx jest src/hooks/__tests__/useCellarFilters.test.tsx
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/hooks/useCellarFilters.ts mobile-app/src/hooks/__tests__/useCellarFilters.test.tsx
git commit -m "refactor(filters): useCellarFilters holds state only, no client-side filtering"
```

---

## Task 6: Wire aggregate + space wines into `CellarContext`

**Files:**
- Modify: `mobile-app/src/contexts/CellarContext.tsx`

- [ ] **Step 1: Extend the context**

Add filters/search to the provider, use them to drive aggregate + space-wines hooks. The filter/search state lives in the provider (moved up from CellarTab) so both the panel and list-header see the same values. Legacy `wines` continues to exist from `useWines` for other consumers.

Edit the imports and signature of `CellarProvider`:

```tsx
// Top of file — add imports:
import { useCellarAggregate } from "../hooks/useCellarAggregate";
import { useCellarSpaceWines } from "../hooks/useCellarSpaceWines";
import { useCellarFilters } from "../hooks/useCellarFilters";
import { EMPTY_AGGREGATE, type CellarAggregate, type CellarFilterState } from "../types/cellar-aggregate";
```

Extend `CellarContextValue`:

```ts
export type CellarContextValue = {
  userId: string;
  // NEW: cellar view state
  aggregate: CellarAggregate;
  aggregateLoading: boolean;
  refreshAggregate: () => Promise<void>;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
  requestSpace: (spaceId: string) => void;
  invalidateSpace: (spaceId: string) => void;
  invalidateAllSpaceWines: () => void;
  filters: ReturnType<typeof useCellarFilters>;
  // ... existing fields unchanged (wines, setWines, refreshWines, fetchMoreWines,
  //     hasMoreWines, deleteWine, stats, storageSpaceBottleCounts, *Options, etc.)
};
```

Inside `CellarProvider`, wire the new hooks:

```tsx
const filters = useCellarFilters();
const { aggregate, loading: aggregateLoading, refresh: refreshAggregate }
  = useCellarAggregate(filters.filterState, filters.searchQuery);
const spaceWines = useCellarSpaceWines(filters.filterState, filters.searchQuery);
```

Add to the `value` object:

```ts
aggregate, aggregateLoading, refreshAggregate,
getSpaceWines: spaceWines.getSpaceWines,
requestSpace: spaceWines.requestSpace,
invalidateSpace: spaceWines.invalidateSpace,
invalidateAllSpaceWines: spaceWines.invalidateAll,
filters,
```

Extend the `useMemo` deps accordingly. For now, **keep the existing legacy fields** (`stats`, `storageSpaceBottleCounts`, `*Options`, `wines`, `winesLoading`, `setWines`, `refreshWines`, `fetchMoreWines`, `hasMoreWines`, `deleteWine`). They will be removed in Task 10 once their consumers have migrated.

- [ ] **Step 2: TypeScript compile check**

```bash
cd mobile-app && npx tsc --noEmit
```

Expected: 0 errors. If errors appear in `cellar-tab.tsx` because `useCellarFilters(wines, storageSpaceById)` now takes no args, leave them for Task 7 — this task commits in a state where the app may not run yet.

*If tsc passes despite the Task-7-pending consumers, good. If it fails, you may need to temporarily widen the `CellarContextValue` shape to keep the build green until the consumers migrate. Acceptable workaround: keep the old `filteredWines` path alive via `ctx.wines` in cellar-tab.tsx until Task 7.*

- [ ] **Step 3: Run existing unit tests**

```bash
cd mobile-app && npx jest
```

Expected: all pass (no new breakage in context-level tests).

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/contexts/CellarContext.tsx
git commit -m "feat(cellar-ctx): expose aggregate, space-wines loader, filters"
```

---

## Task 7: Migrate Min källare UI to aggregate + space-wines

**Files:**
- Modify: `mobile-app/src/types/panel-prop-groups.ts`
- Modify: `mobile-app/src/components/cellar-tab.tsx`
- Modify: `mobile-app/src/components/min-kallare-panel.tsx`
- Modify: `mobile-app/src/components/cellar-list-header.tsx`

The goal: Min källare stops depending on `ctx.wines` for its own rendering. It drives sections from `aggregate.bottleCountsBySpaceId` + space-wines cache, and filter dropdowns from `aggregate.filterOptions`.

- [ ] **Step 1: Update `panel-prop-groups.ts`**

Find the `FilterProps` and `WineActionsProps` types. Update `FilterProps` to source options from `string[]` / `number[]` as before — no structural change needed; the source switches in Task 7 step 3 below. Remove any reference to `filteredWines` in a panel props type if present. (There isn't a `PanelProps` wrapper in that file currently — leave as-is, changes happen in the consumers.)

Confirm no change required by grep:

```bash
grep -n "filteredWines" mobile-app/src/types/panel-prop-groups.ts
```

Expected: no output.

- [ ] **Step 2: Update `cellar-tab.tsx`**

Replace the body so it uses context filters + aggregate filter options, removes `filteredWines`:

```tsx
// src/components/cellar-tab.tsx
import { useCallback, useMemo } from "react";
import { openSystembolaget } from "../lib/cellar-actions";
import { confirmAction, showError } from "../lib/show-error";
import { useCellar } from "../contexts/CellarContext";
import { MinKallarePanel } from "./min-kallare-panel";
import { styles } from "../styles/theme";
import type { StorageProps } from "../types/panel-prop-groups";
import type { WineRecord } from "../types/wine";

type Props = {
  hidden: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onNavigateToAdd: () => void;
  onOpenProfile: () => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  storage: StorageProps;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  onHighlightWine?: (wineId: string) => void;
};

const ALLA = "Alla";
const withAlla = (values: (string | number)[]) => [ALLA, ...values.map(String)];

export function CellarTab(props: Props) {
  const ctx = useCellar();
  const { aggregate, aggregateLoading, filters } = ctx;

  const handleOpenSystembolaget = useCallback(async (productId: string) => {
    const result = await openSystembolaget(productId);
    if (result.error) showError("Kunde inte öppna länken", result.error);
  }, []);

  const filterProps = useMemo(() => ({
    searchQuery: filters.searchQuery,
    selectedPairingFilter: filters.selectedPairingFilter,
    selectedCountryFilter: filters.selectedCountryFilter,
    selectedRegionFilter: filters.selectedRegionFilter,
    selectedTypeFilter: filters.selectedTypeFilter,
    selectedVintageFilter: filters.selectedVintageFilter,
    selectedGrapeFilter: filters.selectedGrapeFilter,
    selectedStorageSpaceFilterId: filters.selectedStorageSpaceFilterId,
    pairingOptions: withAlla(aggregate.filterOptions.pairings),
    countryOptions: withAlla(aggregate.filterOptions.countries),
    regionOptions:  withAlla(aggregate.filterOptions.regions),
    typeOptions:    withAlla(aggregate.filterOptions.types),
    vintageOptions: withAlla(aggregate.filterOptions.vintages),
    grapeOptions:   withAlla(aggregate.filterOptions.grapes),
    onSearchChange: filters.setSearchQuery,
    onPairingChange: filters.setSelectedPairingFilter,
    onCountryChange: filters.setSelectedCountryFilter,
    onRegionChange: filters.setSelectedRegionFilter,
    onTypeChange: filters.setSelectedTypeFilter,
    onVintageChange: filters.setSelectedVintageFilter,
    onGrapeChange: filters.setSelectedGrapeFilter,
    onStorageSpaceFilterChange: filters.setSelectedStorageSpaceFilterId,
  }), [aggregate.filterOptions, filters]);

  const wineActionsProps = useMemo(() => ({
    onEditWine: props.onEditWine,
    onDrinkWine: props.onDrinkWine,
    onDeleteWine: (id: string, imagePath: string | null) =>
      confirmAction("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?",
        () => ctx.deleteWine(id, imagePath)),
    onOpenSystembolaget: handleOpenSystembolaget,
  }), [props.onEditWine, props.onDrinkWine, ctx.deleteWine, handleOpenSystembolaget]);

  return (
    <MinKallarePanel
      styles={styles}
      stats={aggregate.stats}
      aggregate={aggregate}
      filter={filterProps}
      storage={props.storage}
      wineActions={wineActionsProps}
      loading={aggregateLoading}
      onRefreshStats={ctx.refreshAggregate}
      onSignOut={props.onOpenProfile}
      onNavigateToAdd={props.onNavigateToAdd}
      highlightedWineId={props.highlightedWineId}
      onClearHighlight={props.onClearHighlight}
      onHighlightWine={props.onHighlightWine}
      refreshing={props.refreshing}
      onRefresh={props.onRefresh}
    />
  );
}
```

- [ ] **Step 3: Update `min-kallare-panel.tsx`**

Rewrite to source bottle counts from `aggregate.bottleCountsBySpaceId`, and section data from `ctx.getSpaceWines(spaceId).wines`. Expansion triggers `ctx.requestSpace(spaceId)`.

Key changes to the existing file:

1. Remove `filteredWines`, `hasMoreWines`, `onLoadMoreWines` from `MinKallarePanelProps`. Add `aggregate: CellarAggregate` and drop `storageSpaceBottleCounts` from `storage` usage.
2. Import `useCellar` inside the panel for `getSpaceWines` + `requestSpace` (or thread them via props — prefer context lookup to keep props lean).
3. Rewrite `useCellarSections` to build sections from aggregate + space cache.

Full replacement of the panel:

```tsx
// src/components/min-kallare-panel.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";

import { useCellar } from "../contexts/CellarContext";
import { SPACE_TYPE_LABELS } from "../lib/storage-types";
import { UNPLACED_SPACE_ID } from "../hooks/useCellarSpaceWines";
import type { CellarAggregate, CellarStats } from "../types/cellar-aggregate";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";
import type { FilterProps, StorageProps, WineActionsProps } from "../types/panel-prop-groups";
import { CellarListHeader } from "./cellar-list-header";
import { StorageSpaceActions } from "./storage-space-actions";
import { ShelfGrid } from "./shelf-grid";
import { WineCard } from "./wine-card";

import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

type WineSection = {
  key: string;
  title: string;
  spaceType: string;
  bottleCount: number;
  isUnplaced: boolean;
  space?: StorageSpaceRow;
  data: WineRecord[];
  loading: boolean;
};

type MinKallarePanelProps = {
  styles: SharedStyles;
  stats: CellarStats;
  aggregate: CellarAggregate;
  filter: FilterProps;
  storage: StorageProps;
  wineActions: WineActionsProps;
  loading: boolean;
  onRefreshStats: () => void;
  onSignOut: () => void;
  onNavigateToAdd: () => void;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  onHighlightWine?: (wineId: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function MinKallarePanel(props: MinKallarePanelProps) {
  const { styles, stats, aggregate, storage, wineActions } = props;
  const ctx = useCellar();
  const { storageSpaces, storageSpaceById } = storage;

  const [statsExpanded, setStatsExpanded] = useState(false);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(
    () => new Set([UNPLACED_SPACE_ID])
  );
  const listRef = useRef<SectionList<WineRecord, WineSection>>(null);

  // Request wines for default-expanded spaces on mount.
  useEffect(() => {
    expandedSpaceIds.forEach((id) => ctx.requestSpace(id));
    // Only on mount — subsequent expansions handled in toggleSpace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When a filter or search is active, auto-expand spaces with matches.
  const filterIsActive = Object.keys(ctx.filters.filterState).length > 0
    || ctx.filters.searchQuery.trim().length > 0;

  useEffect(() => {
    if (!filterIsActive) return;
    const matching = new Set<string>();
    if (aggregate.unplacedCount > 0) matching.add(UNPLACED_SPACE_ID);
    for (const [id, cnt] of Object.entries(aggregate.bottleCountsBySpaceId)) {
      if (cnt > 0) matching.add(id);
    }
    setExpandedSpaceIds(matching);
    matching.forEach((id) => ctx.requestSpace(id));
  }, [filterIsActive, aggregate.bottleCountsBySpaceId, aggregate.unplacedCount, ctx]);

  const toggleSpace = useCallback((spaceId: string) => {
    setExpandedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else { next.add(spaceId); ctx.requestSpace(spaceId); }
      return next;
    });
  }, [ctx]);

  const sections = useCellarSections({
    aggregate, storageSpaces, storageSpaceById, expandedSpaceIds,
    getSpaceWines: ctx.getSpaceWines,
  });

  useHighlightAutoExpand(
    props.highlightedWineId, sections, setExpandedSpaceIds,
    ctx.requestSpace, props.onClearHighlight,
  );

  useEffect(() => {
    if (!props.highlightedWineId) return;
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const iIdx = sections[sIdx].data.findIndex((w) => w.id === props.highlightedWineId);
      if (iIdx >= 0) {
        setTimeout(() => listRef.current?.scrollToLocation({
          sectionIndex: sIdx, itemIndex: iIdx, animated: true, viewOffset: 100,
        }), 100);
        return;
      }
    }
  }, [props.highlightedWineId, sections]);

  const summaryText = useMemo(() => {
    const c = aggregate.filterOptions.countries.length;
    return `${stats.totalBottles} flaskor · ${c} länder · snitt ${stats.averageVintage}`;
  }, [stats.totalBottles, stats.averageVintage, aggregate.filterOptions.countries.length]);

  const renderSectionHeader = useCallback(({ section }: { section: WineSection }) => (
    <SectionHeader
      section={section} styles={styles} expandedSpaceIds={expandedSpaceIds}
      toggleSpace={toggleSpace}
      onUpdateStorageSpace={storage.onUpdateStorageSpace}
      onDeleteStorageSpace={storage.onDeleteStorageSpace}
      getSpaceWines={ctx.getSpaceWines}
      onGoToWine={(wine) => {
        const spaceId = wine.storage_space_id || UNPLACED_SPACE_ID;
        setExpandedSpaceIds((prev) => { const n = new Set(prev); n.add(spaceId); return n; });
        ctx.requestSpace(spaceId);
        props.onHighlightWine?.(wine.id);
      }}
    />
  ), [styles, expandedSpaceIds, toggleSpace, storage.onUpdateStorageSpace,
      storage.onDeleteStorageSpace, ctx.getSpaceWines, ctx.requestSpace,
      props.onHighlightWine]);

  const renderItem = useCallback(({ item }: { item: WineRecord }) => (
    <WineCard wine={item} styles={styles} highlighted={item.id === props.highlightedWineId}
      storageSpaceById={storageSpaceById}
      onOpenSystembolaget={wineActions.onOpenSystembolaget}
      onEditWine={wineActions.onEditWine}
      onDrinkWine={wineActions.onDrinkWine}
      onDeleteWine={wineActions.onDeleteWine} />
  ), [styles, props.highlightedWineId, storageSpaceById, wineActions]);

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={
        <CellarListHeader
          styles={styles} stats={stats} filter={props.filter} storage={storage}
          statsExpanded={statsExpanded} onToggleStats={() => setStatsExpanded((v) => !v)}
          summaryText={summaryText} hasSections={sections.length > 0}
          onRefreshStats={props.onRefreshStats} onSignOut={props.onSignOut}
          onNavigateToAdd={props.onNavigateToAdd}
          loading={props.loading}
        />
      }
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.panel, { flexGrow: 1, marginHorizontal: 20, marginTop: 20, maxWidth: 520, width: "100%", alignSelf: "center" as const }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false}
          onRefresh={props.onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined
      }
      initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5}
      stickySectionHeadersEnabled={false}
    />
  );
}

function SectionHeader({ section, styles, expandedSpaceIds, toggleSpace,
  onUpdateStorageSpace, onDeleteStorageSpace, getSpaceWines, onGoToWine }: {
  section: WineSection; styles: SharedStyles; expandedSpaceIds: Set<string>;
  toggleSpace: (id: string) => void;
  onUpdateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDeleteStorageSpace: (id: string) => void;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
  onGoToWine?: (wine: WineRecord) => void;
}) {
  const isExpanded = expandedSpaceIds.has(section.key);
  const hasGrid = !section.isUnplaced && section.space
    && section.space.row_count > 0 && section.space.slots_per_row > 0;
  const spaceWines = getSpaceWines(section.key).wines;
  return (
    <View>
      <Pressable onPress={() => toggleSpace(section.key)}
        style={[styles.storageCard, section.isUnplaced && { borderWidth: 2, borderColor: colors.warm }]}>
        <View style={styles.storageCardHeader}>
          <View style={styles.flex}>
            <Text style={styles.wineType}>{section.spaceType}</Text>
            <Text style={styles.wineName}>{section.title}</Text>
          </View>
          <View style={styles.storageCardRight}>
            <View style={[styles.quantityBadge, section.isUnplaced && { backgroundColor: colors.warm }]}>
              <Text style={styles.quantityBadgeText}>{section.bottleCount} st</Text>
            </View>
            <Text style={styles.sectionChevron}>{isExpanded ? "▾" : "›"}</Text>
          </View>
        </View>
      </Pressable>
      {!section.isUnplaced && section.space && isExpanded ? (
        <StorageSpaceActions space={section.space} styles={styles}
          onUpdate={onUpdateStorageSpace} onDelete={onDeleteStorageSpace} />
      ) : null}
      {hasGrid && isExpanded ? (
        <ShelfGrid space={section.space!} wines={spaceWines} onGoToWine={onGoToWine} />
      ) : null}
    </View>
  );
}

function useCellarSections({ aggregate, storageSpaces, storageSpaceById,
  expandedSpaceIds, getSpaceWines }: {
  aggregate: CellarAggregate;
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  expandedSpaceIds: Set<string>;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
}): WineSection[] {
  return useMemo(() => {
    const result: WineSection[] = [];

    if (aggregate.unplacedCount > 0) {
      const s = getSpaceWines(UNPLACED_SPACE_ID);
      result.push({
        key: UNPLACED_SPACE_ID, title: "Otilldelade", spaceType: "Behöver plats",
        bottleCount: aggregate.unplacedCount, isUnplaced: true,
        data: expandedSpaceIds.has(UNPLACED_SPACE_ID) ? s.wines : [],
        loading: s.loading,
      });
    }

    for (const space of storageSpaces) {
      const cnt = aggregate.bottleCountsBySpaceId[space.id] ?? 0;
      const s = getSpaceWines(space.id);
      result.push({
        key: space.id, title: space.name,
        spaceType: SPACE_TYPE_LABELS[space.space_type] || space.space_type,
        bottleCount: cnt, isUnplaced: false, space: storageSpaceById.get(space.id),
        data: expandedSpaceIds.has(space.id) ? s.wines : [],
        loading: s.loading,
      });
    }
    return result;
  }, [aggregate.bottleCountsBySpaceId, aggregate.unplacedCount, storageSpaces,
      storageSpaceById, expandedSpaceIds, getSpaceWines]);
}

function useHighlightAutoExpand(
  highlightedWineId: string | null | undefined,
  sections: WineSection[],
  setExpandedSpaceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  requestSpace: (id: string) => void,
  onClearHighlight?: () => void,
) {
  useEffect(() => {
    if (!highlightedWineId) return;
    for (const section of sections) {
      if (section.data.some((w) => w.id === highlightedWineId)) {
        setExpandedSpaceIds((prev) => {
          if (prev.has(section.key)) return prev;
          const n = new Set(prev); n.add(section.key); return n;
        });
        requestSpace(section.key);
        const t = setTimeout(() => onClearHighlight?.(), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [highlightedWineId, sections, setExpandedSpaceIds, requestSpace, onClearHighlight]);
}
```

- [ ] **Step 4: Update `App.tsx` to drop stats prop**

`CellarScreenInner` currently passes `stats={ctx.stats}` and `onRefreshStats={ctx.refreshWines}` to `<CellarTab>`. After Task 7 step 2 `CellarTab` reads these from context directly. Remove those two props from the `<CellarTab>` JSX in `App.tsx`:

```tsx
// Before:
//   <CellarTab ... stats={ctx.stats} onRefreshStats={ctx.refreshWines} ... />
// After:
//   <CellarTab ... />
```

Also remove the `stats`-related destructure and the `Stats` type if no longer referenced.

- [ ] **Step 5: TypeScript compile**

```bash
cd mobile-app && npx tsc --noEmit
```

Expected: 0 errors. `cellar-list-header.tsx` still references `stats: { ... }` via `CellarListHeaderProps` — that matches `CellarStats`, no change needed in its props shape.

- [ ] **Step 6: Run unit tests**

```bash
cd mobile-app && npx jest
```

Expected: all pass.

- [ ] **Step 7: Manual browser check**

```bash
cd mobile-app && npm run web
```

Open in browser, log in, visit Min källare. Expected:
- Space cards render with correct counts immediately (much faster than before).
- "Otilldelade" is auto-expanded and shows its wines after brief load.
- Tap a space → wines load and appear.
- Select a type filter → counts on all cards update, matching spaces auto-expand.
- Type in search → same as above after short delay.

- [ ] **Step 8: Commit**

```bash
git add mobile-app/src/components/cellar-tab.tsx mobile-app/src/components/min-kallare-panel.tsx mobile-app/App.tsx mobile-app/src/types/panel-prop-groups.ts
git commit -m "feat(cellar): Min källare renders from aggregate + per-space lazy loader"
```

---

## Task 8: Write-path invalidation (add / edit / delete / drink)

**Files:**
- Modify: `mobile-app/src/hooks/useEditWineModal.ts` (uses `setWines`)
- Modify: `mobile-app/src/hooks/useDrinkWineModal.ts` (uses `setWines`, `setHistoryEntries`)
- Modify: `mobile-app/src/components/add-wine-panel.tsx` or wherever `insert` wines is called
- Modify: `mobile-app/src/contexts/CellarContext.tsx` — expose a small helper `onCellarMutated(spaceIdMaybe?: string)` that:
  1. calls `invalidateSpace(spaceId)` for affected space(s) (or `invalidateAllSpaceWines()` when the change is cross-space — e.g., move)
  2. calls `refreshAggregate()` (counts + stats + filter options)

- [ ] **Step 1: Add `onCellarMutated` to CellarContext**

In `CellarContext.tsx`, after the `refreshAll` useCallback, add:

```ts
const onCellarMutated = useCallback(
  async (opts: { spaceIds?: Array<string | null> } = {}) => {
    const ids = opts.spaceIds ?? [];
    if (ids.length === 0) {
      spaceWines.invalidateAll();
    } else {
      for (const id of ids) {
        spaceWines.invalidateSpace(id ?? UNPLACED_SPACE_ID);
      }
    }
    await refreshAggregate();
  },
  [spaceWines, refreshAggregate],
);
```

Add `UNPLACED_SPACE_ID` import at top of `CellarContext.tsx`. Add `onCellarMutated` to the `CellarContextValue` type and the `value` object.

- [ ] **Step 2: Call `onCellarMutated` from write paths**

Grep for call sites that mutate `wines`:

```bash
grep -rn "setWines" mobile-app/src/hooks mobile-app/src/components mobile-app/src/lib
```

For each site (add, edit, delete, drink), **after** the Supabase write succeeds, call `ctx.onCellarMutated({ spaceIds: [affectedSpaceId] })`. For edits that change `storage_space_id`, pass both old and new: `{ spaceIds: [oldSpaceId, newSpaceId] }`.

Example for `useEditWineModal`: the hook receives `setWines` today. Inject a new `onCellarMutated` dep via the caller and invoke it after save. Update the `useEditWineModal` call in `App.tsx`:

```tsx
const edit = useEditWineModal({
  userId: session.user.id,
  setWines: ctx.setWines,
  fetchCatalogEntries: ctx.fetchCatalogEntries,
  showSuccess: success.show,
  storageSpaces: ctx.storageSpaces,
  saveStorageSpace: ctx.saveStorageSpace,
  getOccupiedPositions: storage.getOccupiedPositions,
  pickImageFromLibrary: images.pickImageFromLibrary,
  takePhoto: images.takePhoto,
  onCellarMutated: ctx.onCellarMutated, // NEW
});
```

Inside `useEditWineModal.ts`, accept the new param and invoke it after the Supabase `update()` resolves successfully. Do the same for `useDrinkWineModal.ts` and for the add flow in `add-wine-panel.tsx`. Similarly, update `ctx.deleteWine` in `useWines.ts` to call `onCellarMutated` — but since `useWines` doesn't have access to the context, expose this as a wrapper in `CellarContext.tsx` that wraps the existing `deleteWine`:

```ts
const deleteWineAndMutate = useCallback(async (id: string, imagePath?: string | null) => {
  const wine = wineData.wines.find((w) => w.id === id);
  await wineData.deleteWine(id, imagePath);
  await onCellarMutated({ spaceIds: [wine?.storage_space_id ?? null] });
}, [wineData, onCellarMutated]);
```

And replace `deleteWine: wineData.deleteWine` with `deleteWine: deleteWineAndMutate` in the `value` object.

- [ ] **Step 3: TypeScript compile**

```bash
cd mobile-app && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Unit tests**

```bash
cd mobile-app && npx jest
```

Expected: all pass. If `useWinesAndHistory.test.tsx` calls `deleteWine` and now fails because `onCellarMutated` isn't wired, it's fine — that test targets `useWines` directly, not the context wrapper, and uses the raw `deleteWine`.

- [ ] **Step 5: Manual browser check**

Add a new wine, edit a wine (including moving it between spaces), delete a wine, drink a wine. After each, counts on space cards + stats should update and the affected expanded space(s) should show the new list without manual pull-to-refresh.

- [ ] **Step 6: Commit**

```bash
git add mobile-app/src/contexts/CellarContext.tsx mobile-app/src/hooks/useEditWineModal.ts mobile-app/src/hooks/useDrinkWineModal.ts mobile-app/src/components/add-wine-panel.tsx mobile-app/App.tsx
git commit -m "feat(cellar): invalidate aggregate + space cache on mutations"
```

---

## Task 9: Remove dead derived data from `useWines` and `cellar-helpers`

**Files:**
- Modify: `mobile-app/src/hooks/useWines.ts`
- Modify: `mobile-app/src/lib/cellar-helpers.ts`
- Modify: `mobile-app/src/lib/__tests__/cellar-helpers.test.ts`
- Modify: `mobile-app/src/hooks/__tests__/useWinesAndHistory.test.tsx`
- Modify: `mobile-app/src/contexts/CellarContext.tsx`

Per CLAUDE.md anti-bloat rules: remove derived outputs that no component reads anymore. Wine list + pagination + `deleteWine` stay (used by Tasting, Edit, Storage selection occupancy, Catalog backfill).

- [ ] **Step 1: Grep for remaining consumers of the soon-to-be-removed fields**

```bash
grep -rn "ctx\.stats\|ctx\.storageSpaceBottleCounts\|ctx\.pairingOptions\|ctx\.countryOptions\|ctx\.regionOptions\|ctx\.typeOptions\|ctx\.vintageOptions\|ctx\.cellarGrapeOptions" mobile-app/src mobile-app/App.tsx
```

Expected: only internal references in `CellarContext.tsx` and legacy tests. If any component still reads these fields, migrate it to `ctx.aggregate.*` first, then proceed.

- [ ] **Step 2: Remove derived outputs from `useWines.ts`**

Strip `stats`, `storageSpaceBottleCounts`, `pairingOptions`, `countryOptions`, `regionOptions`, `typeOptions`, `vintageOptions`, `cellarGrapeOptions` and their `useMemo` computations. The hook returns only: `wines, setWines, loading, fetchWines, fetchMoreWines, hasMoreWines, deleteWine`.

- [ ] **Step 3: Remove the corresponding fields from `CellarContext.tsx`**

Drop them from `CellarContextValue` and the `value` object. Also drop the StorageProps `storageSpaceBottleCounts` field in `panel-prop-groups.ts` if it's no longer used anywhere (grep to confirm).

- [ ] **Step 4: Remove unused helpers from `cellar-helpers.ts`**

Delete these exported functions (no longer called):

- `buildStorageSpaceBottleCounts`
- `buildStats`
- `buildPairingOptions`
- `buildValueOptions`
- `buildVintageOptions`

Keep `buildHistoryStats` (used by History tab), `buildNumericOptions`, `getWineStoragePlacementLabel`, `buildSystembolagetProductUrl`, `FOOD_CATEGORIES`, `getSuggestedPairings`, `parseTags`, `toNumberOrNull`, `emptyToNull`, `mergeTagText`, `resolveImportedValue`, `normalizeLookupValue`.

- [ ] **Step 5: Strip the obsolete tests**

In `mobile-app/src/lib/__tests__/cellar-helpers.test.ts`, delete `describe` blocks for the removed functions. Keep the blocks that cover the survivors.

In `mobile-app/src/hooks/__tests__/useWinesAndHistory.test.tsx`, delete:
- The `test("stats reflect loaded wines", ...)` block
- The `test("pairingOptions derived from wines", ...)` block
- The `jest.mock("../../lib/cellar-helpers", ...)` block (no longer needed)

- [ ] **Step 6: TypeScript compile + tests**

```bash
cd mobile-app && npx tsc --noEmit && npx jest
```

Expected: 0 tsc errors, all tests pass.

- [ ] **Step 7: Verify file sizes**

```bash
wc -l mobile-app/src/hooks/useWines.ts mobile-app/src/lib/cellar-helpers.ts mobile-app/src/components/min-kallare-panel.tsx mobile-app/src/contexts/CellarContext.tsx
```

Expected: all under 500 lines (CLAUDE.md limit). `useWines.ts` should be ~35 lines, noticeably smaller than before.

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "refactor(cellar): remove derived outputs superseded by aggregate"
```

---

## Task 10: End-to-end manual QA

- [ ] **Step 1: Cold-load timing**

```bash
cd mobile-app && npm run web
```

Log in to a user with >50 wines. Open DevTools Network tab, reload Min källare. Measure time from navigation start to "all space cards visible with counts" — target < 800 ms on a warm cache, < 1.2 s cold. The old path took several seconds for the same user.

- [ ] **Step 2: Correctness check with >50 wines**

On the same account, confirm that the "X flaskor · Y länder · snitt ZZZZ" summary shows the true total (not 50). Open the stats panel; spot-check that `topCountry` matches a known distribution.

- [ ] **Step 3: Filter/search behavior**

Select "Rött" type filter. Counts on each space card should drop to reds-only, matching spaces auto-expand and show only reds. Search for a producer name → same behavior.

- [ ] **Step 4: Mutation paths**

Add a new wine to a collapsed space. The space's count should increment without needing to pull-to-refresh. Edit a wine to move it between spaces — both counts update. Drink a wine that empties the bottle — count decrements.

- [ ] **Step 5: Other tabs still work**

Open Tasting tab, verify wines list renders (drawn from `ctx.wines`, still populated by legacy `useWines`). Open Add wine tab — storage-selection occupied-positions logic works. Open Historik.

- [ ] **Step 6: Commit (if QA tweaks were needed)**

If you made adjustments during QA, commit them with a descriptive message. If not, skip this step.

---

## Notes for the implementer

**Testing the RPC:** If the test Supabase project doesn't have the migration applied, the aggregate hook tests still pass (they mock `supabase.rpc`). Integration against the real RPC happens in manual QA (Task 10).

**Guarded fetcher:** The existing `createGuardedFetcher` pattern in `useWines` prevents overlapping fetches. The new hooks use a simpler `inFlight` counter / `activeCacheKey` ref approach for the same guarantee. Don't re-wrap in `createGuardedFetcher` — it adds complexity without benefit here.

**`UNPLACED_SPACE_ID`:** Exported from `useCellarSpaceWines.ts` (`"__unplaced__"`). Reused in `min-kallare-panel.tsx` and `CellarContext.tsx`. Any other consumer should import from the hook file, not redeclare the string literal.

**Debouncing search:** The aggregate re-fetches on every keystroke of `searchQuery`. If that ever becomes too chatty in practice, wrap `filters.searchQuery` through a debounced state variable before passing to the aggregate hook — but don't add this preemptively; the RPC is cheap and network latency is low.

**Anti-bloat self-check after implementation:** per CLAUDE.md, after this plan lands verify:

```bash
wc -l mobile-app/src/hooks/useCellarAggregate.ts mobile-app/src/hooks/useCellarSpaceWines.ts mobile-app/src/hooks/useCellarFilters.ts mobile-app/src/components/min-kallare-panel.tsx mobile-app/src/components/cellar-tab.tsx mobile-app/src/contexts/CellarContext.tsx
```

Each file should be under 500 lines, and no function over 50 lines. If `min-kallare-panel.tsx` or `CellarContext.tsx` cross the limit, split before merging.
