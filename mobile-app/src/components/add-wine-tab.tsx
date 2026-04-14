import { lazy, Suspense, useCallback, useMemo, useState } from "react";
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
  const ctx = useCellar();
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);

  const catalogLookup = useCatalogLookup({ selectedCatalogNameEntry });
  const userDishes = useUserDishes();
  const vintage = useVintagePicker({
    fetchCatalogEntriesByName: ctx.fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const barcode = useBarcodeScanner({
    sessionUserId,
    wines: ctx.wines,
    maybeSuggestCatalogMatch: catalogLookup.maybeSuggestCatalogMatch,
  });
  const label = useLabelScanner({
    takePhoto: images.takePhoto,
    matchCatalogByText: ctx.matchCatalogByText,
    fetchCatalogEntriesByName: ctx.fetchCatalogEntriesByName,
    setSelectedCatalogNameEntry,
  });
  const tasting = useAddWineTasting({
    userId: sessionUserId,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    setHistoryEntries: ctx.setHistoryEntries,
    showSuccess: success.show,
  });

  const gate = useGuestGate(isAnonymous, ctx.wines.length);
  const [imageNudge, setImageNudge] = useState(false);
  const [savedPrompt, setSavedPrompt] = useState(false);

  const catalogProps: CatalogProps = useMemo(() => ({
    searchWineNames: ctx.searchCatalogWineNames,
    effectiveCountryOptions: ctx.effectiveCountryOptions,
    effectiveRegionOptions: ctx.effectiveRegionOptions,
    effectiveGrapeOptions: ctx.effectiveGrapeOptions,
    countryReferenceRows: ctx.countryReferenceRows,
    regionReferenceRows: ctx.regionReferenceRows,
    grapeReferenceRows: ctx.grapeReferenceRows,
    lookupBusy: label.labelBusy || catalogLookup.lookupBusy,
    lookupMessage: label.labelMessage || catalogLookup.lookupMessage,
  }), [
    ctx.searchCatalogWineNames,
    ctx.effectiveCountryOptions, ctx.effectiveRegionOptions, ctx.effectiveGrapeOptions,
    ctx.countryReferenceRows, ctx.regionReferenceRows, ctx.grapeReferenceRows,
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
    ctx.setWines(prev => [hydrated, ...prev]);
    ctx.mergeReferenceOptions(savedRow);
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
        storageSpaces={ctx.storageSpaces}
        wines={ctx.wines}
        saving={saving}
        onDraftChange={(patch) => setDraft((c) => catalogLookup.updateDraft(c, patch))}
        onNameSelected={(name, producer) => vintage.handleWineNameSelected(name, producer, setDraft)}
        onArticleNumberChange={(value) => {
          setDraft((current) => catalogLookup.updateDraft(current, { systembolagetProductId: value }));
          catalogLookup.maybeSuggestCatalogMatch({ ...draft, systembolagetProductId: value }).then((match) => {
            if (match) setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
          });
        }}
        storageSpaceDraft={ctx.storageSpaceDraft}
        savingStorageSpace={ctx.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => ctx.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={async () => { const newId = await ctx.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
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
