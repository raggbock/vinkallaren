import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useWines } from "../hooks/useWines";
import { useStorageSpaces } from "../hooks/useStorageSpaces";
import { useHistory } from "../hooks/useHistory";
import { useReferenceOptions } from "../hooks/useReferenceOptions";
import { useCatalog } from "../hooks/useCatalog";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import type { WineHistoryRecord } from "../types/wine-history";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "../components/form-controls";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { WineRow } from "../types/wine";

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
  stats: { totalBottles: number; totalLabels: number; drinkSoon: number; topCountry: string; topType: string; topPairing: string; averageVintage: string };
  storageSpaceBottleCounts: Map<string, number>;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  cellarGrapeOptions: string[];
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

  const value: CellarContextValue = useMemo(() => ({
    userId,
    // Wines
    wines: wineData.wines,
    winesLoading: wineData.loading,
    setWines: wineData.setWines,
    refreshWines: wineData.fetchWines,
    fetchMoreWines: wineData.fetchMoreWines,
    hasMoreWines: wineData.hasMoreWines,
    deleteWine: wineData.deleteWine,
    stats: wineData.stats,
    storageSpaceBottleCounts: wineData.storageSpaceBottleCounts,
    pairingOptions: wineData.pairingOptions,
    countryOptions: wineData.countryOptions,
    regionOptions: wineData.regionOptions,
    typeOptions: wineData.typeOptions,
    vintageOptions: wineData.vintageOptions,
    cellarGrapeOptions: wineData.cellarGrapeOptions,
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
    // Refresh all
    refreshAll,
  }), [userId, wineData, storageData, storageSpaceById, deleteStorageSpaceAndRefresh, historyData, refOptions, catalogData, refreshAll]);

  return <CellarContext.Provider value={value}>{children}</CellarContext.Provider>;
}

export { CellarContext };
