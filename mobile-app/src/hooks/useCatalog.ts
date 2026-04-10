import { useEffect, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { searchCatalogWineNames, fetchCatalogEntriesByName, matchCatalogByText } from "../lib/catalog-search";
import { canBeSavedAsCatalogEntry } from "../lib/wine-helpers";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { WineRecord } from "../types/wine";

function createGuardedFetcher<T>(fn: () => Promise<T>): () => Promise<T | undefined> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export function useCatalog(userId: string, wines: WineRecord[], winesLoading: boolean) {
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(true);
  const [catalogBackfillDone, setCatalogBackfillDone] = useState(false);

  async function fetchCatalogEntriesRaw() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) { showError("Kunde inte hämta produktkatalogen", error.message); setLoadingCatalogEntries(false); return; }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }
  const fetchCatalogEntries = createGuardedFetcher(fetchCatalogEntriesRaw);

  useEffect(() => { void fetchCatalogEntries(); }, []);

  // Catalog backfill — single batch RPC instead of per-wine requests
  useEffect(() => {
    if (catalogBackfillDone || winesLoading || wines.length === 0) return;
    const completeWines = wines.filter(canBeSavedAsCatalogEntry);
    if (completeWines.length === 0) { setCatalogBackfillDone(true); return; }
    let cancelled = false;
    void (async () => {
      const payload = completeWines.map((w) => ({
        barcode: w.barcode?.trim() || null,
        systembolaget_product_id: w.systembolaget_product_id?.trim() || null,
        name: w.name, producer: w.producer ?? null, country: w.country ?? null,
        region: w.region ?? null, grape: w.grape ?? null, type: w.type ?? null,
        vintage: w.vintage ?? null, food_pairings: w.food_pairings ?? [],
        source_label: "MinVinkällaren", source_confidence: "high", created_by: userId,
      }));
      const { data: count } = await supabase.rpc("batch_upsert_catalog_wines", { wines: payload });
      if (!cancelled) {
        if (count && count > 0) await fetchCatalogEntries();
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
