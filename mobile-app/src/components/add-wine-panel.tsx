import { ActivityIndicator, Dimensions, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";

import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import type { CatalogProps, TastingProps } from "../types/panel-prop-groups";
import { AutocompleteInput, Expandable, LabeledInput, PanelHeader, SuggestionRow } from "./form-controls";
import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
import { WineCoreFields } from "./wine-core-fields";
import { TastingFields } from "./tasting-fields";
import { CellarFields } from "./cellar-fields";
import { ImagePickerSection } from "./image-picker-section";

type SharedStyles = typeof themeStyles;

export function AddWinePanel(props: AddWinePanelProps) {
  const { styles, draft, saving, onSaveWine, catalog, tasting } = props;
  const { tastingMode, onTastingModeChange, savingTasting, onSaveTasting } = tasting;
  const isDesktopWeb = Platform.OS === "web" && Dimensions.get("window").width > 768;
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <View style={styles.panel}>
      <PanelHeader title="Lägg till vin" rightLabel="Profil" onRightPress={props.onOpenProfile} />
      <SuggestionRow title="Läge" options={["Källare", "Vinprovning"]} selected={tastingMode ? "Vinprovning" : "Källare"} onSelect={(value) => onTastingModeChange(value === "Vinprovning")} />
      {tastingMode ? <Text style={styles.notesText}>Vinet sparas direkt i din historik — det läggs inte till i källaren.</Text> : null}

      <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1.5, borderColor: colors.accent, padding: 4, ...Platform.select({ web: { boxShadow: "1px 2px 0px rgba(200, 60, 45, 0.08)" } as any, default: {} }) }}>
        <AutocompleteInput label="" value={searchQuery} onChangeText={setSearchQuery} onOptionSelected={(name, producer) => { setSearchQuery(""); props.onNameSelected(name, producer); }} options={[]} searchAsync={catalog.searchWineNames} placeholder="Sök vin eller producent..." minimumQueryLength={3} />
      </View>
      <FlerAlternativ styles={styles} draft={draft} isDesktopWeb={isDesktopWeb} onArticleNumberChange={props.onArticleNumberChange} onScanLabel={props.onScanLabel} lookupBusy={catalog.lookupBusy} lookupMessage={catalog.lookupMessage} />

      <SectionLabel label="Om vinet" />
      <WineCoreFields draft={draft} tastingMode={tastingMode} effectiveCountryOptions={catalog.effectiveCountryOptions} effectiveRegionOptions={catalog.effectiveRegionOptions} effectiveGrapeOptions={catalog.effectiveGrapeOptions} countryReferenceRows={catalog.countryReferenceRows} regionReferenceRows={catalog.regionReferenceRows} grapeReferenceRows={catalog.grapeReferenceRows} onDraftChange={props.onDraftChange} />

      <SectionLabel label={tastingMode ? "Provning" : "Förvaring"} />
      {tastingMode ? (
        <TastingFields styles={styles} draft={draft} tastingDate={tasting.tastingDate} tastingRating={tasting.tastingRating} wsetData={tasting.wsetData} onDraftChange={props.onDraftChange} onTastingDateChange={tasting.onTastingDateChange} onTastingRatingChange={tasting.onTastingRatingChange} onOpenWset={tasting.onOpenWset} />
      ) : (
        <CellarFields styles={styles} draft={draft} storageSpaces={props.storageSpaces} wines={props.wines} storageSpaceDraft={props.storageSpaceDraft} savingStorageSpace={props.savingStorageSpace} onStorageSpaceDraftChange={props.onStorageSpaceDraftChange} onSaveStorageSpace={props.onSaveStorageSpace} onDraftChange={props.onDraftChange} onPositionChange={props.onPositionChange} />
      )}

      <SectionLabel label="Övrigt" />
      <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => props.onDraftChange({ tags: value })} placeholder="middag, present, lagring" />
      <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => props.onDraftChange({ notes: value })} multiline />

      <SectionLabel label="Bild" />
      <ImagePickerSection styles={styles} imageUri={draft.imageUri} isDesktopWeb={isDesktopWeb} onChooseImage={props.onChooseImage} onTakePhoto={props.onTakePhoto} />

      <Pressable onPress={tastingMode ? onSaveTasting : onSaveWine} style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]} disabled={tastingMode ? savingTasting : saving}>
        <Text style={styles.primaryButtonText}>{tastingMode ? (savingTasting ? "Sparar..." : "Spara i historik") : (saving ? "Sparar..." : "Spara i källaren")}</Text>
      </Pressable>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={sectionStyles.divider}>
      <View style={sectionStyles.line} />
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
    position: "relative",
    zIndex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(200, 60, 45, 0.2)",
  },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});

function FlerAlternativ({ styles, draft, isDesktopWeb, onArticleNumberChange, onScanLabel, lookupBusy, lookupMessage }: {
  styles: SharedStyles; draft: WineDraft; isDesktopWeb: boolean;
  onArticleNumberChange: (value: string) => void; onScanLabel: () => void;
  lookupBusy: boolean; lookupMessage: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{open ? "▾" : "▸"}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Fler alternativ</Text>
      </Pressable>
      <Expandable expanded={open}>
        <View style={{ gap: 10 }}>
          <LabeledInput label="Systembolaget artikelnummer" value={draft.systembolagetProductId} onChangeText={onArticleNumberChange} placeholder="t.ex. 12345" />
          {!isDesktopWeb ? (
            <Pressable onPress={onScanLabel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Skanna etikett</Text>
            </Pressable>
          ) : null}
          {lookupBusy ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.notesText}>{lookupMessage || "Söker..."}</Text>
            </View>
          ) : lookupMessage ? <Text style={styles.notesText}>{lookupMessage}</Text> : null}
        </View>
      </Expandable>
    </>
  );
}

export interface AddWinePanelProps {
  styles: SharedStyles;
  draft: WineDraft;
  catalog: CatalogProps;
  tasting: TastingProps;
  storageSpaces: StorageSpaceRow[];
  wines: WineRecord[];
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  onPositionChange: (spaceId: string, row: string, slot: string) => void;
  saving: boolean;
  onDraftChange: (patch: Partial<WineDraft>) => void;
  onNameSelected: (value: string, producer?: string | null) => void;
  onArticleNumberChange: (value: string) => void;
  onScanLabel: () => void;
  onOpenSystembolaget: (productId: string) => void;
  onChooseImage: () => void;
  onTakePhoto: () => void;
  onSaveWine: () => void;
  onOpenProfile?: () => void;
}
