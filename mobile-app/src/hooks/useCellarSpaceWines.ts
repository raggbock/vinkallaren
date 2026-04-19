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

function buildCacheKey(filters: CellarFilterState, search: string) {
  return JSON.stringify(filters) + "|" + search.trim().toLowerCase();
}

export function useCellarSpaceWines(filters: CellarFilterState, search: string) {
  const cacheKey = useMemo(() => buildCacheKey(filters, search), [filters, search]);
  const [states, setStates] = useState<Record<string, SpaceState>>({});
  const activeCacheKey = useRef(cacheKey);

  // Sync the ref to the latest cacheKey during render so requestSpace() sees it immediately.
  // When the key actually changes, schedule a state reset in an effect (state updates are illegal during render).
  const keyChanged = activeCacheKey.current !== cacheKey;
  if (keyChanged) activeCacheKey.current = cacheKey;

  useEffect(() => {
    if (keyChanged) setStates({});
  }, [cacheKey]);

  const fetchSpace = useCallback(async (spaceId: string, keyAtStart: string) => {
    // Apply space filter before .gt so the mock chain stays valid (eq→gt→eq).
    let query = supabase.from("wines").select("*");
    if (spaceId === UNPLACED_SPACE_ID) {
      query = query.is("storage_space_id", null).gt("quantity", 0);
    } else {
      query = query.eq("storage_space_id", spaceId).gt("quantity", 0);
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
      const like = `%${escapeOrFilterValue(searchTrim)}%`;
      query = query.or(
        `name.ilike.${like},producer.ilike.${like},country.ilike.${like},` +
        `region.ilike.${like},grape.ilike.${like},type.ilike.${like},` +
        `cellar_location.ilike.${like}`
      );
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (keyAtStart !== activeCacheKey.current) return; // stale cache key
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
