import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";

import { buildNumericOptions, FOOD_CATEGORIES, getWineStoragePlacementLabel, mergeTagText, parseTags } from "../lib/cellar-helpers";
import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import type { ProductCatalogEntry } from "../lib/product-catalog";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { ImportFieldSelection, ImportMode, StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import { AutocompleteInput, DateInput, DoubleRow, GroupedSuggestionRow, ImportSelectionRow, LabeledInput, StorageSpaceForm, StorageSpaceSelector, SuggestionRow, type Suggestion } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;
const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

export function AddWinePanel({
  styles, draft, storageSpaces, selectedStorageSpace, selectedStorageSpaceId,
  selectedStorageRow, selectedStorageSlot, storageSpaceById, occupiedPositions,
  storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace,
  searchWineNames, effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
  countryReferenceRows, regionReferenceRows, grapeReferenceRows,
  lookupBusy, lookupMessage, catalogSuggestion, selectedCatalogNameEntry,
  importMode, importSelection, saving,
  onDraftChange, onNameSelected, onBarcodeChange, onArticleNumberChange,
  onStorageSpaceChange, onStorageRowChange, onStorageSlotChange,
  onStartBarcodeScanner, onOpenSystembolaget, onSetImportMode, onApplyCatalogSuggestion,
  onToggleImportField, onChooseImage, onTakePhoto, onSaveWine,
  tastingMode, onTastingModeChange, tastingRating, onTastingRatingChange,
  tastingDate, onTastingDateChange, onSaveTasting, savingTasting,
  wsetData, onOpenWset,
}: {
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
}) {
  const isLockedByCatalog = (field: keyof ProductCatalogWineRow) => {
    if (!selectedCatalogNameEntry) return false;
    const value = selectedCatalogNameEntry[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== "";
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Lägg till vin</Text>

      <SuggestionRow
        title="Läge"
        options={["Källare", "Vinprovning"]}
        selected={tastingMode ? "Vinprovning" : "Källare"}
        onSelect={(value) => onTastingModeChange(value === "Vinprovning")}
      />
      {tastingMode ? <Text style={styles.notesText}>Vinet sparas direkt i din historik — det läggs inte till i källaren.</Text> : null}

      <View style={styles.importSuggestionCard}>
        <Text style={styles.inputLabel}>Snabbimport</Text>
        {!draft.name.trim() ? (
          <>
            <Text style={styles.notesText}>Har du flaskan? Skanna streckkoden för att fylla i automatiskt.</Text>
            <Pressable onPress={onStartBarcodeScanner} style={[styles.primaryButton, { marginBottom: 12 }]}>
              <Text style={styles.primaryButtonText}>Skanna streckkod</Text>
            </Pressable>
            <Text style={styles.notesText}>Eller fyll i streckkod / artikelnummer manuellt:</Text>
          </>
        ) : (
          <>
            <Text style={styles.notesText}>Har du en streckkod eller ett Systembolaget-artikelnummer? Fyll i det så försöker vi hämta resten automatiskt.</Text>
            <Pressable onPress={onStartBarcodeScanner} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Skanna streckkod</Text>
            </Pressable>
          </>
        )}
        <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={onBarcodeChange} editable={!isLockedByCatalog("barcode")} />
        <LabeledInput label="Systembolaget artikelnummer" value={draft.systembolagetProductId} onChangeText={onArticleNumberChange} placeholder="t.ex. 12345" editable={!isLockedByCatalog("systembolaget_product_id")} />
      </View>

      {lookupBusy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
          <ActivityIndicator size="small" color="#6f1d1b" />
          <Text style={styles.notesText}>Söker efter produktdata...</Text>
        </View>
      ) : null}
      {!lookupBusy && lookupMessage ? <Text style={styles.notesText}>{lookupMessage}</Text> : null}

      {draft.systembolagetProductId ? (
        <Pressable onPress={() => onOpenSystembolaget(draft.systembolagetProductId)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Öppna hos Systembolaget</Text>
        </Pressable>
      ) : null}

      {catalogSuggestion ? (
        <CatalogImportCard
          styles={styles} catalogSuggestion={catalogSuggestion} importMode={importMode} importSelection={importSelection}
          onSetImportMode={onSetImportMode} onApplyCatalogSuggestion={onApplyCatalogSuggestion} onToggleImportField={onToggleImportField}
        />
      ) : null}

      {!catalogSuggestion && (draft.barcode.trim() || draft.systembolagetProductId.trim()) ? (
        <View style={styles.importSuggestionCard}>
          <Text style={styles.inputLabel}>Ingen träff ännu?</Text>
          <Text style={styles.notesText}>Fyll i resten av uppgifterna och spara som vanligt.</Text>
        </View>
      ) : null}

      <AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} onOptionSelected={onNameSelected} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
      <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onDraftChange({ producer: value })} editable={!isLockedByCatalog("producer")} />
      <DoubleRow>
        <AutocompleteInput label="Land" value={draft.country} onChangeText={(value) => onDraftChange({ country: value })} options={effectiveCountryOptions} optionRows={countryReferenceRows} placeholder="Skriv t.ex. fr eller it" editable={!isLockedByCatalog("country")} />
        <AutocompleteInput label="Region" value={draft.region} onChangeText={(value) => onDraftChange({ region: value })} options={effectiveRegionOptions} optionRows={regionReferenceRows} placeholder="Skriv t.ex. bor, rio, nap..." editable={!isLockedByCatalog("region")} />
      </DoubleRow>
      <AutocompleteInput label="Druva" value={draft.grape} onChangeText={(value) => onDraftChange({ grape: value })} options={effectiveGrapeOptions} optionRows={grapeReferenceRows} placeholder="Nebbiolo, Chardonnay..." editable={!isLockedByCatalog("grape")} />
      {tastingMode ? (
        <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
      ) : (
        <DoubleRow>
          <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
          <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
        </DoubleRow>
      )}
      <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onDraftChange({ type: value })} disabled={isLockedByCatalog("type")} />

      {tastingMode ? (
        <TastingFields styles={styles} draft={draft} tastingDate={tastingDate} tastingRating={tastingRating} wsetData={wsetData} onDraftChange={onDraftChange} onTastingDateChange={onTastingDateChange} onTastingRatingChange={onTastingRatingChange} onOpenWset={onOpenWset} />
      ) : (
        <CellarFields
          styles={styles} draft={draft} storageSpaces={storageSpaces} selectedStorageSpace={selectedStorageSpace}
          selectedStorageSpaceId={selectedStorageSpaceId} selectedStorageRow={selectedStorageRow} selectedStorageSlot={selectedStorageSlot}
          storageSpaceById={storageSpaceById} occupiedPositions={occupiedPositions} storageSpaceDraft={storageSpaceDraft}
          savingStorageSpace={savingStorageSpace} onStorageSpaceDraftChange={onStorageSpaceDraftChange} onSaveStorageSpace={onSaveStorageSpace}
          onDraftChange={onDraftChange} onStorageSpaceChange={onStorageSpaceChange} onStorageRowChange={onStorageRowChange} onStorageSlotChange={onStorageSlotChange}
        />
      )}

      <View style={styles.imageButtonRow}>
        <Pressable onPress={onTakePhoto} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Ta foto av etiketten</Text>
        </Pressable>
        <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{draft.imageUri ? "Byt bild" : "Välj flaskbild"}</Text>
        </Pressable>
      </View>
      {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={styles.wineImage} resizeMode="contain" /> : null}

      {tastingMode ? (
        <Pressable onPress={onSaveTasting} style={styles.primaryButton} disabled={savingTasting}>
          <Text style={styles.primaryButtonText}>{savingTasting ? "Sparar..." : "Spara i historik"}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onSaveWine} style={styles.primaryButton} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara i källaren"}</Text>
        </Pressable>
      )}
    </View>
  );
}

// --- Sub-sections extracted to keep AddWinePanel under 50 lines of logic ---

function CatalogImportCard({ styles, catalogSuggestion, importMode, importSelection, onSetImportMode, onApplyCatalogSuggestion, onToggleImportField }: {
  styles: SharedStyles; catalogSuggestion: ProductCatalogEntry; importMode: ImportMode; importSelection: ImportFieldSelection;
  onSetImportMode: (mode: ImportMode) => void; onApplyCatalogSuggestion: (mode: ImportMode) => void; onToggleImportField: (field: keyof ImportFieldSelection) => void;
}) {
  return (
    <View style={styles.importSuggestionCard}>
      <Text style={styles.inputLabel}>Importförslag</Text>
      <Text style={styles.recommendationName}>{catalogSuggestion.name}</Text>
      <Text style={styles.linkText}>{catalogSuggestion.sourceLabel}</Text>
      <Text style={styles.notesText}>{[catalogSuggestion.producer, catalogSuggestion.country, catalogSuggestion.region].filter(Boolean).join(" • ")}</Text>
      <View style={styles.importModeRow}>
        <Pressable onPress={() => { onSetImportMode("all"); onApplyCatalogSuggestion("all"); }} style={[styles.quickImportButton, importMode === "all" && styles.quickImportButtonActive]}>
          <Text style={[styles.quickImportText, importMode === "all" && styles.quickImportTextActive]}>Importera allt</Text>
        </Pressable>
        <Pressable onPress={() => { onSetImportMode("empty"); onApplyCatalogSuggestion("empty"); }} style={[styles.quickImportButton, importMode === "empty" && styles.quickImportButtonActive]}>
          <Text style={[styles.quickImportText, importMode === "empty" && styles.quickImportTextActive]}>Bara tomma fält</Text>
        </Pressable>
        <Pressable onPress={() => onSetImportMode("custom")} style={[styles.quickImportButton, importMode === "custom" && styles.quickImportButtonActive]}>
          <Text style={[styles.quickImportText, importMode === "custom" && styles.quickImportTextActive]}>Välj själv</Text>
        </Pressable>
      </View>
      {importMode === "custom" ? (
        <>
          <ImportSelectionRow label="Namn" selected={importSelection.name} onToggle={() => onToggleImportField("name")} />
          <ImportSelectionRow label="Producent" selected={importSelection.producer} onToggle={() => onToggleImportField("producer")} />
          <ImportSelectionRow label="Land" selected={importSelection.country} onToggle={() => onToggleImportField("country")} />
          <ImportSelectionRow label="Region" selected={importSelection.region} onToggle={() => onToggleImportField("region")} />
          <ImportSelectionRow label="Årgång" selected={importSelection.vintage} onToggle={() => onToggleImportField("vintage")} />
          <ImportSelectionRow label="Druva" selected={importSelection.grape} onToggle={() => onToggleImportField("grape")} />
          <ImportSelectionRow label="Typ" selected={importSelection.type} onToggle={() => onToggleImportField("type")} />
          <ImportSelectionRow label="Matmatchning" selected={importSelection.foodPairings} onToggle={() => onToggleImportField("foodPairings")} />
          <ImportSelectionRow label="Artikelnummer" selected={importSelection.systembolagetProductId} onToggle={() => onToggleImportField("systembolagetProductId")} />
          <ImportSelectionRow label="Streckkod" selected={importSelection.barcode} onToggle={() => onToggleImportField("barcode")} />
          <Pressable onPress={() => onApplyCatalogSuggestion("custom")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Fyll i från förslag</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function TastingFields({ styles, draft, tastingDate, tastingRating, wsetData, onDraftChange, onTastingDateChange, onTastingRatingChange, onOpenWset }: {
  styles: SharedStyles; draft: WineDraft; tastingDate: string; tastingRating: string; wsetData: WsetTastingData | null;
  onDraftChange: (patch: Partial<WineDraft>) => void; onTastingDateChange: (v: string) => void; onTastingRatingChange: (v: string) => void; onOpenWset: () => void;
}) {
  return (
    <>
      <DateInput label="Provningsdatum" value={tastingDate} onChangeText={onTastingDateChange} />
      {wsetData ? (
        <Pressable onPress={onOpenWset} style={styles.importSuggestionCard}>
          <Text style={styles.inputLabel}>WSET Tasting</Text>
          <Text style={styles.notesText}>{buildWsetSummary(wsetData)}</Text>
          <Text style={styles.linkText}>Edit</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onOpenWset} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>WSET Tasting</Text>
        </Pressable>
      )}
      <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={tastingRating} onSelect={onTastingRatingChange} />
      <LabeledInput label="Smaknotering" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} placeholder="t.ex. mörk frukt, bra syra, gärna igen" multiline />
    </>
  );
}

function CellarFields({ styles, draft, storageSpaces, selectedStorageSpace, selectedStorageSpaceId, selectedStorageRow, selectedStorageSlot, storageSpaceById, occupiedPositions, storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace, onDraftChange, onStorageSpaceChange, onStorageRowChange, onStorageSlotChange }: {
  styles: SharedStyles; draft: WineDraft; storageSpaces: StorageSpaceRow[]; selectedStorageSpace?: StorageSpaceRow | null;
  selectedStorageSpaceId: string; selectedStorageRow: string; selectedStorageSlot: string;
  storageSpaceById: Map<string, StorageSpaceRow>; occupiedPositions: { occupiedRows: Set<string>; occupiedSlots: Set<string> };
  storageSpaceDraft: StorageSpaceDraft; savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void; onSaveStorageSpace: () => void;
  onDraftChange: (patch: Partial<WineDraft>) => void; onStorageSpaceChange: (id: string) => void; onStorageRowChange: (v: string) => void; onStorageSlotChange: (v: string) => void;
}) {
  return (
    <>
      <DoubleRow>
        <LabeledInput label="Drick senast (år)" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" placeholder="t.ex. 2028" />
        <DateInput label="Inköpt" value={draft.acquiredAt} onChangeText={(value) => onDraftChange({ acquiredAt: value })} />
      </DoubleRow>
      <GroupedSuggestionRow title="Matförslag" groups={FOOD_CATEGORIES} selected={parseTags(draft.foodPairings)} onSelect={(pairing) => onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, pairing) })} />
      <LabeledInput label="Passar till" value={draft.foodPairings} onChangeText={(value) => onDraftChange({ foodPairings: value })} placeholder="lamm, ost, svamp, fisk" />
      <View style={styles.foodSection}>
        <Text style={styles.inputLabel}>Förvaringsplats</Text>
        {storageSpaces.length > 0 ? (
          <>
            <StorageSpaceSelector title="" spaces={storageSpaces} selectedId={selectedStorageSpaceId} onSelect={onStorageSpaceChange} clearLabel="Ingen plats" />
            {selectedStorageSpace && selectedStorageSpace.row_count > 0 ? (
              <>
                <SuggestionRow title="Rad" options={buildNumericOptions(selectedStorageSpace.row_count)} selected={selectedStorageRow} onSelect={onStorageRowChange} disabledOptions={occupiedPositions.occupiedRows} />
                <SuggestionRow title="Plats" options={buildNumericOptions(selectedStorageSpace.slots_per_row)} selected={selectedStorageSlot} onSelect={onStorageSlotChange} disabledOptions={occupiedPositions.occupiedSlots} />
                <Text style={styles.notesText}>Vald placering: {getWineStoragePlacementLabel({ storage_space_id: selectedStorageSpaceId, storage_row: Number(selectedStorageRow), storage_slot: Number(selectedStorageSlot) }, storageSpaceById)}</Text>
              </>
            ) : null}
          </>
        ) : (
          <Text style={styles.notesText}>Skapa en förvaringsplats för att kunna välja rad och plats.</Text>
        )}
        <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />
      </View>
      <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} placeholder="t.ex. längst bak, överst i kylen" />
      <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => onDraftChange({ tags: value })} placeholder="middag, present, lagring" />
      <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} multiline />
    </>
  );
}
