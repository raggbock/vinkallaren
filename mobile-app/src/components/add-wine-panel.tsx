import { Dimensions, Platform, Pressable, Text, View } from "react-native";

import type { ProductCatalogEntry } from "../lib/product-catalog";
import type { WsetTastingData } from "../lib/wset-data";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { ImportFieldSelection, ImportMode, StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import { PanelHeader, SuggestionRow, type Suggestion } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";
import { QuickImportSection } from "./quick-import-section";
import { CatalogImportCard } from "./catalog-import-card";
import { WineCoreFields } from "./wine-core-fields";
import { TastingFields } from "./tasting-fields";
import { CellarFields } from "./cellar-fields";
import { ImagePickerSection } from "./image-picker-section";

type SharedStyles = typeof themeStyles;

export function AddWinePanel(props: AddWinePanelProps) {
  const { styles, draft, tastingMode, saving, savingTasting, onTastingModeChange, onSaveWine, onSaveTasting } = props;
  const isDesktopWeb = Platform.OS === "web" && Dimensions.get("window").width > 768;

  return (
    <View style={styles.panel}>
      <PanelHeader title="Lägg till vin" />
      <SuggestionRow title="Läge" options={["Källare", "Vinprovning"]} selected={tastingMode ? "Vinprovning" : "Källare"} onSelect={(value) => onTastingModeChange(value === "Vinprovning")} />
      {tastingMode ? <Text style={styles.notesText}>Vinet sparas direkt i din historik — det läggs inte till i källaren.</Text> : null}

      <QuickImportSection styles={styles} draft={draft} isDesktopWeb={isDesktopWeb} lookupBusy={props.lookupBusy} lookupMessage={props.lookupMessage} selectedCatalogNameEntry={props.selectedCatalogNameEntry} onBarcodeChange={props.onBarcodeChange} onArticleNumberChange={props.onArticleNumberChange} onStartBarcodeScanner={props.onStartBarcodeScanner} onScanLabel={props.onScanLabel} onOpenSystembolaget={props.onOpenSystembolaget} />

      {props.catalogSuggestion ? (
        <CatalogImportCard styles={styles} catalogSuggestion={props.catalogSuggestion} importMode={props.importMode} importSelection={props.importSelection} onSetImportMode={props.onSetImportMode} onApplyCatalogSuggestion={props.onApplyCatalogSuggestion} onToggleImportField={props.onToggleImportField} />
      ) : null}
      <NoMatchFallback styles={styles} draft={draft} catalogSuggestion={props.catalogSuggestion} />

      <WineCoreFields draft={draft} tastingMode={tastingMode} selectedCatalogNameEntry={props.selectedCatalogNameEntry} effectiveCountryOptions={props.effectiveCountryOptions} effectiveRegionOptions={props.effectiveRegionOptions} effectiveGrapeOptions={props.effectiveGrapeOptions} countryReferenceRows={props.countryReferenceRows} regionReferenceRows={props.regionReferenceRows} grapeReferenceRows={props.grapeReferenceRows} searchWineNames={props.searchWineNames} onDraftChange={props.onDraftChange} onNameSelected={props.onNameSelected} />

      {tastingMode ? (
        <TastingFields styles={styles} draft={draft} tastingDate={props.tastingDate} tastingRating={props.tastingRating} wsetData={props.wsetData} onDraftChange={props.onDraftChange} onTastingDateChange={props.onTastingDateChange} onTastingRatingChange={props.onTastingRatingChange} onOpenWset={props.onOpenWset} />
      ) : (
        <CellarFields styles={styles} draft={draft} storageSpaces={props.storageSpaces} selectedStorageSpace={props.selectedStorageSpace} selectedStorageSpaceId={props.selectedStorageSpaceId} selectedStorageRow={props.selectedStorageRow} selectedStorageSlot={props.selectedStorageSlot} storageSpaceById={props.storageSpaceById} occupiedPositions={props.occupiedPositions} storageSpaceDraft={props.storageSpaceDraft} savingStorageSpace={props.savingStorageSpace} onStorageSpaceDraftChange={props.onStorageSpaceDraftChange} onSaveStorageSpace={props.onSaveStorageSpace} onDraftChange={props.onDraftChange} onStorageSpaceChange={props.onStorageSpaceChange} onStorageRowChange={props.onStorageRowChange} onStorageSlotChange={props.onStorageSlotChange} />
      )}

      <ImagePickerSection styles={styles} imageUri={draft.imageUri} isDesktopWeb={isDesktopWeb} onChooseImage={props.onChooseImage} onTakePhoto={props.onTakePhoto} />

      <Pressable onPress={tastingMode ? onSaveTasting : onSaveWine} style={styles.primaryButton} disabled={tastingMode ? savingTasting : saving}>
        <Text style={styles.primaryButtonText}>{tastingMode ? (savingTasting ? "Sparar..." : "Spara i historik") : (saving ? "Sparar..." : "Spara i källaren")}</Text>
      </Pressable>
    </View>
  );
}

function NoMatchFallback({ styles, draft, catalogSuggestion }: { styles: SharedStyles; draft: WineDraft; catalogSuggestion: ProductCatalogEntry | null }) {
  if (catalogSuggestion || (!draft.barcode.trim() && !draft.systembolagetProductId.trim())) return null;
  return (
    <View style={styles.importSuggestionCard}>
      <Text style={styles.inputLabel}>Ingen träff ännu?</Text>
      <Text style={styles.notesText}>Fyll i resten av uppgifterna och spara som vanligt.</Text>
    </View>
  );
}

export interface AddWinePanelProps {
  styles: SharedStyles;
  draft: WineDraft;
  storageSpaces: StorageSpaceRow[];
  selectedStorageSpace?: StorageSpaceRow | null;
  selectedStorageSpaceId: string;
  selectedStorageRow: string;
  selectedStorageSlot: string;
  storageSpaceById: Map<string, StorageSpaceRow>;
  occupiedPositions: { occupiedRows: Set<string>; occupiedSlots: Set<string> };
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  lookupBusy: boolean;
  lookupMessage: string;
  catalogSuggestion: ProductCatalogEntry | null;
  selectedCatalogNameEntry: ProductCatalogWineRow | null;
  importMode: ImportMode;
  importSelection: ImportFieldSelection;
  saving: boolean;
  onDraftChange: (patch: Partial<WineDraft>) => void;
  onNameSelected: (value: string, producer?: string | null) => void;
  onBarcodeChange: (value: string) => void;
  onArticleNumberChange: (value: string) => void;
  onStorageSpaceChange: (spaceId: string) => void;
  onStorageRowChange: (value: string) => void;
  onStorageSlotChange: (value: string) => void;
  onStartBarcodeScanner: () => void;
  onScanLabel: () => void;
  onOpenSystembolaget: (productId: string) => void;
  onSetImportMode: (mode: ImportMode) => void;
  onApplyCatalogSuggestion: (mode: ImportMode) => void;
  onToggleImportField: (field: keyof ImportFieldSelection) => void;
  onChooseImage: () => void;
  onTakePhoto: () => void;
  onSaveWine: () => void;
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
}
