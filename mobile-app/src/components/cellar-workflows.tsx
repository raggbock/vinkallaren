import { CameraView } from "expo-camera";
import { Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { CatalogEditorDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import { AutocompleteInput, DateInput, DoubleRow, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;
const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

// Re-export extracted components for backward-compatible imports
export { AddWinePanel } from "./add-wine-panel";
export { EditWineModal } from "./edit-wine-modal";

export function BarcodeScannerModal({
  visible, styles, onClose, onBarcodeScanned, onLabelPhoto,
}: {
  visible: boolean;
  styles: SharedStyles;
  onClose: () => void;
  onBarcodeScanned: (event: { data: string }) => void;
  onLabelPhoto: () => void;
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

        {Platform.OS !== "web" ? (
          <Pressable onPress={onLabelPhoto} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Fotografera etiketten</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export function CatalogEditorModal({
  visible, styles, draft, saving, searchWineNames,
  effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
  countryReferenceRows, regionReferenceRows, grapeReferenceRows,
  onClose, onSave, onChange,
}: {
  visible: boolean;
  styles: SharedStyles;
  draft: CatalogEditorDraft | null;
  saving: boolean;
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  effectiveCountryOptions: string[];
  effectiveRegionOptions: string[];
  effectiveGrapeOptions: string[];
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
              <AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onChange({ name: value })} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
              <DoubleRow>
                <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={(value) => onChange({ barcode: value })} />
                <LabeledInput label="Artikelnummer" value={draft.systembolagetProductId} onChangeText={(value) => onChange({ systembolagetProductId: value })} />
              </DoubleRow>
              <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onChange({ producer: value })} />
              <DoubleRow>
                <AutocompleteInput label="Land" value={draft.country} onChangeText={(value) => onChange({ country: value })} options={effectiveCountryOptions} optionRows={countryReferenceRows} />
                <AutocompleteInput label="Region" value={draft.region} onChangeText={(value) => onChange({ region: value })} options={effectiveRegionOptions} optionRows={regionReferenceRows} />
              </DoubleRow>
              <DoubleRow>
                <AutocompleteInput label="Druva" value={draft.grape} onChangeText={(value) => onChange({ grape: value })} options={effectiveGrapeOptions} optionRows={grapeReferenceRows} />
                <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onChange({ vintage: value })} keyboardType="number-pad" />
              </DoubleRow>
              <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onChange({ type: value })} />
              <LabeledInput label="Matmatchning" value={draft.foodPairings} onChangeText={(value) => onChange({ foodPairings: value })} placeholder="lamm, fisk, ost" />
              <LabeledInput label="Källmärkning" value={draft.sourceLabel} onChangeText={(value) => onChange({ sourceLabel: value })} />
              <LabeledInput label="Kvalitetsnivå" value={draft.sourceConfidence} onChangeText={(value) => onChange({ sourceConfidence: value })} placeholder="high, medium, low" />
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
  visible, wineName, vintages, onSelectVintage, onAddNew, onClose, styles,
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
      <View style={styles.vintagePickerOverlay}>
        <View style={styles.vintagePickerCard}>
          <Text style={styles.vintagePickerTitle}>{wineName}</Text>
          <Text style={styles.vintagePickerSubtitle}>Välj årtal:</Text>
          <ScrollView>
            {vintages.map(({ year, entry }) => (
              <Pressable key={entry.id} onPress={() => onSelectVintage(entry)} style={styles.vintagePickerItem}>
                <Text style={styles.vintagePickerItemText}>{year}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onAddNew} style={styles.vintagePickerAddButton}>
            <Text style={styles.vintagePickerAddText}>Lägg till nytt</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function DrinkWineModal({
  visible, styles, wine, rating, notes, consumedDate, imageUri, saving,
  onClose, onRatingChange, onNotesChange, onConsumedDateChange, onChooseImage, onTakePhoto, onConfirm,
}: {
  visible: boolean;
  styles: SharedStyles;
  wine: WineRecord | null;
  rating: string;
  notes: string;
  consumedDate: string;
  imageUri: string;
  saving: boolean;
  onClose: () => void;
  onRatingChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onConsumedDateChange: (value: string) => void;
  onChooseImage: () => void;
  onTakePhoto: () => void;
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
          <DateInput label="Datum" value={consumedDate} onChangeText={onConsumedDateChange} />
          <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={onRatingChange} />
          <LabeledInput label="Smaknotering" value={notes} onChangeText={onNotesChange} placeholder="t.ex. mörk frukt, bra syra, gärna igen" multiline />
          <View style={styles.modalActionRow}>
            <Pressable onPress={onTakePhoto} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ta foto</Text>
            </Pressable>
            <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Välj bild</Text>
            </Pressable>
          </View>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.wineImage} resizeMode="contain" /> : null}
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
