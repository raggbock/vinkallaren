import React from "react";
import { CameraView } from "expo-camera";
import { Animated, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedModal } from "./animated-modal";

import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { CatalogEditorDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import type { WineHistoryRecord } from "../types/wine-history";
import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import { AutocompleteInput, DateInput, DoubleRow, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";

import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;
const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

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
    <AnimatedModal visible={visible} onClose={onClose}>
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

        <Pressable onPress={onLabelPhoto} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Fotografera etiketten</Text>
        </Pressable>
      </SafeAreaView>
    </AnimatedModal>
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
    <AnimatedModal visible={visible} onClose={onClose}>
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
    </AnimatedModal>
  );
}

export function VintagePickerModal({
  visible, wineName, vintages, loading, onSelectVintage, onAddNew, onClose, styles,
}: {
  visible: boolean;
  wineName: string;
  vintages: { year: string; entry: ProductCatalogWineRow }[];
  loading?: boolean;
  onSelectVintage: (entry: ProductCatalogWineRow) => void;
  onAddNew: () => void;
  onClose: () => void;
  styles: SharedStyles;
}) {
  return (
    <AnimatedModal visible={visible} onClose={onClose} mode="centered" cardStyle={styles.vintagePickerCard}>
      <Text style={styles.vintagePickerTitle}>{wineName}</Text>
      {loading ? (
        <VintageLoadingDots />
      ) : (
        <>
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
        </>
      )}
    </AnimatedModal>
  );
}

function VintageLoadingDots() {
  const anims = [new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)].map((anim, i) => {
    const ref = React.useRef(anim).current;
    React.useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(ref, { toValue: 1, duration: 400, delay: i * 150, useNativeDriver: true }),
          Animated.timing(ref, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, []);
    return ref;
  });

  return (
    <View style={vintageLoadingStyles.container}>
      <View style={vintageLoadingStyles.dotRow}>
        {anims.map((anim, i) => (
          <Animated.View key={i} style={[vintageLoadingStyles.dot, { opacity: anim }]} />
        ))}
      </View>
      <Text style={vintageLoadingStyles.text}>Hämtar årgångar…</Text>
    </View>
  );
}

const vintageLoadingStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 16,
  },
  dotRow: {
    flexDirection: "row",
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

export function DrinkWineModal({
  visible, styles, wine, rating, notes, consumedDate, imageUri, saving,
  wsetData, onOpenWset,
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
  wsetData: WsetTastingData | null;
  onOpenWset: () => void;
  onClose: () => void;
  onRatingChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onConsumedDateChange: (value: string) => void;
  onChooseImage: () => void;
  onTakePhoto: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatedModal visible={visible} onClose={onClose} mode="centered" cardStyle={drinkStyles.card}>
          <View style={styles.panelHeaderRow}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>Historik</Text>
              <Text style={styles.panelTitle}>{wine?.name || "Vin"}</Text>
            </View>
            <Pressable onPress={onClose} disabled={saving}>
              <Text style={styles.linkText}>Stäng</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <DateInput label="Datum" value={consumedDate} onChangeText={onConsumedDateChange} />
            <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={onRatingChange} />
            {wsetData ? (
              <Pressable onPress={onOpenWset} style={styles.importSuggestionCard}>
                <Text style={styles.inputLabel}>WSET Tasting</Text>
                <Text style={styles.notesText}>{buildWsetSummary(wsetData)}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={onOpenWset} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>WSET Tasting</Text>
              </Pressable>
            )}
            <LabeledInput label="Smaknotering" value={notes} onChangeText={onNotesChange} placeholder="t.ex. mörk frukt, bra syra" multiline />
            <View style={styles.imageButtonRow}>
              <Pressable onPress={onTakePhoto} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Ta foto</Text>
              </Pressable>
              <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Välj bild</Text>
              </Pressable>
            </View>
            {imageUri ? <Image source={{ uri: imageUri }} style={{ width: "100%", height: 160, borderRadius: 12, backgroundColor: colors.surfaceAlt }} resizeMode="contain" /> : null}
          </ScrollView>

          <View style={styles.modalActionRow}>
            <Pressable onPress={onClose} style={styles.secondaryButton} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Avbryt</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.primaryButton} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara"}</Text>
            </Pressable>
          </View>
    </AnimatedModal>
  );
}

export function EditHistoryModal({
  visible, styles, entry, saving,
  onClose, onSave,
}: {
  visible: boolean;
  styles: SharedStyles;
  entry: WineHistoryRecord | null;
  saving: boolean;
  onClose: () => void;
  onSave: (fields: { rating: string; notes: string; date: string; quantity: string }) => void;
}) {
  const [rating, setRating] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [date, setDate] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");

  React.useEffect(() => {
    if (!entry) return;
    setRating(entry.rating ? String(entry.rating) : "");
    setNotes(entry.tasting_notes || "");
    setDate(entry.consumed_at?.slice(0, 10) || "");
    setQuantity(String(entry.quantity_consumed));
  }, [entry]);

  return (
    <AnimatedModal visible={visible} onClose={onClose} mode="centered" cardStyle={drinkStyles.card}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>Redigera historik</Text>
          <Text style={styles.panelTitle}>{entry?.name || "Vin"}</Text>
        </View>
        <Pressable onPress={onClose} disabled={saving}>
          <Text style={styles.linkText}>Stäng</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
        <DateInput label="Datum" value={date} onChangeText={setDate} />
        <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={setRating} />
        <LabeledInput label="Smaknotering" value={notes} onChangeText={setNotes} placeholder="t.ex. mörk frukt, bra syra" multiline />
        <LabeledInput label="Antal flaskor" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
      </ScrollView>

      <View style={styles.modalActionRow}>
        <Pressable onPress={onClose} style={styles.secondaryButton} disabled={saving}>
          <Text style={styles.secondaryButtonText}>Avbryt</Text>
        </Pressable>
        <Pressable onPress={() => onSave({ rating, notes, date, quantity })} style={styles.primaryButton} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara"}</Text>
        </Pressable>
      </View>
    </AnimatedModal>
  );
}

const drinkStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
    gap: 14,
  },
});
