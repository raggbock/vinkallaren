import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { AnimatedModal } from "./animated-modal";

import { buildNumericOptions, getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import { AutocompleteInput, DateInput, DoubleRow, LabeledInput, StorageSpaceForm, StorageSpaceSelector, SuggestionRow, type Suggestion } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;
const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Rosé", "Mousserande", "Dessert"];

export function EditWineModal({
  visible, styles, draft, storageSpaces, selectedStorageSpace, storageSpaceById,
  occupiedPositions, storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace,
  searchWineNames, effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
  countryReferenceRows, regionReferenceRows, grapeReferenceRows,
  saving, onClose, onDraftChange, onStorageSpaceChange, onStorageRowChange, onStorageSlotChange,
  onChooseImage, onTakePhoto, onRemoveImage, onSave,
}: {
  visible: boolean;
  styles: SharedStyles;
  draft: WineDraft | null;
  storageSpaces: StorageSpaceRow[];
  selectedStorageSpace?: StorageSpaceRow | null;
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
  saving: boolean;
  onClose: () => void;
  onDraftChange: (patch: Partial<WineDraft>) => void;
  onStorageSpaceChange: (spaceId: string) => void;
  onStorageRowChange: (value: string) => void;
  onStorageSlotChange: (value: string) => void;
  onChooseImage: () => void;
  onTakePhoto: () => void;
  onRemoveImage: () => void;
  onSave: () => void;
}) {
  return (
    <AnimatedModal visible={visible} onClose={onClose}>
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
              <AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
              <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onDraftChange({ producer: value })} />
              <DoubleRow>
                <AutocompleteInput label="Land" value={draft.country} onChangeText={(value) => onDraftChange({ country: value })} options={effectiveCountryOptions} optionRows={countryReferenceRows} />
                <AutocompleteInput label="Region" value={draft.region} onChangeText={(value) => onDraftChange({ region: value })} options={effectiveRegionOptions} optionRows={regionReferenceRows} />
              </DoubleRow>
              <AutocompleteInput label="Druva" value={draft.grape} onChangeText={(value) => onDraftChange({ grape: value })} options={effectiveGrapeOptions} optionRows={grapeReferenceRows} />
              <DoubleRow>
                <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
                <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
              </DoubleRow>
              <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onDraftChange({ type: value })} />
              <DoubleRow>
                <LabeledInput label="Drick senast (år)" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" placeholder="t.ex. 2028" />
                <DateInput label="Inköpt" value={draft.acquiredAt} onChangeText={(value) => onDraftChange({ acquiredAt: value })} />
              </DoubleRow>

              {storageSpaces.length > 0 ? (
                <View style={styles.foodSection}>
                  <Text style={styles.inputLabel}>Förvaringsplats</Text>
                  <StorageSpaceSelector title="" spaces={storageSpaces} selectedId={draft.storageSpaceId} onSelect={onStorageSpaceChange} clearLabel="Ingen plats" />
                  {selectedStorageSpace && selectedStorageSpace.row_count > 0 ? (
                    <>
                      <SuggestionRow title="Rad" options={buildNumericOptions(selectedStorageSpace.row_count)} selected={draft.storageRow} onSelect={onStorageRowChange} disabledOptions={occupiedPositions.occupiedRows} />
                      <SuggestionRow title="Plats" options={buildNumericOptions(selectedStorageSpace.slots_per_row)} selected={draft.storageSlot} onSelect={onStorageSlotChange} disabledOptions={occupiedPositions.occupiedSlots} />
                      <Text style={styles.notesText}>Vald placering: {getWineStoragePlacementLabel({ storage_space_id: draft.storageSpaceId, storage_row: Number(draft.storageRow), storage_slot: Number(draft.storageSlot) }, storageSpaceById)}</Text>
                    </>
                  ) : null}
                  <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />
                </View>
              ) : (
                <View style={styles.foodSection}>
                  <Text style={styles.inputLabel}>Förvaringsplats</Text>
                  <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />
                </View>
              )}

              <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} />
              <DoubleRow>
                <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={(value) => onDraftChange({ barcode: value })} />
                <LabeledInput label="Artikelnummer" value={draft.systembolagetProductId} onChangeText={(value) => onDraftChange({ systembolagetProductId: value })} />
              </DoubleRow>
              <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => onDraftChange({ tags: value })} />
              <LabeledInput label="Passar till" value={draft.foodPairings} onChangeText={(value) => onDraftChange({ foodPairings: value })} />
              <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} multiline />

              <View style={styles.foodSection}>
                <Text style={styles.inputLabel}>Bild</Text>
                <View style={styles.tagRow}>
                  <Pressable onPress={onTakePhoto} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Ta foto</Text>
                  </Pressable>
                  <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{draft.imageUri ? "Byt bild" : "Välj bild"}</Text>
                  </Pressable>
                  {draft.imageUri ? (
                    <Pressable onPress={onRemoveImage} style={styles.secondaryButton}>
                      <Text style={styles.dangerText}>Ta bort bild</Text>
                    </Pressable>
                  ) : null}
                </View>
                {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={styles.wineImage} resizeMode="contain" /> : null}
              </View>

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
    </AnimatedModal>
  );
}
