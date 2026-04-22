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

export type CellarDataValue = {
  userId: string;
  wines: WineRecord[];
  winesLoading: boolean;
  hasMoreWines: boolean;
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  historyEntries: WineHistoryRecord[];
  historyLoading: boolean;
  historyHasMore: boolean;
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  aggregate: CellarAggregate;
  aggregateLoading: boolean;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
};

export type CellarActionsValue = {
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  refreshWines: () => Promise<void | undefined>;
  fetchMoreWines: () => Promise<void>;
  deleteWine: (id: string, imagePath?: string | null) => Promise<void>;
  setStorageSpaceDraft: React.Dispatch<React.SetStateAction<StorageSpaceDraft>>;
  fetchStorageSpaces: () => Promise<void>;
  saveStorageSpace: () => Promise<string | null>;
  updateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number; notes?: string | null }) => Promise<void>;
  deleteStorageSpace: (id: string) => Promise<boolean>;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  fetchHistoryEntries: () => Promise<void>;
  fetchMoreHistory: () => Promise<void>;
  mergeReferenceOptions: (wine: WineRow) => void;
  fetchReferenceOptions: () => Promise<void>;
  searchCatalogWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  fetchCatalogEntriesByName: (name: string) => Promise<ProductCatalogWineRow[]>;
  fetchCatalogEntries: () => Promise<void>;
  matchCatalogByText: (text: string) => Promise<any>;
  refreshAggregate: () => Promise<void>;
  onCellarMutated: (opts?: { spaceIds?: Array<string | null> }) => Promise<void>;
  requestSpace: (spaceId: string) => void;
  invalidateSpace: (spaceId: string) => void;
  invalidateAllSpaceWines: () => void;
  refreshAll: () => Promise<void>;
};

export type CellarFiltersValue = ReturnType<typeof useCellarFilters>;

// Legacy union: components that haven't migrated yet pull everything via useCellar().
export type CellarContextValue = CellarDataValue & CellarActionsValue & { filters: CellarFiltersValue };

const CellarDataContext = createContext<CellarDataValue | null>(null);
const CellarActionsContext = createContext<CellarActionsValue | null>(null);
const CellarFiltersContext = createContext<CellarFiltersValue | null>(null);

export function useCellarData(): CellarDataValue {
  const v = useContext(CellarDataContext);
  if (!v) throw new Error("useCellarData must be used inside CellarProvider");
  return v;
}
export function useCellarActions(): CellarActionsValue {
  const v = useContext(CellarActionsContext);
  if (!v) throw new Error("useCellarActions must be used inside CellarProvider");
  return v;
}
export function useCellarFiltersContext(): CellarFiltersValue {
  const v = useContext(CellarFiltersContext);
  if (!v) throw new Error("useCellarFiltersContext must be used inside CellarProvider");
  return v;
}

/**
 * @deprecated Use `useCellarData`, `useCellarActions`, or `useCellarFiltersContext` instead.
 * This facade merges all three contexts so consumers re-render on any change, which defeats
 * the split. Migrate call sites incrementally. Tracking: see follow-up issue for consumer migration.
 */
export function useCellar(): CellarContextValue {
  const data = useCellarData();
  const actions = useCellarActions();
  const filters = useCellarFiltersContext();
  return useMemo(() => ({ ...data, ...actions, filters }), [data, actions, filters]);
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

  const dataValue: CellarDataValue = useMemo(() => ({
    userId,
    wines: wineData.wines,
    winesLoading: wineData.loading,
    hasMoreWines: wineData.hasMoreWines,
    storageSpaces: storageData.storageSpaces,
    storageSpaceById,
    storageSpaceDraft: storageData.storageSpaceDraft,
    savingStorageSpace: storageData.savingStorageSpace,
    historyEntries: historyData.historyEntries,
    historyLoading: historyData.loadingHistory,
    historyHasMore: historyData.hasMoreHistory,
    effectiveCountryOptions: refOptions.effectiveCountryOptions,
    effectiveRegionOptions: refOptions.effectiveRegionOptions,
    effectiveGrapeOptions: refOptions.effectiveGrapeOptions,
    countryReferenceRows: refOptions.countryReferenceRows,
    regionReferenceRows: refOptions.regionReferenceRows,
    grapeReferenceRows: refOptions.grapeReferenceRows,
    aggregate,
    aggregateLoading,
    getSpaceWines: spaceWines.getSpaceWines,
  }), [userId,
    wineData.wines, wineData.loading, wineData.hasMoreWines,
    storageData.storageSpaces, storageSpaceById, storageData.storageSpaceDraft, storageData.savingStorageSpace,
    historyData.historyEntries, historyData.loadingHistory, historyData.hasMoreHistory,
    refOptions.effectiveCountryOptions, refOptions.effectiveRegionOptions, refOptions.effectiveGrapeOptions,
    refOptions.countryReferenceRows, refOptions.regionReferenceRows, refOptions.grapeReferenceRows,
    aggregate, aggregateLoading, spaceWines.getSpaceWines]);

  const actionsValue: CellarActionsValue = useMemo(() => ({
    setWines: wineData.setWines,
    refreshWines: wineData.fetchWines,
    fetchMoreWines: wineData.fetchMoreWines,
    deleteWine: deleteWineAndMutate,
    setStorageSpaceDraft: storageData.setStorageSpaceDraft,
    fetchStorageSpaces: storageData.fetchStorageSpaces,
    saveStorageSpace: storageData.saveStorageSpace,
    updateStorageSpace: storageData.updateStorageSpace,
    deleteStorageSpace: deleteStorageSpaceAndRefresh,
    setHistoryEntries: historyData.setHistoryEntries,
    fetchHistoryEntries: historyData.fetchHistoryEntries,
    fetchMoreHistory: historyData.fetchMoreHistory,
    mergeReferenceOptions: refOptions.mergeReferenceOptions,
    fetchReferenceOptions: refOptions.fetchReferenceOptions,
    searchCatalogWineNames: catalogData.searchCatalogWineNames,
    fetchCatalogEntriesByName: catalogData.fetchCatalogEntriesByName,
    fetchCatalogEntries: catalogData.fetchCatalogEntries,
    matchCatalogByText: catalogData.matchCatalogByText,
    refreshAggregate,
    onCellarMutated,
    requestSpace: spaceWines.requestSpace,
    invalidateSpace: spaceWines.invalidateSpace,
    invalidateAllSpaceWines: spaceWines.invalidateAll,
    refreshAll,
  }), [wineData.setWines, wineData.fetchWines, wineData.fetchMoreWines, deleteWineAndMutate,
    storageData.setStorageSpaceDraft, storageData.fetchStorageSpaces, storageData.saveStorageSpace,
    storageData.updateStorageSpace, deleteStorageSpaceAndRefresh,
    historyData.setHistoryEntries, historyData.fetchHistoryEntries, historyData.fetchMoreHistory,
    refOptions.mergeReferenceOptions, refOptions.fetchReferenceOptions,
    catalogData.searchCatalogWineNames, catalogData.fetchCatalogEntriesByName,
    catalogData.fetchCatalogEntries, catalogData.matchCatalogByText,
    refreshAggregate, onCellarMutated,
    spaceWines.requestSpace, spaceWines.invalidateSpace, spaceWines.invalidateAll,
    refreshAll]);

  return (
    <CellarDataContext.Provider value={dataValue}>
      <CellarActionsContext.Provider value={actionsValue}>
        <CellarFiltersContext.Provider value={filters}>
          {children}
        </CellarFiltersContext.Provider>
      </CellarActionsContext.Provider>
    </CellarDataContext.Provider>
  );
}
