import { CameraView } from "expo-camera";
import { Image, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { buildNumericOptions, getSuggestedPairings, getWineStoragePlacementLabel, mergeTagText, parseTags } from "../lib/cellar-helpers";
import type { ProductCatalogEntry } from "../lib/product-catalog";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { CatalogEditorDraft, ImportFieldSelection, ImportMode, WineDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import { AutocompleteInput, DoubleRow, ImportSelectionRow, LabeledInput, StorageSpaceSelector, SuggestionRow } from "./form-controls";

type SharedStyles = any;
const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

export function BarcodeScannerModal({
  visible,
  styles,
  onClose,
  onBarcodeScanned,
}: {
  visible: boolean;
  styles: SharedStyles;
  onClose: () => void;
  onBarcodeScanned: (event: { data: string }) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Streckkodsskanning</Text>
            <Text style={styles.scannerTitle}>Rikta kameran mot etiketten</Text>
          </View>
          <Pressable onPress={onClose}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <View style={styles.scannerFrame}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
            }}
            onBarcodeScanned={onBarcodeScanned}
          />
        </View>

        <Text style={styles.scannerHint}>Om koden redan finns i din källare fyller appen i relevanta fält automatiskt.</Text>
      </SafeAreaView>
    </Modal>
  );
}

export function CatalogEditorModal({
  visible,
  styles,
  draft,
  saving,
  effectiveWineNameOptions,
  effectiveCountryOptions,
  effectiveRegionOptions,
  effectiveGrapeOptions,
  wineNameReferenceRows,
  countryReferenceRows,
  regionReferenceRows,
  grapeReferenceRows,
  onClose,
  onSave,
  onChange,
}: {
  visible: boolean;
  styles: SharedStyles;
  draft: CatalogEditorDraft | null;
  saving: boolean;
  effectiveWineNameOptions: string[];
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  wineNameReferenceRows: ReferenceOptionRow[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  onClose: () => void;
  onSave: () => void;
  onChange: (patch: Partial<CatalogEditorDraft>) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Produktkatalog</Text>
            <Text style={styles.scannerTitle}>Redigera produkt</Text>
          </View>
          <Pressable onPress={onClose} disabled={saving}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.catalogEditorContent} keyboardShouldPersistTaps="handled">
          {draft ? (
            <>
              <AutocompleteInput
                label="Namn"
                value={draft.name}
                onChangeText={(value) => onChange({ name: value })}
                options={effectiveWineNameOptions}
                optionRows={wineNameReferenceRows}
                placeholder="Skriv minst 4 bokstäver"
                minimumQueryLength={4}
              />
              <DoubleRow>
                <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={(value) => onChange({ barcode: value })} />
                <LabeledInput
                  label="Artikelnummer"
                  value={draft.systembolagetProductId}
                  onChangeText={(value) => onChange({ systembolagetProductId: value })}
                />
              </DoubleRow>
              <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onChange({ producer: value })} />
              <DoubleRow>
                <AutocompleteInput
                  label="Land"
                  value={draft.country}
                  onChangeText={(value) => onChange({ country: value })}
                  options={effectiveCountryOptions}
                  optionRows={countryReferenceRows}
                />
                <AutocompleteInput
                  label="Region"
                  value={draft.region}
                  onChangeText={(value) => onChange({ region: value })}
                  options={effectiveRegionOptions}
                  optionRows={regionReferenceRows}
                />
              </DoubleRow>
              <DoubleRow>
                <AutocompleteInput
                  label="Druva"
                  value={draft.grape}
                  onChangeText={(value) => onChange({ grape: value })}
                  options={effectiveGrapeOptions}
                  optionRows={grapeReferenceRows}
                />
                <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onChange({ vintage: value })} keyboardType="number-pad" />
              </DoubleRow>
              <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onChange({ type: value })} />
              <LabeledInput
                label="Matmatchning"
                value={draft.foodPairings}
                onChangeText={(value) => onChange({ foodPairings: value })}
                placeholder="lamm, fisk, ost"
              />
              <LabeledInput label="Källmärkning" value={draft.sourceLabel} onChangeText={(value) => onChange({ sourceLabel: value })} />
              <LabeledInput
                label="Kvalitetsnivå"
                value={draft.sourceConfidence}
                onChangeText={(value) => onChange({ sourceConfidence: value })}
                placeholder="high, medium, low"
              />
              <View style={styles.modalActionRow}>
                <Pressable onPress={onClose} style={styles.secondaryButton} disabled={saving}>
                  <Text style={styles.secondaryButtonText}>Avbryt</Text>
                </Pressable>
                <Pressable onPress={onSave} style={styles.primaryButton} disabled={saving}>
                  <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara ändringar"}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function VintagePickerModal({
  visible,
  wineName,
  vintages,
  onSelectVintage,
  onAddNew,
  onClose,
  styles,
}: {
  visible: boolean;
  wineName: string;
  vintages: { year: string; entry: ProductCatalogWineRow }[];
  onSelectVintage: (entry: ProductCatalogWineRow) => void;
  onAddNew: () => void;
  onClose: () => void;
  styles: SharedStyles;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "80%", maxHeight: "60%" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>{wineName}</Text>
          <Text style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>Välj årtal:</Text>
          <ScrollView>
            {vintages.map(({ year, entry }) => (
              <Pressable
                key={entry.id}
                onPress={() => onSelectVintage(entry)}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }}
              >
                <Text style={{ fontSize: 16 }}>{year}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={onAddNew}
            style={{ marginTop: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: 8 }}
          >
            <Text style={{ fontSize: 16, color: "#333" }}>Lägg till nytt</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function AddWinePanel({
  styles,
  draft,
  storageSpaces,
  selectedStorageSpace,
  selectedStorageSpaceId,
  selectedStorageRow,
  selectedStorageSlot,
  storageSpaceById,
  effectiveWineNameOptions,
  effectiveCountryOptions,
  effectiveRegionOptions,
  effectiveGrapeOptions,
  wineNameReferenceRows,
  countryReferenceRows,
  regionReferenceRows,
  grapeReferenceRows,
  lookupBusy,
  lookupMessage,
  catalogSuggestion,
  selectedCatalogNameEntry,
  importMode,
  importSelection,
  saving,
  onDraftChange,
  onNameSelected,
  onBarcodeChange,
  onArticleNumberChange,
  onStorageSpaceChange,
  onStorageRowChange,
  onStorageSlotChange,
  onStartBarcodeScanner,
  onOpenSystembolaget,
  onSetImportMode,
  onApplyCatalogSuggestion,
  onToggleImportField,
  onChooseImage,
  onSaveWine,
}: {
  styles: SharedStyles;
  draft: WineDraft;
  storageSpaces: StorageSpaceRow[];
  selectedStorageSpace?: StorageSpaceRow | null;
  selectedStorageSpaceId: string;
  selectedStorageRow: string;
  selectedStorageSlot: string;
  storageSpaceById: Map<string, StorageSpaceRow>;
  effectiveWineNameOptions: string[];
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  wineNameReferenceRows: ReferenceOptionRow[];
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
  onNameSelected: (value: string) => void;
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
  onSaveWine: () => void;
}) {
  const isLockedByCatalog = (field: keyof ProductCatalogWineRow) => {
    if (!selectedCatalogNameEntry) {
      return false;
    }

    const value = selectedCatalogNameEntry[field];

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== null && value !== "";
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Lägg till vin</Text>

      {/* --- Barcode & SB article number at top --- */}
      <View style={styles.importSuggestionCard}>
        <Text style={styles.inputLabel}>Snabbimport</Text>
        <Text style={styles.notesText}>
          Har du en streckkod eller ett Systembolaget-artikelnummer? Fyll i det så försöker vi hämta resten automatiskt.
        </Text>
        <LabeledInput
          label="Streckkod"
          value={draft.barcode}
          onChangeText={onBarcodeChange}
          editable={!isLockedByCatalog("barcode")}
        />
        <Pressable onPress={onStartBarcodeScanner} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Skanna streckkod</Text>
        </Pressable>
        <LabeledInput
          label="Systembolaget artikelnummer"
          value={draft.systembolagetProductId}
          onChangeText={onArticleNumberChange}
          placeholder="t.ex. 12345"
          editable={!isLockedByCatalog("systembolaget_product_id")}
        />
      </View>

      {lookupBusy ? <Text style={styles.notesText}>Söker produktmatch...</Text> : null}
      {!lookupBusy && lookupMessage ? <Text style={styles.notesText}>{lookupMessage}</Text> : null}

      {draft.systembolagetProductId ? (
        <Pressable onPress={() => onOpenSystembolaget(draft.systembolagetProductId)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Öppna hos Systembolaget</Text>
        </Pressable>
      ) : null}

      {catalogSuggestion ? (
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
      ) : null}

      {!catalogSuggestion && (draft.barcode.trim() || draft.systembolagetProductId.trim()) ? (
        <View style={styles.importSuggestionCard}>
          <Text style={styles.inputLabel}>Ingen träff ännu?</Text>
          <Text style={styles.notesText}>
            Fyll i resten av uppgifterna och spara som vanligt. Lägg gärna till streckkod eller artikelnummer så kan vi matcha nästa gång.
          </Text>
        </View>
      ) : null}

      {/* --- Wine details --- */}
      <AutocompleteInput
        label="Namn"
        value={draft.name}
        onChangeText={(value) => onDraftChange({ name: value })}
        onOptionSelected={onNameSelected}
        options={effectiveWineNameOptions}
        optionRows={wineNameReferenceRows}
        placeholder="Skriv minst 4 bokstäver"
        minimumQueryLength={4}
        editable={!isLockedByCatalog("name")}
      />
      <LabeledInput
        label="Producent"
        value={draft.producer}
        onChangeText={(value) => onDraftChange({ producer: value })}
        editable={!isLockedByCatalog("producer")}
      />
      <DoubleRow>
        <AutocompleteInput
          label="Land"
          value={draft.country}
          onChangeText={(value) => onDraftChange({ country: value })}
          options={effectiveCountryOptions}
          optionRows={countryReferenceRows}
          placeholder="Skriv t.ex. fr eller it"
          editable={!isLockedByCatalog("country")}
        />
        <AutocompleteInput
          label="Region"
          value={draft.region}
          onChangeText={(value) => onDraftChange({ region: value })}
          options={effectiveRegionOptions}
          optionRows={regionReferenceRows}
          placeholder="Skriv t.ex. bor, rio, nap..."
          editable={!isLockedByCatalog("region")}
        />
      </DoubleRow>
      <AutocompleteInput
        label="Druva"
        value={draft.grape}
        onChangeText={(value) => onDraftChange({ grape: value })}
        options={effectiveGrapeOptions}
        optionRows={grapeReferenceRows}
        placeholder="Nebbiolo, Chardonnay..."
        editable={!isLockedByCatalog("grape")}
      />
      <DoubleRow>
        <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
        <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
      </DoubleRow>
      <SuggestionRow
        title="Vintyp"
        options={WINE_TYPE_OPTIONS}
        selected={draft.type}
        onSelect={(value) => onDraftChange({ type: value })}
        disabled={isLockedByCatalog("type")}
      />
      <LabeledInput label="Drick senast" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" />

      {/* --- Food pairing: suggestions + free text together --- */}
      <SuggestionRow
        title="Matförslag"
        options={getSuggestedPairings(draft.type)}
        selected={parseTags(draft.foodPairings)[0] || ""}
        onSelect={(pairing) => onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, pairing) })}
      />
      <LabeledInput
        label="Passar till"
        value={draft.foodPairings}
        onChangeText={(value) => onDraftChange({ foodPairings: value })}
        placeholder="lamm, ost, svamp, fisk"
        editable={!isLockedByCatalog("food_pairings")}
      />

      {/* --- Storage --- */}
      {storageSpaces.length > 0 ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Förvaringsplats</Text>
          <Text style={styles.notesText}>Välj plats, rad och slot. Fri platsnotering kan användas som extra stöd.</Text>
          <StorageSpaceSelector title="" spaces={storageSpaces} selectedId={selectedStorageSpaceId} onSelect={onStorageSpaceChange} clearLabel="Ingen plats" />
          {selectedStorageSpace ? (
            <>
              <SuggestionRow title="Rad" options={buildNumericOptions(selectedStorageSpace.row_count)} selected={selectedStorageRow} onSelect={onStorageRowChange} />
              <SuggestionRow title="Plats" options={buildNumericOptions(selectedStorageSpace.slots_per_row)} selected={selectedStorageSlot} onSelect={onStorageSlotChange} />
              <Text style={styles.notesText}>
                Vald placering:{" "}
                {getWineStoragePlacementLabel(
                  {
                    storage_space_id: selectedStorageSpaceId,
                    storage_row: Number(selectedStorageRow),
                    storage_slot: Number(selectedStorageSlot),
                  },
                  storageSpaceById
                )}
              </Text>
            </>
          ) : null}
        </View>
      ) : (
        <Text style={styles.notesText}>Skapa en förvaringsplats nedan för att kunna välja rad och plats.</Text>
      )}

      <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} placeholder="t.ex. längst bak, överst i kylen" />
      <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => onDraftChange({ tags: value })} placeholder="middag, present, lagring" />
      <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} multiline />

      <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{draft.imageUri ? "Byt bild" : "Välj flaskbild"}</Text>
      </Pressable>

      {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={styles.wineImage} /> : null}

      <Pressable onPress={onSaveWine} style={styles.primaryButton} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara i källaren"}</Text>
      </Pressable>
    </View>
  );
}

export function DrinkWineModal({
  visible,
  styles,
  wine,
  rating,
  notes,
  saving,
  onClose,
  onRatingChange,
  onNotesChange,
  onConfirm,
}: {
  visible: boolean;
  styles: SharedStyles;
  wine: WineRecord | null;
  rating: string;
  notes: string;
  saving: boolean;
  onClose: () => void;
  onRatingChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent={false}>
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Historik</Text>
            <Text style={styles.scannerTitle}>Drack du {wine?.name || "det här vinet"}?</Text>
          </View>
          <Pressable onPress={onClose} disabled={saving}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.catalogEditorContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.notesText}>
            Sätt gärna ett betyg direkt. Om det var sista flaskan hamnar vinet ändå kvar i historiken.
          </Text>

          <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={onRatingChange} />

          <LabeledInput
            label="Smaknotering"
            value={notes}
            onChangeText={onNotesChange}
            placeholder="t.ex. mörk frukt, bra syra, gärna igen"
            multiline
          />

          <View style={styles.modalActionRow}>
            <Pressable onPress={onClose} style={styles.secondaryButton} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Avbryt</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.primaryButton} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara i historik"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function EditWineModal({
  visible,
  styles,
  draft,
  storageSpaces,
  selectedStorageSpace,
  storageSpaceById,
  effectiveWineNameOptions,
  effectiveCountryOptions,
  effectiveRegionOptions,
  effectiveGrapeOptions,
  wineNameReferenceRows,
  countryReferenceRows,
  regionReferenceRows,
  grapeReferenceRows,
  saving,
  onClose,
  onDraftChange,
  onStorageSpaceChange,
  onStorageRowChange,
  onStorageSlotChange,
  onSave,
}: {
  visible: boolean;
  styles: SharedStyles;
  draft: WineDraft | null;
  storageSpaces: StorageSpaceRow[];
  selectedStorageSpace?: StorageSpaceRow | null;
  storageSpaceById: Map<string, StorageSpaceRow>;
  effectiveWineNameOptions: string[];
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
  wineNameReferenceRows: ReferenceOptionRow[];
  countryReferenceRows: ReferenceOptionRow[];
  regionReferenceRows: ReferenceOptionRow[];
  grapeReferenceRows: ReferenceOptionRow[];
  saving: boolean;
  onClose: () => void;
  onDraftChange: (patch: Partial<WineDraft>) => void;
  onStorageSpaceChange: (spaceId: string) => void;
  onStorageRowChange: (value: string) => void;
  onStorageSlotChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Min källare</Text>
            <Text style={styles.scannerTitle}>Redigera vin</Text>
          </View>
          <Pressable onPress={onClose} disabled={saving}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.catalogEditorContent} keyboardShouldPersistTaps="handled">
          {draft ? (
            <>
              <AutocompleteInput
                label="Namn"
                value={draft.name}
                onChangeText={(value) => onDraftChange({ name: value })}
                options={effectiveWineNameOptions}
                optionRows={wineNameReferenceRows}
                placeholder="Skriv minst 4 bokstäver"
                minimumQueryLength={4}
              />
              <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onDraftChange({ producer: value })} />
              <DoubleRow>
                <AutocompleteInput
                  label="Land"
                  value={draft.country}
                  onChangeText={(value) => onDraftChange({ country: value })}
                  options={effectiveCountryOptions}
                  optionRows={countryReferenceRows}
                />
                <AutocompleteInput
                  label="Region"
                  value={draft.region}
                  onChangeText={(value) => onDraftChange({ region: value })}
                  options={effectiveRegionOptions}
                  optionRows={regionReferenceRows}
                />
              </DoubleRow>
              <AutocompleteInput
                label="Druva"
                value={draft.grape}
                onChangeText={(value) => onDraftChange({ grape: value })}
                options={effectiveGrapeOptions}
                optionRows={grapeReferenceRows}
              />
              <DoubleRow>
                <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
                <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
              </DoubleRow>
              <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onDraftChange({ type: value })} />
              <LabeledInput label="Drick senast" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" />

              {storageSpaces.length > 0 ? (
                <View style={styles.foodSection}>
                  <Text style={styles.inputLabel}>Förvaringsplats</Text>
                  <StorageSpaceSelector title="" spaces={storageSpaces} selectedId={draft.storageSpaceId} onSelect={onStorageSpaceChange} clearLabel="Ingen plats" />
                  {selectedStorageSpace ? (
                    <>
                      <SuggestionRow title="Rad" options={buildNumericOptions(selectedStorageSpace.row_count)} selected={draft.storageRow} onSelect={onStorageRowChange} />
                      <SuggestionRow title="Plats" options={buildNumericOptions(selectedStorageSpace.slots_per_row)} selected={draft.storageSlot} onSelect={onStorageSlotChange} />
                      <Text style={styles.notesText}>
                        Vald placering:{" "}
                        {getWineStoragePlacementLabel(
                          {
                            storage_space_id: draft.storageSpaceId,
                            storage_row: Number(draft.storageRow),
                            storage_slot: Number(draft.storageSlot),
                          },
                          storageSpaceById
                        )}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : null}

              <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} />
              <DoubleRow>
                <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={(value) => onDraftChange({ barcode: value })} />
                <LabeledInput label="Artikelnummer" value={draft.systembolagetProductId} onChangeText={(value) => onDraftChange({ systembolagetProductId: value })} />
              </DoubleRow>
              <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => onDraftChange({ tags: value })} />
              <LabeledInput label="Passar till" value={draft.foodPairings} onChangeText={(value) => onDraftChange({ foodPairings: value })} />
              <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} multiline />

              <View style={styles.modalActionRow}>
                <Pressable onPress={onClose} style={styles.secondaryButton} disabled={saving}>
                  <Text style={styles.secondaryButtonText}>Avbryt</Text>
                </Pressable>
                <Pressable onPress={onSave} style={styles.primaryButton} disabled={saving}>
                  <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara ändringar"}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
