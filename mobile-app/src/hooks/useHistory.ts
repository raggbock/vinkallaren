import { useCallback, useEffect, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { hydrateWineHistoryRecords } from "../lib/wine-helpers";
import { createGuardedFetcher } from "../lib/guarded-fetcher";
import type { WineHistoryRecord, WineHistoryRow } from "../types/wine-history";

const HISTORY_PAGE_SIZE = 50;

export function useHistory() {
  const [historyEntries, setHistoryEntries] = useState<WineHistoryRecord[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistoryEntries = useMemo(() => createGuardedFetcher(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(HISTORY_PAGE_SIZE);
    if (error) { showError("Kunde inte hämta historiken", error.message); setLoadingHistory(false); return; }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    setHistoryEntries(await hydrateWineHistoryRecords(rows));
    setLoadingHistory(false);
  }), []);

  const fetchMoreHistory = useCallback(async () => {
    if (!hasMoreHistory) return;
    const offset = historyEntries.length;
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).range(offset, offset + HISTORY_PAGE_SIZE - 1);
    if (error) { showError("Kunde inte hämta fler poster", error.message); return; }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    const hydrated = await hydrateWineHistoryRecords(rows);
    setHistoryEntries((prev) => [...prev, ...hydrated]);
  }, [hasMoreHistory, historyEntries.length]);

  useEffect(() => { void fetchHistoryEntries(); }, []);

  return {
    historyEntries, setHistoryEntries, loadingHistory,
    fetchHistoryEntries, fetchMoreHistory, hasMoreHistory,
  };
}
