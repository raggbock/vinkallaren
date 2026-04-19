import type { WsetTastingData } from "../lib/wset-data";
import type { ReferenceOptionRow } from "./reference-data";
import type { StorageSpaceRow } from "./storage-space";
import type { StorageSpaceDraft } from "./cellar-drafts";
import type { WineRecord } from "./wine";
import type { Suggestion } from "../components/form-controls";

/** Filter values, setters, and option arrays for the cellar list. */
export type FilterProps = {
  searchQuery: string;
  selectedPairingFilter: string;
  selectedCountryFilter: string;
  selectedRegionFilter: string;
  selectedTypeFilter: string;
  selectedVintageFilter: string;
  selectedGrapeFilter: string;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  grapeOptions: string[];
  selectedStorageSpaceFilterId: string;
  onSearchChange: (value: string) => void;
  onPairingChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onVintageChange: (value: string) => void;
  onGrapeChange: (value: string) => void;
  onStorageSpaceFilterChange: (id: string) => void;
};

/** Storage space data and CRUD operations. */
export type StorageProps = {
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  onUpdateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDeleteStorageSpace: (id: string) => void;
};

/** Catalog search, reference options, and lookup state. */
export type CatalogProps = {
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  lookupBusy: boolean;
  lookupMessage: string;
};

/** Wine action callbacks (edit, drink, delete, systembolaget). */
export type WineActionsProps = {
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
  onOpenSystembolaget: (productId: string) => void;
};

/** Tasting mode state and callbacks for AddWinePanel. */
export type TastingProps = {
  tastingMode: boolean;
  onTastingModeChange: (value: boolean) => void;
  tastingRating: string;
  onTastingRatingChange: (value: string) => void;
  tastingDate: string;
  onTastingDateChange: (value: string) => void;
  onSaveTasting: () => void;
  savingTasting: boolean;
  wsetData: WsetTastingData | null;
  onOpenWset: () => void;
};
