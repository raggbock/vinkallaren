import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { openSystembolaget, saveNewWine } from "../lib/cellar-actions";
import { hydrateWineRecords, mergeDraftWithCatalogSuggestion } from "../lib/wine-helpers";
import { showError } from "../lib/show-error";
import { AddWinePanel } from "./add-wine-panel";
import { defaultDraft, defaultImportSelection, type WineDraft } from "../types/cellar-drafts";
import type { CatalogProps } from "../types/panel-prop-groups";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { useImagePicker } from "../hooks/useImagePicker";
import type { useStorageSelection } from "../hooks/useStorageSelection";
import type { useSuccessOverlay } from "./success-overlay";
import { warmupCatalogSearch } from "../lib/catalog-search";
import { useCatalogLookup } from "../hooks/useCatalogLookup";
import { useUserDishes } from "../hooks/useUserDishes";
import { useBarcodeScanner } from "../hooks/useBarcodeScanner";
import { useVintagePicker } from "../hooks/useVintagePicker";
import { useLabelScanner } from "../hooks/useLabelScanner";
import { useAddWineTasting } from "../hooks/useAddWineTasting";
import { styles } from "../styles/theme";
import { useCellarActions, useCellarReference, useCellarStorage, useCellarWines } from "../contexts/CellarContext";
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
  images: ReturnType<typeof useImagePicker>;
  storage: ReturnType<typeof useStorageSelection>;
  success: ReturnType<typeof useSuccessOverlay>;
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
  images,
  storage,
  success,
  sessionUserId,
}: Omit<AddWineTabProps, "hidden"> & { hidden: boolean }) {
  const { wines } = useCellarWines();
  const { storageSpaces, storageSpaceDraft, savingStorageSpace } = useCellarStorage();
  const {
    effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
    countryReferenceRows, regionReferenceRows, grapeReferenceRows,
  } = useCellarReference();
  const {
    setWines, refreshWines, onCellarMutated, mergeReferenceOptions,
    setHistoryEntries, setStorageSpaceDraft, saveStorageSpace,
    fetchCatalogEntries, fetchCatalogEntriesByName, matchCatalogByText,
    searchCatalogWineNames, fetchReferenceOptions,
  } = useCellarActions();
  useEffect(() => {
    void refreshWines();
    void fetchCatalogEntries();
    void fetchReferenceOptions();
    warmupCatalogSearch();
  }, [refreshWines, fetchCatalogEntries, fetchReferenceOptions]);
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);

  const catalogLookup = useCatalogLookup({ selectedCatalogNameEntry });
  const userDishes = useUserDishes();
  const vintage = useVintagePicker({
    fetchCatalogEntriesByName: fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const barcode = useBarcodeScanner({
    sessionUserId,
    wines: wines,
    maybeSuggestCatalogMatch: catalogLookup.maybeSuggestCatalogMatch,
  });
  const label = useLabelScanner({
    takePhoto: images.takePhoto,
    matchCatalogByText: matchCatalogByText,
    fetchCatalogEntriesByName: fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const tasting = useAddWineTasting({
    userId: sessionUserId,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    setHistoryEntries,
    showSuccess: success.show,
  });

  const gate = useGuestGate(isAnonymous, wines.length);
  const [imageNudge, setImageNudge] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);

  const catalogProps: CatalogProps = useMemo(() => ({
    searchWineNames: searchCatalogWineNames,
    effectiveCountryOptions: effectiveCountryOptions,
    effectiveRegionOptions: effectiveRegionOptions,
    effectiveGrapeOptions: effectiveGrapeOptions,
    countryReferenceRows: countryReferenceRows,
    regionReferenceRows: regionReferenceRows,
    grapeReferenceRows: grapeReferenceRows,
    lookupBusy: label.labelBusy || catalogLookup.lookupBusy,
    lookupMessage: label.labelMessage || catalogLookup.lookupMessage,
  }), [
    searchCatalogWineNames,
    effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions,
    countryReferenceRows, regionReferenceRows, grapeReferenceRows,
    catalogLookup.lookupBusy, catalogLookup.lookupMessage,
    label.labelBusy, label.labelMessage,
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
    setWines(prev => [hydrated, ...prev]);
    await onCellarMutated({ spaceIds: [hydrated.storage_space_id ?? null] });
    mergeReferenceOptions(savedRow);
    success.show("wine_added");
    setSavedPrompt(true);
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
        storageSpaces={storageSpaces}
        wines={wines}
        saving={saving}
        onDraftChange={(patch) => setDraft((c) => catalogLookup.updateDraft(c, patch))}
        onNameSelected={(name, producer) => vintage.handleWineNameSelected(name, producer, setDraft)}
        onArticleNumberChange={(value) => {
          setDraft((current) => catalogLookup.updateDraft(current, { systembolagetProductId: value }));
          catalogLookup.maybeSuggestCatalogMatch({ ...draft, systembolagetProductId: value }).then((match) => {
            if (match) setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
          });
        }}
        storageSpaceDraft={storageSpaceDraft}
        savingStorageSpace={savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={async () => { const newId = await saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
        onPositionChange={(spaceId, row, slot) => { storage.setSelectedStorageSpaceId(spaceId); storage.setSelectedStorageRow(row); storage.setSelectedStorageSlot(slot); }}
        onScanLabel={() => { barcode.setScannerVisible(false); label.handleLabelPhoto(setDraft); }}
        onOpenSystembolaget={handleOpenSystembolaget}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) { setDraft((c) => ({ ...c, imageUri: uri })); setImageNudge(false); } }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) { setDraft((c) => ({ ...c, imageUri: uri })); setImageNudge(false); } }}
        imageNudge={imageNudge}
        onSkipImage={() => { setImageNudge(false); handleSaveWine(); }}
        savedPrompt={savedPrompt}
        onSavedGoToCellar={() => { setSavedPrompt(false); onNavigateToCellar(); }}
        onSavedAddMore={() => { setSavedPrompt(false); setDraft(defaultDraft); setSelectedCatalogNameEntry(null); if (Platform.OS === 'web') (window as any).scrollTo?.({ top: 0, behavior: 'smooth' }); }}
        onSaveWine={() => {
          if (gate.shouldPrompt) return;
          if (!draft.imageUri && !imageNudge) {
            setImageNudge(true);
            return;
          }
          setImageNudge(false);
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
