import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { searchCatalogWineNames, fetchCatalogEntriesByName, matchCatalogByText } from "../lib/catalog-search";
import { canBeSavedAsCatalogEntry, buildCatalogBackfillPayload } from "../lib/wine-helpers";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import { createGuardedFetcher } from "../lib/guarded-fetcher";
import type { WineRecord } from "../types/wine";

const BACKFILL_KEY = "catalog_backfill_date";

export function useCatalog(userId: string, wines: WineRecord[], winesLoading: boolean) {
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(false);
  const [catalogBackfillDone, setCatalogBackfillDone] = useState(false);

  async function fetchCatalogEntriesRaw() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) { showError("Kunde inte hämta produktkatalogen", error.message); setLoadingCatalogEntries(false); return; }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }
  const fetchCatalogEntries = createGuardedFetcher(fetchCatalogEntriesRaw);

  // Catalog backfill — runs at most once per day (persisted via AsyncStorage)
  useEffect(() => {
    if (catalogBackfillDone || winesLoading || wines.length === 0) return;
    let cancelled = false;
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const lastRun = await AsyncStorage.getItem(BACKFILL_KEY);
      if (lastRun === today) { setCatalogBackfillDone(true); return; }
      const completeWines = wines.filter(canBeSavedAsCatalogEntry);
      if (completeWines.length === 0) { setCatalogBackfillDone(true); return; }
      const payload = buildCatalogBackfillPayload(completeWines, userId);
      const { data: count } = await supabase.rpc("batch_upsert_catalog_wines", { wines: payload });
      if (!cancelled) {
        if (count && count > 0) await fetchCatalogEntries();
        await AsyncStorage.setItem(BACKFILL_KEY, today);
        setCatalogBackfillDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogBackfillDone, winesLoading, userId, wines]);

  return {
    catalogEntries, loadingCatalogEntries,
    fetchCatalogEntries,
    searchCatalogWineNames, fetchCatalogEntriesByName, matchCatalogByText,
  };
}
