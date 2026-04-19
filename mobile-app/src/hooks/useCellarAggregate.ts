import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { EMPTY_AGGREGATE, type CellarAggregate, type CellarFilterState } from "../types/cellar-aggregate";

const CACHE_KEY_PREFIX = "cellar_aggregate_";

function getWebStorage(): Storage | null {
  if (Platform.OS !== "web") return null;
  try { return (globalThis as { localStorage?: Storage }).localStorage ?? null; }
  catch { return null; }
}

function readCache(userId: string): CellarAggregate | null {
  const ls = getWebStorage();
  if (!ls || !userId) return null;
  try {
    const raw = ls.getItem(CACHE_KEY_PREFIX + userId);
    return raw ? (JSON.parse(raw) as CellarAggregate) : null;
  } catch { return null; }
}

function writeCache(userId: string, value: CellarAggregate): void {
  const ls = getWebStorage();
  if (!ls || !userId) return;
  try { ls.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(value)); } catch { /* quota/security */ }
}

export function useCellarAggregate(userId: string, filters: CellarFilterState, search: string) {
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const searchArg = search.trim() || null;
  const isBaseQuery = filtersKey === "{}" && searchArg === null;

  // Read cache once on mount to render instantly from the last known state.
  const initialCache = useMemo(() => (isBaseQuery ? readCache(userId) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [aggregate, setAggregate] = useState<CellarAggregate>(initialCache ?? EMPTY_AGGREGATE);
  const [loading, setLoading] = useState(initialCache === null);
  const inFlight = useRef(0);

  const fetchAggregate = useCallback(async () => {
    const token = ++inFlight.current;
    const t0 = performance.now();
    const { data, error } = await supabase.rpc("get_cellar_overview", {
      p_filters: JSON.parse(filtersKey),
      p_search: searchArg,
    });
    console.log(`[perf] aggregate.rpc ${error ? "err" : "ok"} start=${Math.round(t0)}ms dur=${Math.round(performance.now() - t0)}ms`);
    if (token !== inFlight.current) return; // a later fetch has started; discard this stale response
    if (error) {
      showError("Kunde inte hämta källaren", error.message);
      setLoading(false);
      return;
    }
    const next = (data as CellarAggregate | null) ?? EMPTY_AGGREGATE;
    setAggregate(next);
    setLoading(false);
    if (isBaseQuery) writeCache(userId, next);
  }, [filtersKey, searchArg, isBaseQuery, userId]);

  useEffect(() => { void fetchAggregate(); }, [fetchAggregate]);

  return { aggregate, loading, refresh: fetchAggregate };
}
