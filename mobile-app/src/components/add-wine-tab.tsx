import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { openSystembolaget, saveNewWine } from "../lib/cellar-actions";
import { hydrateWineRecords, mergeDraftWithCatalogSuggestion } from "../lib/wine-helpers";
import { showError } from "../lib/show-error";
import { AddWinePanel } from "./add-wine-panel";
import { defaultDraft, defaultImportSelection, type WineDraft } from "../types/cellar-drafts";
import type { CatalogProps } from "../types/panel-prop-groups";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { useCatalog } from "../hooks/useCatalog";
import type { useReferenceOptions } from "../hooks/useReferenceOptions";
import type { useImagePicker } from "../hooks/useImagePicker";
import type { useStorageSpaces } from "../hooks/useStorageSpaces";
import type { useStorageSelection } from "../hooks/useStorageSelection";
import type { useSuccessOverlay } from "./success-overlay";
import type { useWines } from "../hooks/useWines";
import type { useHistory } from "../hooks/useHistory";
import { useCatalogLookup } from "../hooks/useCatalogLookup";
import { useUserDishes } from "../hooks/useUserDishes";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useVintagePicker } from "../hooks/useVintagePicker";
import { useLabelScanner } from "../hooks/useLabelScanner";
import { useAddWineTasting } from "../hooks/useAddWineTasting";
import { styles } from "../styles/theme";
import { useCellar } from "../contexts/CellarContext";
import { useGuestGate } from "../hooks/useGuestGate";
import { UpgradePrompt } from "./upgrade-prompt";

const BarcodeScannerModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.BarcodeScannerModal })));
const VintagePickerModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.VintagePickerModal })));
const LabelMatchPickerModal = lazy(() => import("./label-match-picker").then(m => ({ default: m.LabelMatchPickerModal })));
const WsetTastingModal = lazy(() => import("./wset-tasting-modal").then(m => ({ default: m.WsetTastingModal })));

export type AddWineTabProps = {
  hidden: boolean;
  isAnonymous: boolean;
  onOpenProfile: () => void;
  onNavigateToCellar: () => void;
  catalogData: ReturnType<typeof useCatalog>;
  refOptions: ReturnType<typeof useReferenceOptions>;
  images: ReturnType<typeof useImagePicker>;
  storageData: ReturnType<typeof useStorageSpaces>;
  storage: ReturnType<typeof useStorageSelection>;
  success: ReturnType<typeof useSuccessOverlay>;
  wineData: Pick<ReturnType<typeof useWines>, "wines" | "setWines">;
  historyData: Pick<ReturnType<typeof useHistory>, "setHistoryEntries">;
  sessionUserId: string;
};

export function AddWineTab({ hidden, ...props }: AddWineTabProps) {
  const [activated, setActivated] = useState(false);
  if (!hidden && !activated) setActivated(true);
  if (!activated) return null;
  return <AddWineTabContent hidden={hidden} {...props} />;
}

function AddWineTabContent({
  hidden,
  isAnonymous,
  onOpenProfile,
  onNavigateToCellar,
  catalogData,
  refOptions,
  images,
  storageData,
  storage,
  success,
  wineData,
  historyData,
  sessionUserId,
}: Omit<AddWineTabProps, "hidden"> & { hidden: boolean }) {
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);

  const catalogLookup = useCatalogLookup({ selectedCatalogNameEntry });
  const userDishes = useUserDishes();
  const vintage = useVintagePicker({
    fetchCatalogEntriesByName: catalogData.fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const barcode = useBarcodeScanner({
    sessionUserId,
    wines: wineData.wines,
    maybeSuggestCatalogMatch: catalogLookup.maybeSuggestCatalogMatch,
  });
  const label = useLabelScanner({
    takePhoto: images.takePhoto,
    matchCatalogByText: catalogData.matchCatalogByText,
    fetchCatalogEntriesByName: catalogData.fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const tasting = useAddWineTasting({
    userId: sessionUserId,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    setHistoryEntries: historyData.setHistoryEntries,
    showSuccess: success.show,
  });

  const ctx = useCellar();
  const gate = useGuestGate(isAnonymous, ctx.wines.length);

  const catalogProps: CatalogProps = useMemo(() => ({
    searchWineNames: catalogData.searchCatalogWineNames,
    effectiveCountryOptions: refOptions.effectiveCountryOptions,
    effectiveRegionOptions: refOptions.effectiveRegionOptions,
    effectiveGrapeOptions: refOptions.effectiveGrapeOptions,
    countryReferenceRows: refOptions.countryReferenceRows,
    regionReferenceRows: refOptions.regionReferenceRows,
    grapeReferenceRows: refOptions.grapeReferenceRows,
    lookupBusy: label.labelBusy || catalogLookup.lookupBusy,
    lookupMessage: label.labelMessage || catalogLookup.lookupMessage,
  }), [
    catalogData.searchCatalogWineNames,
    refOptions.effectiveCountryOptions,
    refOptions.effectiveRegionOptions,
    refOptions.effectiveGrapeOptions,
    refOptions.countryReferenceRows,
    refOptions.regionReferenceRows,
    refOptions.grapeReferenceRows,
    catalogLookup.lookupBusy,
    catalogLookup.lookupMessage,
    label.labelBusy,
    label.labelMessage,
  ]);

  async function handleSaveWine() {
    setSaving(true);
    const result = await saveNewWine({
      userId: sessionUserId,
      draft,
      storageSpaceId: storage.selectedStorageSpaceId,
      storageRow: storage.selectedStorageRow,
      storageSlot: storage.selectedStorageSlot,
      selectedCatalogNameEntry,
    });
    setSaving(false);
    if (result.error) { showError("Kunde inte spara", result.error); return; }
    setDraft(defaultDraft); setSelectedCatalogNameEntry(null);
    storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1");
    const savedRow = result.data!;
    const [hydrated] = await hydrateWineRecords([savedRow]);
    wineData.setWines(prev => [hydrated, ...prev]);
    refOptions.mergeReferenceOptions(savedRow);
    success.show("wine_added");
    if (Platform.OS === "web") {
      if (window.confirm("Vinet är sparat! Vill du gå till din källare?")) onNavigateToCellar();
    } else {
      Alert.alert("Vinet är sparat!", "Vad vill du göra nu?", [
        { text: "Lägg till fler", style: "default" },
        { text: "Gå till min källare", onPress: onNavigateToCellar },
      ]);
    }
  }

  async function handleOpenSystembolaget(productId: string) {
    const result = await openSystembolaget(productId);
    if (result.error) showError("Kunde inte öppna länken", result.error);
  }

  if (hidden) return null;

  return (
    <>
      <AddWinePanel
        styles={styles} draft={draft}
        catalog={catalogProps} tasting={tasting.panelProps}
        storageSpaces={storageData.storageSpaces}
        wines={wineData.wines}
        saving={saving}
        onDraftChange={(patch) => setDraft((c) => catalogLookup.updateDraft(c, patch))}
        onNameSelected={(name, producer) => vintage.handleWineNameSelected(name, producer, setDraft)}
        onArticleNumberChange={(value) => {
          setDraft((current) => catalogLookup.updateDraft(current, { systembolagetProductId: value }));
          catalogLookup.maybeSuggestCatalogMatch({ ...draft, systembolagetProductId: value }).then((match) => {
            if (match) setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
          });
        }}
        storageSpaceDraft={storageData.storageSpaceDraft}
        savingStorageSpace={storageData.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => storageData.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={async () => { const newId = await storageData.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
        onPositionChange={(spaceId, row, slot) => { storage.setSelectedStorageSpaceId(spaceId); storage.setSelectedStorageRow(row); storage.setSelectedStorageSlot(slot); }}
        onScanLabel={() => { barcode.setScannerVisible(false); label.handleLabelPhoto(setDraft); }}
        onOpenSystembolaget={handleOpenSystembolaget}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onSaveWine={() => {
          if (gate.shouldPrompt) return;
          handleSaveWine();
        }}
        onOpenProfile={onOpenProfile}
        userDishGroups={userDishes.groups}
        userCategories={userDishes.categories}
        onAddUserDish={userDishes.addDish}
      />
      <UpgradePrompt
        visible={gate.shouldPrompt}
        isBlocked={gate.isBlocked}
        onUpgraded={() => handleSaveWine()}
        onDismiss={() => { gate.dismiss(); handleSaveWine(); }}
      />
      <Suspense fallback={null}>
        <BarcodeScannerModal visible={barcode.scannerVisible} styles={styles} onClose={() => barcode.setScannerVisible(false)} onBarcodeScanned={({ data: d }) => barcode.handleBarcodeScanned(d, draft, setDraft)} onLabelPhoto={() => { barcode.setScannerVisible(false); label.handleLabelPhoto(setDraft); }} />
        <LabelMatchPickerModal visible={label.labelPickerVisible} matches={label.labelMatches} onSelect={(m) => label.handleLabelMatchSelected(m, setDraft)} onDismiss={() => label.handleLabelMatchDismissed(setDraft)} />
        <WsetTastingModal {...tasting.wsetProps} wineType={draft.type} />
        <VintagePickerModal visible={vintage.vintagePickerVisible} wineName={vintage.vintagePickerWineName} vintages={vintage.vintagePickerOptions} loading={vintage.vintagePickerLoading} onSelectVintage={(e) => vintage.handleVintageSelected(e, setDraft)} onAddNew={() => vintage.handleVintageAddNew(setDraft)} onClose={() => vintage.setVintagePickerVisible(false)} styles={styles} />
      </Suspense>
    </>
  );
}
