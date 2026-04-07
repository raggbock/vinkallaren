import { useEffect, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { GRAPE_VARIETIES, WINE_COUNTRIES, WINE_REGIONS } from "../lib/reference-data";
import {
  buildMealRecommendations,
  buildPairingOptions,
  buildStats,
  buildStorageSpaceBottleCounts,
  buildValueOptions,
  buildVintageOptions,
} from "../lib/cellar-helpers";
import {
  cacheWineRecordAsCatalogEntry,
  canBeSavedAsCatalogEntry,
  hydrateWineHistoryRecords,
  hydrateWineRecords,
  mergeReferenceRows,
} from "../lib/wine-helpers";
import { searchCatalogWineNames, fetchCatalogEntriesByName, matchCatalogByText } from "../lib/catalog-search";
import { useStorageSpaces } from "./useStorageSpaces";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { WineHistoryRecord, WineHistoryRow } from "../types/wine-history";
import type { WineRecord, WineRow } from "../types/wine";

const WINES_PAGE_SIZE = 50;
const HISTORY_PAGE_SIZE = 50;

function createGuardedFetcher<T>(fn: () => Promise<T>): () => Promise<T | undefined> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export function useCellarData(userId: string) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [hasMoreWines, setHasMoreWines] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<WineHistoryRecord[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(true);
  const [catalogBackfillDone, setCatalogBackfillDone] = useState(false);

  const storage = useStorageSpaces(userId);

  // --- Wine fetching ---

  async function fetchWinesRaw() {
    setLoading(true);
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).limit(WINES_PAGE_SIZE);
    if (error) { showError("Kunde inte hämta viner", error.message); setLoading(false); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    setWines(await hydrateWineRecords(rows));
    setLoading(false);
  }
  const fetchWines = createGuardedFetcher(fetchWinesRaw);

  async function fetchMoreWines() {
    if (!hasMoreWines) return;
    const offset = wines.length;
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).range(offset, offset + WINES_PAGE_SIZE - 1);
    if (error) { showError("Kunde inte hämta fler viner", error.message); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    const hydrated = await hydrateWineRecords(rows);
    setWines((prev) => [...prev, ...hydrated]);
  }

  // --- History fetching ---

  async function fetchHistoryEntriesRaw() {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(HISTORY_PAGE_SIZE);
    if (error) { showError("Kunde inte hämta historiken", error.message); setLoadingHistory(false); return; }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    setHistoryEntries(await hydrateWineHistoryRecords(rows));
    setLoadingHistory(false);
  }
  const fetchHistoryEntries = createGuardedFetcher(fetchHistoryEntriesRaw);

  async function fetchMoreHistory() {
    if (!hasMoreHistory) return;
    const offset = historyEntries.length;
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).range(offset, offset + HISTORY_PAGE_SIZE - 1);
    if (error) { showError("Kunde inte hämta fler poster", error.message); return; }
    const rows = (data ?? []) as WineHistoryRow[];
    setHasMoreHistory(rows.length === HISTORY_PAGE_SIZE);
    const hydrated = await hydrateWineHistoryRecords(rows);
    setHistoryEntries((prev) => [...prev, ...hydrated]);
  }

  // --- Catalog entries ---

  async function fetchCatalogEntriesRaw() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) { showError("Kunde inte hämta produktkatalogen", error.message); setLoadingCatalogEntries(false); return; }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }
  const fetchCatalogEntries = createGuardedFetcher(fetchCatalogEntriesRaw);

  // --- Reference options ---

  async function fetchReferenceOptions() {
    const { data, error } = await supabase.from("reference_options").select("*").in("category", ["grape", "country", "region"]).order("category", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) { showError("Kunde inte hämta referensdata", error.message); return; }
    setReferenceOptions((data ?? []) as ReferenceOptionRow[]);
  }

  function mergeReferenceOptions(wine: WineRow) {
    setReferenceOptions(prev => {
      const additions: ReferenceOptionRow[] = [];
      for (const [category, value] of [["grape", wine.grape], ["country", wine.country], ["region", wine.region]] as const) {
        if (value && !prev.some(o => o.category === category && o.name === value)) {
          additions.push({ category, name: value, sort_order: 999, id: `local-${category}-${value}`, aliases: [], parent_name: null, created_at: "", updated_at: "" });
        }
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }

  // --- Delete wine ---

  async function deleteWine(id: string, imagePath?: string | null) {
    const { error } = await supabase.from("wines").delete().eq("id", id);
    if (error) { showError("Kunde inte ta bort", error.message); return; }
    if (imagePath) await supabase.storage.from("wine-images").remove([imagePath]);
    setWines((current) => current.filter((wine) => wine.id !== id));
  }

  // --- Storage space delete override (also refreshes wines) ---

  async function deleteStorageSpace(id: string): Promise<boolean> {
    const ok = await storage.deleteStorageSpace(id);
    if (ok) await fetchWines();
    return ok;
  }

  // --- Initial load ---

  useEffect(() => {
    void fetchWines();
    void fetchHistoryEntries();
    void storage.fetchStorageSpaces();
    void fetchCatalogEntries();
    void fetchReferenceOptions();
  }, []);

  // --- Catalog backfill ---

  useEffect(() => {
    if (catalogBackfillDone || loading || wines.length === 0) return;
    const completeWines = wines.filter(canBeSavedAsCatalogEntry);
    if (completeWines.length === 0) { setCatalogBackfillDone(true); return; }
    let cancelled = false;
    void (async () => {
      let insertedCount = 0;
      for (const wine of completeWines) {
        if (cancelled) return;
        if (await cacheWineRecordAsCatalogEntry(wine, userId)) insertedCount++;
      }
      if (!cancelled) {
        if (insertedCount > 0) await fetchCatalogEntries();
        setCatalogBackfillDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogBackfillDone, loading, userId, wines]);

  // --- Derived data ---

  const stats = useMemo(() => buildStats(wines), [wines]);
  const storageSpaceById = useMemo(() => new Map(storage.storageSpaces.map((s) => [s.id, s])), [storage.storageSpaces]);
  const storageSpaceBottleCounts = useMemo(() => buildStorageSpaceBottleCounts(wines), [wines]);
  const pairingOptions = useMemo(() => buildPairingOptions(wines), [wines]);
  const countryOptions = useMemo(() => buildValueOptions(wines, (w) => w.country), [wines]);
  const regionOptions = useMemo(() => buildValueOptions(wines, (w) => w.region), [wines]);
  const typeOptions = useMemo(() => buildValueOptions(wines, (w) => w.type), [wines]);
  const vintageOptions = useMemo(() => buildVintageOptions(wines), [wines]);
  const cellarGrapeOptions = useMemo(() => buildValueOptions(wines, (w) => w.grape ?? null), [wines]);

  // --- Reference rows ---

  const grapeReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "grape")), [referenceOptions]);
  const countryReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "country")), [referenceOptions]);
  const regionReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "region")), [referenceOptions]);
  const grapeOptions = useMemo(() => grapeReferenceRows.map((o) => o.name), [grapeReferenceRows]);
  const countryReferenceOptions = useMemo(() => countryReferenceRows.map((o) => o.name), [countryReferenceRows]);
  const regionReferenceOptions = useMemo(() => regionReferenceRows.map((o) => o.name), [regionReferenceRows]);

  const effectiveGrapeOptions = grapeOptions.length > 0 ? grapeOptions : GRAPE_VARIETIES;
  const effectiveCountryOptions = countryReferenceOptions.length > 0 ? countryReferenceOptions : WINE_COUNTRIES;
  const effectiveRegionOptions = regionReferenceOptions.length > 0 ? regionReferenceOptions : WINE_REGIONS;

  return {
    wines, setWines, historyEntries, setHistoryEntries,
    storageSpaces: storage.storageSpaces, catalogEntries, referenceOptions,
    loading, loadingHistory,
    loadingStorageSpaces: storage.loadingStorageSpaces, loadingCatalogEntries,
    fetchWines, fetchMoreWines, hasMoreWines,
    fetchHistoryEntries, fetchMoreHistory, hasMoreHistory,
    fetchStorageSpaces: storage.fetchStorageSpaces, fetchCatalogEntries, fetchReferenceOptions, mergeReferenceOptions,
    searchCatalogWineNames, fetchCatalogEntriesByName, matchCatalogByText,
    storageSpaceDraft: storage.storageSpaceDraft, setStorageSpaceDraft: storage.setStorageSpaceDraft,
    savingStorageSpace: storage.savingStorageSpace, saveStorageSpace: storage.saveStorageSpace,
    updateStorageSpace: storage.updateStorageSpace, deleteStorageSpace, deleteWine,
    stats, storageSpaceById, storageSpaceBottleCounts,
    pairingOptions, countryOptions, regionOptions, typeOptions, vintageOptions, cellarGrapeOptions,
    grapeReferenceRows, countryReferenceRows, regionReferenceRows,
    effectiveGrapeOptions, effectiveCountryOptions, effectiveRegionOptions,
    buildMealRecommendations: (meal: string) => buildMealRecommendations(wines, meal),
  };
}
