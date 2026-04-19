import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useWines } from "../hooks/useWines";
import { useStorageSpaces } from "../hooks/useStorageSpaces";
import { useHistory } from "../hooks/useHistory";
import { useReferenceOptions } from "../hooks/useReferenceOptions";
import { useCatalog } from "../hooks/useCatalog";
import { useCellarAggregate } from "../hooks/useCellarAggregate";
import { useCellarSpaceWines, UNPLACED_SPACE_ID } from "../hooks/useCellarSpaceWines";
import { useCellarFilters } from "../hooks/useCellarFilters";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import type { WineHistoryRecord } from "../types/wine-history";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "../components/form-controls";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { WineRow } from "../types/wine";
import type { CellarAggregate } from "../types/cellar-aggregate";

export type CellarContextValue = {
  userId: string;
  // Wines
  wines: WineRecord[];
  winesLoading: boolean;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  refreshWines: () => Promise<void | undefined>;
  fetchMoreWines: () => Promise<void>;
  hasMoreWines: boolean;
  deleteWine: (id: string, imagePath?: string | null) => Promise<void>;
  // Storage
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  setStorageSpaceDraft: React.Dispatch<React.SetStateAction<StorageSpaceDraft>>;
  fetchStorageSpaces: () => Promise<void>;
  saveStorageSpace: () => Promise<string | null>;
  updateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number; notes?: string | null }) => Promise<void>;
  deleteStorageSpace: (id: string) => Promise<boolean>;
  // History
  historyEntries: WineHistoryRecord[];
  historyLoading: boolean;
  historyHasMore: boolean;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  fetchHistoryEntries: () => Promise<void>;
  fetchMoreHistory: () => Promise<void>;
  // Reference options
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  mergeReferenceOptions: (wine: WineRow) => void;
  fetchReferenceOptions: () => Promise<void>;
  // Catalog
  searchCatalogWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  fetchCatalogEntriesByName: (name: string) => Promise<ProductCatalogWineRow[]>;
  fetchCatalogEntries: () => Promise<void>;
  matchCatalogByText: (text: string) => Promise<any>;
  // Aggregate (filtered)
  aggregate: CellarAggregate;
  aggregateLoading: boolean;
  refreshAggregate: () => Promise<void>;
  onCellarMutated: (opts?: { spaceIds?: Array<string | null> }) => Promise<void>;
  // Space-wines loader (filtered)
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
  requestSpace: (spaceId: string) => void;
  invalidateSpace: (spaceId: string) => void;
  invalidateAllSpaceWines: () => void;
  // Filters
  filters: ReturnType<typeof useCellarFilters>;
  // Refresh all
  refreshAll: () => Promise<void>;
};

const CellarContext = createContext<CellarContextValue | null>(null);

export function useCellar(): CellarContextValue {
  const ctx = useContext(CellarContext);
  if (!ctx) throw new Error("useCellar must be used inside CellarProvider");
  return ctx;
}

export function CellarProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const wineData = useWines();
  const storageData = useStorageSpaces(userId);
  const historyData = useHistory();
  const refOptions = useReferenceOptions();
  const catalogData = useCatalog(userId, wineData.wines, wineData.loading);
  const filters = useCellarFilters();
  const { aggregate, loading: aggregateLoading, refresh: refreshAggregate } =
    useCellarAggregate(userId, filters.filterState, filters.searchQuery);
  const spaceWines = useCellarSpaceWines(filters.filterState, filters.searchQuery);

  const storageSpaceById = useMemo(
    () => new Map(storageData.storageSpaces.map((s) => [s.id, s])),
    [storageData.storageSpaces],
  );

  const deleteStorageSpaceAndRefresh = useCallback(async (id: string): Promise<boolean> => {
    const ok = await storageData.deleteStorageSpace(id);
    if (ok) await wineData.fetchWines();
    return ok;
  }, [storageData, wineData]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      wineData.fetchWines(),
      storageData.fetchStorageSpaces(),
      historyData.fetchHistoryEntries(),
      catalogData.fetchCatalogEntries(),
      refOptions.fetchReferenceOptions(),
    ]);
  }, [wineData.fetchWines, storageData.fetchStorageSpaces, historyData.fetchHistoryEntries, catalogData.fetchCatalogEntries, refOptions.fetchReferenceOptions]);

  const onCellarMutated = useCallback(
    async (opts: { spaceIds?: Array<string | null> } = {}) => {
      const ids = opts.spaceIds ?? [];
      if (ids.length === 0) {
        spaceWines.invalidateAll();
      } else {
        const uniqueKeys = new Set(ids.map((id) => id ?? UNPLACED_SPACE_ID));
        for (const key of uniqueKeys) spaceWines.invalidateSpace(key);
      }
      await refreshAggregate();
    },
    [spaceWines, refreshAggregate],
  );

  const deleteWineAndMutate = useCallback(async (id: string, imagePath?: string | null) => {
    const wine = wineData.wines.find((w) => w.id === id);
    await wineData.deleteWine(id, imagePath);
    await onCellarMutated({ spaceIds: [wine?.storage_space_id ?? null] });
  }, [wineData, onCellarMutated]);

  const value: CellarContextValue = useMemo(() => ({
    userId,
    // Wines
    wines: wineData.wines,
    winesLoading: wineData.loading,
    setWines: wineData.setWines,
    refreshWines: wineData.fetchWines,
    fetchMoreWines: wineData.fetchMoreWines,
    hasMoreWines: wineData.hasMoreWines,
    deleteWine: deleteWineAndMutate,
    // Storage
    storageSpaces: storageData.storageSpaces,
    storageSpaceById,
    storageSpaceDraft: storageData.storageSpaceDraft,
    savingStorageSpace: storageData.savingStorageSpace,
    setStorageSpaceDraft: storageData.setStorageSpaceDraft,
    fetchStorageSpaces: storageData.fetchStorageSpaces,
    saveStorageSpace: storageData.saveStorageSpace,
    updateStorageSpace: storageData.updateStorageSpace,
    deleteStorageSpace: deleteStorageSpaceAndRefresh,
    // History
    historyEntries: historyData.historyEntries,
    historyLoading: historyData.loadingHistory,
    historyHasMore: historyData.hasMoreHistory,
    setHistoryEntries: historyData.setHistoryEntries,
    fetchHistoryEntries: historyData.fetchHistoryEntries,
    fetchMoreHistory: historyData.fetchMoreHistory,
    // Reference options
    effectiveCountryOptions: refOptions.effectiveCountryOptions,
    effectiveRegionOptions: refOptions.effectiveRegionOptions,
    effectiveGrapeOptions: refOptions.effectiveGrapeOptions,
    countryReferenceRows: refOptions.countryReferenceRows,
    regionReferenceRows: refOptions.regionReferenceRows,
    grapeReferenceRows: refOptions.grapeReferenceRows,
    mergeReferenceOptions: refOptions.mergeReferenceOptions,
    fetchReferenceOptions: refOptions.fetchReferenceOptions,
    // Catalog
    searchCatalogWineNames: catalogData.searchCatalogWineNames,
    fetchCatalogEntriesByName: catalogData.fetchCatalogEntriesByName,
    fetchCatalogEntries: catalogData.fetchCatalogEntries,
    matchCatalogByText: catalogData.matchCatalogByText,
    onCellarMutated,
    // Aggregate (filtered)
    aggregate, aggregateLoading, refreshAggregate,
    // Space-wines loader (filtered)
    getSpaceWines: spaceWines.getSpaceWines,
    requestSpace: spaceWines.requestSpace,
    invalidateSpace: spaceWines.invalidateSpace,
    invalidateAllSpaceWines: spaceWines.invalidateAll,
    // Filters
    filters,
    // Refresh all
    refreshAll,
  }), [userId,
    wineData.wines, wineData.loading, wineData.setWines, wineData.fetchWines, wineData.fetchMoreWines,
    wineData.hasMoreWines, deleteWineAndMutate,
    storageData.storageSpaces, storageSpaceById, storageData.storageSpaceDraft, storageData.savingStorageSpace,
    storageData.setStorageSpaceDraft, storageData.fetchStorageSpaces, storageData.saveStorageSpace,
    storageData.updateStorageSpace, deleteStorageSpaceAndRefresh,
    historyData.historyEntries, historyData.loadingHistory, historyData.hasMoreHistory,
    historyData.setHistoryEntries, historyData.fetchHistoryEntries, historyData.fetchMoreHistory,
    refOptions.effectiveCountryOptions, refOptions.effectiveRegionOptions, refOptions.effectiveGrapeOptions,
    refOptions.countryReferenceRows, refOptions.regionReferenceRows, refOptions.grapeReferenceRows,
    refOptions.mergeReferenceOptions, refOptions.fetchReferenceOptions,
    catalogData.searchCatalogWineNames, catalogData.fetchCatalogEntriesByName,
    catalogData.fetchCatalogEntries, catalogData.matchCatalogByText,
    onCellarMutated,
    aggregate, aggregateLoading, refreshAggregate,
    spaceWines.getSpaceWines, spaceWines.requestSpace, spaceWines.invalidateSpace, spaceWines.invalidateAll,
    filters,
    refreshAll]);

  return <CellarContext.Provider value={value}>{children}</CellarContext.Provider>;
}

export { CellarContext };
