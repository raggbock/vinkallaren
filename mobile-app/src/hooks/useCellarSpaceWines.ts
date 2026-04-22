import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { hydrateWineRecords } from "../lib/wine-helpers";
import { escapeOrFilterValue } from "../lib/query-helpers";
import type { CellarFilterState } from "../types/cellar-aggregate";
import type { WineRecord, WineRow } from "../types/wine";

export const UNPLACED_SPACE_ID = "__unplaced__";

type SpaceState = { wines: WineRecord[]; loading: boolean; loaded: boolean };

const EMPTY_STATE: SpaceState = { wines: [], loading: false, loaded: false };
const BATCH_WINDOW_MS = 16;

function buildCacheKey(filters: CellarFilterState, search: string) {
  return JSON.stringify(filters) + "|" + search.trim().toLowerCase();
}

function applyFilterPredicates<T>(query: T, filters: CellarFilterState, search: string): T {
  let q = query as unknown as {
    eq: (c: string, v: unknown) => T; contains: (c: string, v: unknown[]) => T; or: (s: string) => T;
  };
  const f = filters;
  if (f.country) q = q.eq("country", f.country) as unknown as typeof q;
  if (f.region) q = q.eq("region", f.region) as unknown as typeof q;
  if (f.type) q = q.eq("type", f.type) as unknown as typeof q;
  if (f.grape) q = q.eq("grape", f.grape) as unknown as typeof q;
  if (f.vintage) q = q.eq("vintage", Number(f.vintage)) as unknown as typeof q;
  if (f.pairing) q = q.contains("food_pairings", [f.pairing]) as unknown as typeof q;
  const s = search.trim();
  if (s.length > 0) {
    const like = `%${escapeOrFilterValue(s)}%`;
    q = q.or(
      `name.ilike.${like},producer.ilike.${like},country.ilike.${like},` +
      `region.ilike.${like},grape.ilike.${like},type.ilike.${like},` +
      `cellar_location.ilike.${like}`,
    ) as unknown as typeof q;
  }
  return q as unknown as T;
}

export function useCellarSpaceWines(filters: CellarFilterState, search: string) {
  const cacheKey = useMemo(() => buildCacheKey(filters, search), [filters, search]);
  const [states, setStates] = useState<Record<string, SpaceState>>({});
  const activeCacheKey = useRef(cacheKey);
  const pendingIds = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keyChanged = activeCacheKey.current !== cacheKey;
  if (keyChanged) activeCacheKey.current = cacheKey;

  useEffect(() => {
    if (keyChanged) setStates({});
  }, [cacheKey]);

  const fetchBatch = useCallback(async (spaceIds: string[], keyAtStart: string) => {
    const wantsUnplaced = spaceIds.includes(UNPLACED_SPACE_ID);
    const realIds = spaceIds.filter((id) => id !== UNPLACED_SPACE_ID);

    const t0 = performance.now();
    let query = supabase.from("wines").select("*").gt("quantity", 0);
    if (wantsUnplaced && realIds.length > 0) {
      query = query.or(`storage_space_id.is.null,storage_space_id.in.(${realIds.join(",")})`);
    } else if (wantsUnplaced) {
      query = query.is("storage_space_id", null);
    } else {
      query = query.in("storage_space_id", realIds);
    }
    query = applyFilterPredicates(query, filters, search);
    const { data, error } = await query.order("created_at", { ascending: false });
    const tSelect = performance.now();
    if (keyAtStart !== activeCacheKey.current) return;
    if (error) {
      showError("Kunde inte hämta viner", error.message);
      setStates((s) => {
        const next = { ...s };
        for (const id of spaceIds) next[id] = { ...EMPTY_STATE, loaded: true };
        return next;
      });
      return;
    }
    const rows = (data ?? []) as WineRow[];
    const hydrated = await hydrateWineRecords(rows);
    console.log(`[perf] space.fetch batch=${spaceIds.length} select=${Math.round(tSelect - t0)}ms hydrate=${Math.round(performance.now() - tSelect)}ms rows=${rows.length}`);
    if (keyAtStart !== activeCacheKey.current) return;
    const bucket: Record<string, WineRecord[]> = {};
    for (const id of spaceIds) bucket[id] = [];
    for (const w of hydrated) {
      const key = w.storage_space_id ?? UNPLACED_SPACE_ID;
      if (bucket[key]) bucket[key].push(w);
    }
    setStates((s) => {
      const next = { ...s };
      for (const id of spaceIds) next[id] = { wines: bucket[id], loading: false, loaded: true };
      return next;
    });
  }, [filters, search]);

  const flushPending = useCallback(() => {
    flushTimer.current = null;
    const ids = Array.from(pendingIds.current);
    pendingIds.current.clear();
    if (ids.length === 0) return;
    void fetchBatch(ids, activeCacheKey.current);
  }, [fetchBatch]);

  const requestSpace = useCallback((spaceId: string) => {
    setStates((s) => {
      if (s[spaceId]?.loaded || s[spaceId]?.loading) return s;
      pendingIds.current.add(spaceId);
      if (flushTimer.current === null) flushTimer.current = setTimeout(flushPending, BATCH_WINDOW_MS);
      return { ...s, [spaceId]: { wines: [], loading: true, loaded: false } };
    });
  }, [flushPending]);

  const invalidateSpace = useCallback((spaceId: string) => {
    setStates((s) => {
      if (!(spaceId in s)) return s;
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
