import "react-native-url-polyfill/auto";

import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, Text as RNText, View as RNView } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { buildMealRecommendations } from "./src/lib/cellar-helpers";
import { hydrateWineRecords, toWineDraft } from "./src/lib/wine-helpers";
import {
  deleteCatalogEntryById,
  openSystembolaget,
  saveCatalogEditorEntry,
  saveDrinkEntry,
  saveNewWine,
  saveTastingEntry,
  saveWineEditEntry,
} from "./src/lib/cellar-actions";
import { BottomTabBar, HistoryPanel, MealPlannerPanel, MinKallarePanel } from "./src/components/cellar-sections";
import { AddWinePanel, BarcodeScannerModal, CatalogEditorModal, DrinkWineModal, EditWineModal, VintagePickerModal } from "./src/components/cellar-workflows";
import { WsatTastingModal } from "./src/components/wsat-tasting-modal";
import { LabelMatchPickerModal } from "./src/components/label-match-picker";
import { PrivacyPolicyModal } from "./src/components/privacy-policy-modal";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { WineDraft } from "./src/types/cellar-drafts";
import { defaultDraft } from "./src/types/cellar-drafts";
import type { CatalogEditorDraft } from "./src/types/cellar-drafts";
import type { WineRecord } from "./src/types/wine";
import type { WsatTastingData } from "./src/lib/wsat-data";
import { styles } from "./src/styles/theme";
import { BUILD_VERSION } from "./src/lib/build-version";
import { AuthScreen, LoadingScreen, SetupScreen } from "./src/screens/auth";
import { useCellarData } from "./src/hooks/useCellarData";
import { useCellarFilters } from "./src/hooks/useCellarFilters";
import { useImagePicker } from "./src/hooks/useImagePicker";
import { useStorageSelection } from "./src/hooks/useStorageSelection";
import { useCatalogWorkflow } from "./src/hooks/useCatalogWorkflow";
import { openCatalogEditor } from "./src/lib/cellar-actions";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (!supabaseConfigured) return <SetupScreen />;
  if (loadingSession) return <LoadingScreen label="Kopplar upp vinkällaren..." />;
  if (!session) return <AuthScreen />;
  return <CellarScreen session={session} />;
}

function CellarScreen({ session }: { session: Session }) {
  const data = useCellarData(session.user.id);
  const filters = useCellarFilters(data.wines, data.storageSpaceById);
  const images = useImagePicker();
  const storage = useStorageSelection(data.storageSpaces, data.wines);
  const catalog = useCatalogWorkflow({
    sessionUserId: session.user.id,
    wines: data.wines,
    fetchCatalogEntriesByName: data.fetchCatalogEntriesByName,
    matchCatalogByText: data.matchCatalogByText,
    takePhoto: images.takePhoto,
  });

  // --- Local UI state ---
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState("lamm");

  // --- Catalog editor ---
  const [catalogEditorVisible, setCatalogEditorVisible] = useState(false);
  const [catalogEditorDraft, setCatalogEditorDraft] = useState<CatalogEditorDraft | null>(null);
  const [savingCatalogEdit, setSavingCatalogEdit] = useState(false);

  // --- Drink modal ---
  const [drinkModalVisible, setDrinkModalVisible] = useState(false);
  const [selectedDrinkWine, setSelectedDrinkWine] = useState<WineRecord | null>(null);
  const [drinkRating, setDrinkRating] = useState("");
  const [drinkNotes, setDrinkNotes] = useState("");
  const [drinkConsumedDate, setDrinkConsumedDate] = useState("");
  const [drinkImageUri, setDrinkImageUri] = useState("");
  const [savingDrinkHistory, setSavingDrinkHistory] = useState(false);

  // --- Edit wine modal ---
  const [editWineVisible, setEditWineVisible] = useState(false);
  const [editingWine, setEditingWine] = useState<WineRecord | null>(null);
  const [editWineDraft, setEditWineDraft] = useState<WineDraft | null>(null);
  const [savingWineEdit, setSavingWineEdit] = useState(false);

  // --- Tasting mode ---
  const [tastingMode, setTastingMode] = useState(false);
  const [tastingRating, setTastingRating] = useState("");
  const [tastingDate, setTastingDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingTasting, setSavingTasting] = useState(false);
  const [wsatData, setWsatData] = useState<WsatTastingData | null>(null);
  const [wsatModalVisible, setWsatModalVisible] = useState(false);

  // --- Save states ---
  const [saving, setSaving] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);

  // --- Derived ---
  const selectedEditStorageSpace = data.storageSpaces.find((s) => s.id === (editWineDraft?.storageSpaceId || "")) ?? null;
  const mealRecommendations = useMemo(() => buildMealRecommendations(data.wines, selectedMeal), [selectedMeal, data.wines]);

  // --- Modal openers ---

  function openDrinkModal(wine: WineRecord) {
    setSelectedDrinkWine(wine);
    setDrinkRating("");
    setDrinkNotes("");
    setDrinkConsumedDate(new Date().toISOString().slice(0, 10));
    setDrinkImageUri("");
    setDrinkModalVisible(true);
  }

  function closeDrinkModal() {
    if (savingDrinkHistory) return;
    setDrinkModalVisible(false);
    setSelectedDrinkWine(null);
  }

  async function openEditWineModal(wine: WineRecord) {
    let freshWine = wine;
    if (wine.image_path && !wine.image_url) {
      const [hydrated] = await hydrateWineRecords([wine as any]);
      freshWine = hydrated;
    }
    setEditingWine(freshWine);
    setEditWineDraft(toWineDraft(freshWine));
    setEditWineVisible(true);
  }

  function closeEditWineModal() {
    if (savingWineEdit) return;
    setEditWineVisible(false);
    setEditingWine(null);
    setEditWineDraft(null);
  }

  // --- Save wrappers ---

  async function handleSaveWine() {
    setSaving(true);
    try {
      const ok = await saveNewWine({
        userId: session.user.id,
        draft,
        storageSpaceId: storage.selectedStorageSpaceId,
        storageRow: storage.selectedStorageRow,
        storageSlot: storage.selectedStorageSlot,
        selectedCatalogNameEntry: catalog.selectedCatalogNameEntry,
      });
      if (ok) {
        setDraft(defaultDraft);
        catalog.setSelectedCatalogNameEntry(null);
        await Promise.all([data.fetchWines(), data.fetchCatalogEntries(), data.fetchReferenceOptions()]);
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTasting() {
    setSavingTasting(true);
    try {
      const ok = await saveTastingEntry({ userId: session.user.id, draft, tastingRating, tastingDate, wsatData });
      if (ok) {
        setDraft(defaultDraft);
        setTastingRating("");
        setTastingDate(new Date().toISOString().slice(0, 10));
        setWsatData(null);
        await data.fetchHistoryEntries();
      }
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingTasting(false);
    }
  }

  async function handleSaveDrink() {
    if (!selectedDrinkWine) return;
    setSavingDrinkHistory(true);
    try {
      await saveDrinkEntry({
        userId: session.user.id, wine: selectedDrinkWine,
        rating: drinkRating, notes: drinkNotes,
        consumedDate: drinkConsumedDate, imageUri: drinkImageUri,
        setWines: data.setWines,
      });
      await data.fetchHistoryEntries();
      closeDrinkModal();
    } catch (error) {
      Alert.alert("Kunde inte spara historiken", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingDrinkHistory(false);
    }
  }

  async function handleSaveWineEdit() {
    if (!editingWine || !editWineDraft) return;
    setSavingWineEdit(true);
    try {
      await saveWineEditEntry({ userId: session.user.id, editingWine, editWineDraft, setWines: data.setWines });
      await data.fetchCatalogEntries();
      closeEditWineModal();
    } catch (error) {
      if (error instanceof Error && (error.message === "missing_name" || error.message === "missing_fields")) return;
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingWineEdit(false);
    }
  }

  async function handleSaveCatalogEditor() {
    if (!catalogEditorDraft) return;
    setSavingCatalogEdit(true);
    try {
      await saveCatalogEditorEntry(catalogEditorDraft);
      setCatalogEditorVisible(false);
      setCatalogEditorDraft(null);
      await data.fetchCatalogEntries();
    } catch (error) {
      if (error instanceof Error && error.message === "missing_name") return;
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  async function handleDeleteCatalogEntry(id: string) {
    setSavingCatalogEdit(true);
    try {
      await deleteCatalogEntryById(id);
      if (catalogEditorDraft?.id === id) { setCatalogEditorVisible(false); setCatalogEditorDraft(null); }
      await data.fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte ta bort produkt", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Kunde inte logga ut", error.message);
  }

  // --- Render ---

  let activePanel = (
    <MinKallarePanel
      styles={styles} stats={data.stats}
      searchQuery={filters.searchQuery}
      selectedPairingFilter={filters.selectedPairingFilter}
      selectedCountryFilter={filters.selectedCountryFilter}
      selectedRegionFilter={filters.selectedRegionFilter}
      selectedTypeFilter={filters.selectedTypeFilter}
      selectedVintageFilter={filters.selectedVintageFilter}
      pairingOptions={data.pairingOptions} countryOptions={data.countryOptions}
      regionOptions={data.regionOptions} typeOptions={data.typeOptions}
      vintageOptions={data.vintageOptions}
      storageSpaces={data.storageSpaces}
      storageSpaceBottleCounts={data.storageSpaceBottleCounts}
      filteredWines={filters.filteredWines} loading={data.loading}
      storageSpaceById={data.storageSpaceById}
      onRefreshStats={data.fetchWines}
      onSearchChange={filters.setSearchQuery}
      onPairingChange={filters.setSelectedPairingFilter}
      onCountryChange={filters.setSelectedCountryFilter}
      onRegionChange={filters.setSelectedRegionFilter}
      onTypeChange={filters.setSelectedTypeFilter}
      onVintageChange={filters.setSelectedVintageFilter}
      onSignOut={signOut}
      onOpenSystembolaget={openSystembolaget}
      onEditWine={openEditWineModal}
      onDrinkWine={openDrinkModal}
      onDeleteWine={data.deleteWine}
      storageSpaceDraft={data.storageSpaceDraft}
      savingStorageSpace={data.savingStorageSpace}
      onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      onSaveStorageSpace={() => data.saveStorageSpace(storage.selectedStorageSpaceId, storage.setSelectedStorageSpaceId, storage.setSelectedStorageRow, storage.setSelectedStorageSlot)}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
    />
  );

  if (activeSection === "history") {
    activePanel = (
      <HistoryPanel styles={styles} historyEntries={data.historyEntries} loadingHistory={data.loadingHistory} storageSpaceById={data.storageSpaceById} />
    );
  } else if (activeSection === "meal") {
    activePanel = (
      <MealPlannerPanel styles={styles} selectedMeal={selectedMeal} mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
        onWinePress={(wine) => { setHighlightedWineId(wine.id); setActiveSection("cellar"); }}
      />
    );
  } else if (activeSection === "add") {
    activePanel = (
      <AddWinePanel
        styles={styles} draft={draft}
        storageSpaces={data.storageSpaces}
        selectedStorageSpace={storage.selectedStorageSpace}
        selectedStorageSpaceId={storage.selectedStorageSpaceId}
        selectedStorageRow={storage.selectedStorageRow}
        selectedStorageSlot={storage.selectedStorageSlot}
        storageSpaceById={data.storageSpaceById}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions}
        effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows}
        regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        lookupBusy={catalog.lookupBusy}
        lookupMessage={catalog.lookupMessage}
        catalogSuggestion={catalog.catalogSuggestion}
        importMode={catalog.importMode}
        importSelection={catalog.importSelection}
        saving={saving}
        selectedCatalogNameEntry={catalog.selectedCatalogNameEntry}
        onDraftChange={(patch) => setDraft((c) => catalog.updateDraft(c, patch))}
        onNameSelected={(name, producer) => catalog.handleWineNameSelected(name, producer, setDraft)}
        onBarcodeChange={(value) =>
          setDraft((current) => {
            const nextDraft = catalog.updateDraft(current, { barcode: value });
            void catalog.maybeSuggestCatalogMatch(nextDraft);
            return nextDraft;
          })
        }
        onArticleNumberChange={(value) =>
          setDraft((current) => {
            const nextDraft = catalog.updateDraft(current, { systembolagetProductId: value });
            void catalog.maybeSuggestCatalogMatch(nextDraft);
            return nextDraft;
          })
        }
        occupiedPositions={storage.getOccupiedPositions(storage.selectedStorageSpaceId, storage.selectedStorageRow)}
        onStorageSpaceChange={storage.changeStorageSpace}
        onStorageRowChange={storage.changeStorageRow}
        onStorageSlotChange={storage.setSelectedStorageSlot}
        storageSpaceDraft={data.storageSpaceDraft}
        savingStorageSpace={data.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={() => data.saveStorageSpace(storage.selectedStorageSpaceId, storage.setSelectedStorageSpaceId, storage.setSelectedStorageRow, storage.setSelectedStorageSlot)}
        onStartBarcodeScanner={catalog.startBarcodeScanner}
        onOpenSystembolaget={openSystembolaget}
        onSetImportMode={catalog.setImportMode}
        onApplyCatalogSuggestion={() => catalog.applyCatalogSuggestion(draft, setDraft)}
        onToggleImportField={catalog.toggleImportField}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onSaveWine={handleSaveWine}
        tastingMode={tastingMode}
        onTastingModeChange={setTastingMode}
        tastingRating={tastingRating}
        onTastingRatingChange={setTastingRating}
        tastingDate={tastingDate}
        onTastingDateChange={setTastingDate}
        onSaveTasting={handleSaveTasting}
        savingTasting={savingTasting}
        wsatData={wsatData}
        onOpenWsat={() => setWsatModalVisible(true)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <PrivacyPolicyModal visible={privacyVisible} styles={styles} onClose={() => setPrivacyVisible(false)} />
      <BarcodeScannerModal visible={catalog.scannerVisible} styles={styles} onClose={() => catalog.setScannerVisible(false)} onBarcodeScanned={({ data: d }) => catalog.handleBarcodeScanned(d, draft, setDraft)} onLabelPhoto={() => catalog.handleLabelPhoto(setDraft)} />
      <LabelMatchPickerModal visible={catalog.labelPickerVisible} matches={catalog.labelMatches} onSelect={(m) => catalog.handleLabelMatchSelected(m, setDraft)} onDismiss={() => catalog.handleLabelMatchDismissed(setDraft)} />
      <WsatTastingModal visible={wsatModalVisible} wineType={draft.type} initialData={wsatData} onSave={(d) => setWsatData(d)} onClose={() => setWsatModalVisible(false)} />
      <VintagePickerModal visible={catalog.vintagePickerVisible} wineName={catalog.vintagePickerWineName} vintages={catalog.vintagePickerOptions} onSelectVintage={(e) => catalog.handleVintageSelected(e, setDraft)} onAddNew={() => catalog.handleVintageAddNew(setDraft)} onClose={() => catalog.setVintagePickerVisible(false)} styles={styles} />
      <CatalogEditorModal
        visible={catalogEditorVisible} styles={styles} draft={catalogEditorDraft} saving={savingCatalogEdit}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions} effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows} regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        onClose={() => { setCatalogEditorVisible(false); setCatalogEditorDraft(null); }}
        onSave={handleSaveCatalogEditor}
        onChange={(patch) => setCatalogEditorDraft((c) => (c ? { ...c, ...patch } : c))}
      />
      <DrinkWineModal
        visible={drinkModalVisible} styles={styles} wine={selectedDrinkWine}
        rating={drinkRating} notes={drinkNotes} consumedDate={drinkConsumedDate}
        imageUri={drinkImageUri} saving={savingDrinkHistory}
        onClose={closeDrinkModal} onRatingChange={setDrinkRating} onNotesChange={setDrinkNotes}
        onConsumedDateChange={setDrinkConsumedDate}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setDrinkImageUri(uri); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setDrinkImageUri(uri); }}
        onConfirm={handleSaveDrink}
      />
      <EditWineModal
        visible={editWineVisible} styles={styles} draft={editWineDraft}
        storageSpaces={data.storageSpaces} selectedStorageSpace={selectedEditStorageSpace}
        storageSpaceById={data.storageSpaceById}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions} effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows} regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        saving={savingWineEdit}
        occupiedPositions={storage.getOccupiedPositions(editWineDraft?.storageSpaceId || "", editWineDraft?.storageRow || "1", editingWine?.id)}
        storageSpaceDraft={data.storageSpaceDraft} savingStorageSpace={data.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={() => data.saveStorageSpace(editWineDraft?.storageSpaceId || "", (id) => setEditWineDraft((c) => c ? { ...c, storageSpaceId: id } : c), (v) => setEditWineDraft((c) => c ? { ...c, storageRow: v } : c), (v) => setEditWineDraft((c) => c ? { ...c, storageSlot: v } : c))}
        onClose={closeEditWineModal}
        onDraftChange={(patch) => setEditWineDraft((c) => (c ? { ...c, ...patch } : c))}
        onStorageSpaceChange={(spaceId) => setEditWineDraft((c) => c ? { ...c, storageSpaceId: spaceId, storageRow: "1", storageSlot: "1" } : c)}
        onStorageRowChange={(value) => setEditWineDraft((c) => (c ? { ...c, storageRow: value, storageSlot: "1" } : c))}
        onStorageSlotChange={(value) => setEditWineDraft((c) => (c ? { ...c, storageSlot: value } : c))}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setEditWineDraft((c) => c ? { ...c, imageUri: uri } : c); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setEditWineDraft((c) => c ? { ...c, imageUri: uri } : c); }}
        onRemoveImage={() => setEditWineDraft((c) => c ? { ...c, imageUri: "" } : c)}
        onSave={handleSaveWineEdit}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
        {activePanel}
        <RNView style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 8 }}>
          <RNText style={{ color: "#8f8178", fontSize: 10, opacity: 0.6 }}>{BUILD_VERSION}</RNText>
          <Pressable onPress={() => setPrivacyVisible(true)}>
            <RNText style={{ color: "#8f8178", fontSize: 10, textDecorationLine: "underline" }}>Integritetspolicy</RNText>
          </Pressable>
        </RNView>
      </ScrollView>
      <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={setActiveSection} />
    </SafeAreaView>
  );
}
