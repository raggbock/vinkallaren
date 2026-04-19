import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { EMPTY_AGGREGATE, type CellarAggregate, type CellarFilterState } from "../types/cellar-aggregate";

export function useCellarAggregate(filters: CellarFilterState, search: string) {
  const [aggregate, setAggregate] = useState<CellarAggregate>(EMPTY_AGGREGATE);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(0);

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const searchArg = search.trim() || null;

  const fetchAggregate = useCallback(async () => {
    const token = ++inFlight.current;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_cellar_overview", {
      p_filters: JSON.parse(filtersKey),
      p_search: searchArg,
    });
    if (token !== inFlight.current) return; // a later fetch has started; discard this stale response
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
