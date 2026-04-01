import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "../lib/supabase";
import { GRAPE_VARIETIES, WINE_COUNTRIES, WINE_REGIONS } from "../lib/reference-data";
import {
  buildMealRecommendations,
  buildPairingOptions,
  buildStats,
  buildStorageSpaceBottleCounts,
  buildValueOptions,
  buildVintageOptions,
  emptyToNull,
  normalizeLookupValue,
} from "../lib/cellar-helpers";
import {
  cacheWineRecordAsCatalogEntry,
  canBeSavedAsCatalogEntry,
  hydrateWineHistoryRecords,
  hydrateWineRecords,
  mergeReferenceRows,
} from "../lib/wine-helpers";
import type { Suggestion } from "../components/form-controls";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import { defaultStorageSpaceDraft } from "../types/cellar-drafts";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceInsert, StorageSpaceRow } from "../types/storage-space";
import type { WineHistoryRecord, WineHistoryRow } from "../types/wine-history";
import type { WineRecord, WineRow } from "../types/wine";

export type CatalogTextMatch = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  similarity: number;
};

export function useCellarData(userId: string) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [historyEntries, setHistoryEntries] = useState<WineHistoryRecord[]>([]);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceRow[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingStorageSpaces, setLoadingStorageSpaces] = useState(true);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(true);
  const [catalogBackfillDone, setCatalogBackfillDone] = useState(false);
  const [storageSpaceDraft, setStorageSpaceDraft] = useState<StorageSpaceDraft>(defaultStorageSpaceDraft);
  const [savingStorageSpace, setSavingStorageSpace] = useState(false);

  // --- Data fetching ---

  async function fetchWines() {
    setLoading(true);
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false });
    if (error) {
      Alert.alert("Kunde inte hämta viner", error.message);
      setLoading(false);
      return;
    }
    setWines(await hydrateWineRecords((data ?? []) as WineRow[]));
    setLoading(false);
  }

  async function fetchHistoryEntries() {
    setLoadingHistory(true);
    const { data, error } = await supabase.from("wine_history").select("*").order("consumed_at", { ascending: false }).limit(100);
    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }
    setHistoryEntries(await hydrateWineHistoryRecords((data ?? []) as WineHistoryRow[]));
    setLoadingHistory(false);
  }

  async function fetchStorageSpaces() {
    setLoadingStorageSpaces(true);
    const { data, error } = await supabase.from("storage_spaces").select("*").order("created_at", { ascending: true });
    if (error) {
      Alert.alert("Kunde inte hämta förvaringsplatser", error.message);
      setLoadingStorageSpaces(false);
      return;
    }
    setStorageSpaces((data ?? []) as StorageSpaceRow[]);
    setLoadingStorageSpaces(false);
  }

  async function fetchCatalogEntries() {
    setLoadingCatalogEntries(true);
    const { data, error } = await supabase.from("product_catalog_wines").select("*").order("updated_at", { ascending: false }).limit(12);
    if (error) {
      Alert.alert("Kunde inte hämta produktkatalogen", error.message);
      setLoadingCatalogEntries(false);
      return;
    }
    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }

  async function searchCatalogWineNames(query: string, offset = 0): Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }> {
    const BATCH_SIZE = 50;
    const { data, error } = await supabase
      .from("product_catalog_wines")
      .select("name, producer")
      .ilike("name", `%${query}%`)
      .order("name", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) return { suggestions: [], hasMore: false, nextOffset: offset };
    const seen = new Set<string>();
    const results: Suggestion[] = [];
    for (const row of data ?? []) {
      const key = normalizeLookupValue(row.name) + "|" + normalizeLookupValue(row.producer ?? "");
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name: row.name, parentName: row.producer ?? null });
    }
    results.sort((a, b) => {
      const aStarts = normalizeLookupValue(a.name).startsWith(query) ? 0 : 1;
      const bStarts = normalizeLookupValue(b.name).startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });
    const rowCount = (data ?? []).length;
    return { suggestions: results, hasMore: rowCount === BATCH_SIZE, nextOffset: offset + rowCount };
  }

  async function fetchCatalogEntriesByName(name: string): Promise<ProductCatalogWineRow[]> {
    const { data, error } = await supabase
      .from("product_catalog_wines")
      .select("*")
      .ilike("name", name)
      .order("updated_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as ProductCatalogWineRow[];
  }

  async function matchCatalogByText(query: string, maxResults = 5): Promise<CatalogTextMatch[]> {
    if (query.trim().length < 3) return [];
    const { data, error } = await supabase.rpc("match_catalog_by_text", {
      query: query.trim(),
      max_results: maxResults,
    });
    if (error) return [];
    return (data ?? []) as CatalogTextMatch[];
  }

  async function fetchReferenceOptions() {
    const { data, error } = await supabase.from("reference_options").select("*").in("category", ["grape", "country", "region"]).order("category", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) {
      Alert.alert("Kunde inte hämta referensdata", error.message);
      return;
    }
    setReferenceOptions((data ?? []) as ReferenceOptionRow[]);
  }

  async function saveStorageSpace(selectedStorageSpaceId: string, setSelectedStorageSpaceId: (id: string) => void, setSelectedStorageRow: (v: string) => void, setSelectedStorageSlot: (v: string) => void) {
    if (!storageSpaceDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in namnet på förvaringsplatsen.");
      return;
    }
    const rowCount = Number(storageSpaceDraft.rowCount);
    const slotsPerRow = Number(storageSpaceDraft.slotsPerRow);
    if (!Number.isFinite(rowCount) || rowCount < 1 || !Number.isFinite(slotsPerRow) || slotsPerRow < 1) {
      Alert.alert("Ogiltiga mått", "Ange minst 1 rad och 1 plats per rad.");
      return;
    }
    setSavingStorageSpace(true);
    try {
      const payload: StorageSpaceInsert = {
        user_id: userId,
        name: storageSpaceDraft.name.trim(),
        space_type: storageSpaceDraft.spaceType.trim() || "kallare",
        row_count: rowCount,
        slots_per_row: slotsPerRow,
        notes: emptyToNull(storageSpaceDraft.notes),
      };
      const { data, error } = await supabase.from("storage_spaces").insert(payload).select("*").single();
      if (error) throw error;
      setStorageSpaceDraft(defaultStorageSpaceDraft);
      if (data?.id) {
        setSelectedStorageSpaceId(data.id);
        setSelectedStorageRow("1");
        setSelectedStorageSlot("1");
      }
      await fetchStorageSpaces();
    } catch (error) {
      Alert.alert("Kunde inte spara platsen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingStorageSpace(false);
    }
  }

  async function updateStorageSpace(id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number; notes?: string | null }) {
    const { error } = await supabase.from("storage_spaces").update(patch).eq("id", id);
    if (error) { Alert.alert("Kunde inte uppdatera platsen", error.message); return; }
    await fetchStorageSpaces();
  }

  async function deleteStorageSpace(id: string, selectedStorageSpaceId: string, setSelectedStorageSpaceId: (v: string) => void, setSelectedStorageRow: (v: string) => void, setSelectedStorageSlot: (v: string) => void, selectedStorageSpaceFilterId: string, setSelectedStorageSpaceFilterId: (v: string) => void) {
    const { error } = await supabase.from("storage_spaces").delete().eq("id", id);
    if (error) {
      Alert.alert("Kunde inte ta bort platsen", error.message);
      return;
    }
    if (selectedStorageSpaceId === id) {
      setSelectedStorageSpaceId("");
      setSelectedStorageRow("1");
      setSelectedStorageSlot("1");
    }
    if (selectedStorageSpaceFilterId === id) {
      setSelectedStorageSpaceFilterId("");
    }
    await Promise.all([fetchStorageSpaces(), fetchWines()]);
  }

  async function deleteWine(id: string, imagePath?: string | null) {
    const { error } = await supabase.from("wines").delete().eq("id", id);
    if (error) {
      Alert.alert("Kunde inte ta bort", error.message);
      return;
    }
    if (imagePath) {
      await supabase.storage.from("wine-images").remove([imagePath]);
    }
    setWines((current) => current.filter((wine) => wine.id !== id));
  }

  // --- Initial load ---

  useEffect(() => {
    void fetchWines();
    void fetchHistoryEntries();
    void fetchStorageSpaces();
    void fetchCatalogEntries();
    void fetchReferenceOptions();
  }, []);

  // --- Catalog backfill ---

  useEffect(() => {
    if (catalogBackfillDone || loading || wines.length === 0) return;
    const completeWines = wines.filter((wine) => canBeSavedAsCatalogEntry(wine));
    if (completeWines.length === 0) {
      setCatalogBackfillDone(true);
      return;
    }
    let cancelled = false;
    const runBackfill = async () => {
      for (const wine of completeWines) {
        if (cancelled) return;
        await cacheWineRecordAsCatalogEntry(wine, userId);
      }
      if (!cancelled) {
        await fetchCatalogEntries();
        setCatalogBackfillDone(true);
      }
    };
    void runBackfill();
    return () => { cancelled = true; };
  }, [catalogBackfillDone, loading, userId, wines]);

  // --- Derived data ---

  const stats = useMemo(() => buildStats(wines), [wines]);
  const storageSpaceById = useMemo(() => new Map(storageSpaces.map((space) => [space.id, space])), [storageSpaces]);
  const storageSpaceBottleCounts = useMemo(() => buildStorageSpaceBottleCounts(wines), [wines]);
  const pairingOptions = useMemo(() => buildPairingOptions(wines), [wines]);
  const countryOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.country), [wines]);
  const regionOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.region), [wines]);
  const typeOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.type), [wines]);
  const vintageOptions = useMemo(() => buildVintageOptions(wines), [wines]);

  // --- Reference rows ---

  const grapeReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((o) => o.category === "grape")),
    [referenceOptions]
  );
  const countryReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((o) => o.category === "country")),
    [referenceOptions]
  );
  const regionReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((o) => o.category === "region")),
    [referenceOptions]
  );
  const grapeOptions = useMemo(() => grapeReferenceRows.map((o) => o.name), [grapeReferenceRows]);
  const countryReferenceOptions = useMemo(() => countryReferenceRows.map((o) => o.name), [countryReferenceRows]);
  const regionReferenceOptions = useMemo(() => regionReferenceRows.map((o) => o.name), [regionReferenceRows]);

  const effectiveGrapeOptions = grapeOptions.length > 0 ? grapeOptions : GRAPE_VARIETIES;
  const effectiveCountryOptions = countryReferenceOptions.length > 0 ? countryReferenceOptions : WINE_COUNTRIES;
  const effectiveRegionOptions = regionReferenceOptions.length > 0 ? regionReferenceOptions : WINE_REGIONS;

  return {
    // Core data
    wines,
    setWines,
    historyEntries,
    storageSpaces,
    catalogEntries,
    referenceOptions,

    // Loading states
    loading,
    loadingHistory,
    loadingStorageSpaces,
    loadingCatalogEntries,

    // Fetchers
    fetchWines,
    fetchHistoryEntries,
    fetchStorageSpaces,
    fetchCatalogEntries,
    fetchReferenceOptions,

    // Catalog search (server-side, debounced by caller)
    searchCatalogWineNames,
    fetchCatalogEntriesByName,
    matchCatalogByText,

    // Storage space management
    storageSpaceDraft,
    setStorageSpaceDraft,
    savingStorageSpace,
    saveStorageSpace,
    updateStorageSpace,
    deleteStorageSpace,
    deleteWine,

    // Derived data
    stats,
    storageSpaceById,
    storageSpaceBottleCounts,
    pairingOptions,
    countryOptions,
    regionOptions,
    typeOptions,
    vintageOptions,

    // Reference rows
    grapeReferenceRows,
    countryReferenceRows,
    regionReferenceRows,

    // Effective options (with fallbacks)
    effectiveGrapeOptions,
    effectiveCountryOptions,
    effectiveRegionOptions,

    // Meal recommendations builder
    buildMealRecommendations: (meal: string) => buildMealRecommendations(wines, meal),
  };
}
