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
  scoreCatalogCompleteness,
  toWineNameReferenceRows,
} from "../lib/wine-helpers";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import { defaultStorageSpaceDraft } from "../types/cellar-drafts";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceInsert, StorageSpaceRow } from "../types/storage-space";
import type { WineHistoryRecord, WineHistoryRow } from "../types/wine-history";
import type { WineRecord, WineRow } from "../types/wine";

export function useCellarData(userId: string) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [historyEntries, setHistoryEntries] = useState<WineHistoryRecord[]>([]);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceRow[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [catalogNameEntries, setCatalogNameEntries] = useState<ProductCatalogWineRow[]>([]);
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

  async function fetchCatalogNameEntries() {
    const allEntries: ProductCatalogWineRow[] = [];
    let offset = 0;
    const pageSize = 5000;
    while (true) {
      const { data, error } = await supabase.from("product_catalog_wines").select("*").order("name", { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) return;
      allEntries.push(...(data as ProductCatalogWineRow[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }
    setCatalogNameEntries(allEntries);
  }

  async function fetchReferenceOptions() {
    const { data, error } = await supabase.from("reference_options").select("*").in("category", ["grape", "country", "region"]).order("category", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) return;
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
    void fetchCatalogNameEntries();
    void fetchReferenceOptions();
  }, []);

  // --- Catalog backfill ---

  useEffect(() => {
    if (catalogBackfillDone || wines.length === 0) return;
    const completeWines = wines.filter((wine) => canBeSavedAsCatalogEntry(wine));
    if (completeWines.length === 0) {
      setCatalogBackfillDone(true);
      return;
    }
    const runBackfill = async () => {
      for (const wine of completeWines) {
        const alreadyKnown = catalogNameEntries.some(
          (entry) =>
            normalizeLookupValue(entry.name) === normalizeLookupValue(wine.name) &&
            normalizeLookupValue(entry.producer ?? "") === normalizeLookupValue(wine.producer ?? "")
        );
        if (alreadyKnown) continue;
        await cacheWineRecordAsCatalogEntry(wine, userId);
      }
      await Promise.all([fetchCatalogEntries(), fetchCatalogNameEntries()]);
      setCatalogBackfillDone(true);
    };
    void runBackfill();
  }, [catalogBackfillDone, catalogNameEntries, userId, wines]);

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
  const catalogWineNameReferenceRows = useMemo(() => {
    const bestByName = new Map<string, ProductCatalogWineRow>();
    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = bestByName.get(key);
      if (!existing || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(existing)) {
        bestByName.set(key, entry);
      }
    }
    return toWineNameReferenceRows([...bestByName.values()], "catalog-wine-name");
  }, [catalogNameEntries]);
  const wineNameReferenceRows = useMemo(
    () => mergeReferenceRows([...catalogWineNameReferenceRows]),
    [catalogWineNameReferenceRows]
  );
  const catalogNameEntryByName = useMemo(() => {
    const map = new Map<string, ProductCatalogWineRow>();
    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = map.get(key);
      if (!existing || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(existing)) {
        map.set(key, entry);
      }
    }
    return map;
  }, [catalogNameEntries]);
  const catalogEntriesByName = useMemo(() => {
    const map = new Map<string, ProductCatalogWineRow[]>();
    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }
    return map;
  }, [catalogNameEntries]);

  const grapeOptions = useMemo(() => grapeReferenceRows.map((o) => o.name), [grapeReferenceRows]);
  const wineNameOptions = useMemo(() => wineNameReferenceRows.map((o) => o.name), [wineNameReferenceRows]);
  const countryReferenceOptions = useMemo(() => countryReferenceRows.map((o) => o.name), [countryReferenceRows]);
  const regionReferenceOptions = useMemo(() => regionReferenceRows.map((o) => o.name), [regionReferenceRows]);

  const effectiveGrapeOptions = grapeOptions.length > 0 ? grapeOptions : GRAPE_VARIETIES;
  const effectiveWineNameOptions = wineNameOptions;
  const effectiveWineNameReferenceRows = wineNameReferenceRows;
  const effectiveCountryOptions = countryReferenceOptions.length > 0 ? countryReferenceOptions : WINE_COUNTRIES;
  const effectiveRegionOptions = regionReferenceOptions.length > 0 ? regionReferenceOptions : WINE_REGIONS;

  return {
    // Core data
    wines,
    setWines,
    historyEntries,
    storageSpaces,
    catalogEntries,
    catalogNameEntries,
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
    fetchCatalogNameEntries,
    fetchReferenceOptions,

    // Storage space management
    storageSpaceDraft,
    setStorageSpaceDraft,
    savingStorageSpace,
    saveStorageSpace,
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
    wineNameReferenceRows,
    catalogNameEntryByName,
    catalogEntriesByName,

    // Effective options (with fallbacks)
    effectiveGrapeOptions,
    effectiveWineNameOptions,
    effectiveWineNameReferenceRows,
    effectiveCountryOptions,
    effectiveRegionOptions,

    // Meal recommendations builder
    buildMealRecommendations: (meal: string) => buildMealRecommendations(wines, meal),
  };
}
