import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, Text as RNText, View as RNView } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { buildMealRecommendations } from "./src/lib/cellar-helpers";
import { openSystembolaget, saveNewWine } from "./src/lib/cellar-actions";
import { showError } from "./src/lib/show-error";
import { BottomTabBar, HistoryPanel, MealPlannerPanel } from "./src/components/cellar-sections";
import { MinKallarePanel } from "./src/components/min-kallare-panel";
import { BarcodeScannerModal, CatalogEditorModal, DrinkWineModal, VintagePickerModal } from "./src/components/cellar-workflows";
import { AddWinePanel } from "./src/components/add-wine-panel";
import { EditWineModal } from "./src/components/edit-wine-modal";
import { WsatTastingModal } from "./src/components/wsat-tasting-modal";
import { TastingSessionPanel } from "./src/components/tasting-session-modal";
import { LabelMatchPickerModal } from "./src/components/label-match-picker";
import { PrivacyPolicyModal } from "./src/components/privacy-policy-modal";
import { SuccessOverlay, useSuccessOverlay } from "./src/components/success-overlay";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import { defaultDraft, type WineDraft } from "./src/types/cellar-drafts";
import { styles } from "./src/styles/theme";
import { BUILD_VERSION } from "./src/lib/build-version";
import { AuthScreen, LoadingScreen, SetupScreen } from "./src/screens/auth";
import { useCellarData } from "./src/hooks/useCellarData";
import { useCellarFilters } from "./src/hooks/useCellarFilters";
import { useImagePicker } from "./src/hooks/useImagePicker";
import { useStorageSelection } from "./src/hooks/useStorageSelection";
import { useCatalogWorkflow } from "./src/hooks/useCatalogWorkflow";
import { useTastingSessions } from "./src/hooks/useTastingSessions";
import { useDrinkWineModal } from "./src/hooks/useDrinkWineModal";
import { useEditWineModal } from "./src/hooks/useEditWineModal";
import { useCatalogEditorModal } from "./src/hooks/useCatalogEditorModal";
import { useModalToggle } from "./src/hooks/useModalToggle";
import { useAddWineTasting } from "./src/hooks/useAddWineTasting";
import { useSessionWsat } from "./src/hooks/useSessionWsat";

function useWebMeta() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = document;
    doc.documentElement.lang = "sv";
    const meta = (name: string, content: string) => {
      let el = doc.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = doc.createElement("meta"); el.name = name; doc.head.appendChild(el); }
      el.content = content;
    };
    const og = (prop: string, content: string) => {
      let el = doc.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
      if (!el) { el = doc.createElement("meta"); el.setAttribute("property", prop); doc.head.appendChild(el); }
      el.content = content;
    };
    meta("description", "Håll koll på din vinsamling, hitta rätt vin till maten och spara smaknoteringar.");
    meta("theme-color", "#2b1714");
    og("og:title", "Vinkällaren");
    og("og:description", "Din digitala vinsamling — gratis och utan reklam.");
    og("og:type", "website");
    const style = doc.createElement("style");
    style.textContent = [
      'div[tabindex="0"] { transition: opacity 0.15s, filter 0.15s; }',
      'div[tabindex="0"]:hover { filter: brightness(0.92); }',
      'div[tabindex="0"]:active { opacity: 0.7 !important; filter: brightness(0.85); transition: opacity 0.05s; }',
    ].join("\n");
    doc.head.appendChild(style);
  }, []);
}

export default function App() {
  useWebMeta();
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
  const success = useSuccessOverlay();
  const catalog = useCatalogWorkflow({
    sessionUserId: session.user.id,
    wines: data.wines,
    fetchCatalogEntriesByName: data.fetchCatalogEntriesByName,
    matchCatalogByText: data.matchCatalogByText,
    takePhoto: images.takePhoto,
  });
  const tastingSessions = useTastingSessions(session.user.id);

  const drink = useDrinkWineModal({
    userId: session.user.id,
    fetchHistoryEntries: data.fetchHistoryEntries,
    setWines: data.setWines,
    showSuccess: success.show,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const edit = useEditWineModal({
    userId: session.user.id,
    setWines: data.setWines,
    fetchCatalogEntries: data.fetchCatalogEntries,
    showSuccess: success.show,
    storageSpaces: data.storageSpaces,
    saveStorageSpace: data.saveStorageSpace,
    getOccupiedPositions: storage.getOccupiedPositions,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const catalogEditor = useCatalogEditorModal({
    fetchCatalogEntries: data.fetchCatalogEntries,
  });
  const privacy = useModalToggle();
  const sessionWsat = useSessionWsat();

  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([data.fetchWines(), data.fetchStorageSpaces(), data.fetchHistoryEntries()]);
    setRefreshing(false);
  }, [data.fetchWines, data.fetchStorageSpaces, data.fetchHistoryEntries]);
  const [tastingSessionsVisible, setTastingSessionsVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const tasting = useAddWineTasting({
    userId: session.user.id,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    fetchHistoryEntries: data.fetchHistoryEntries,
    showSuccess: success.show,
  });

  const mealRecommendations = useMemo(() => buildMealRecommendations(data.wines, selectedMeal), [selectedMeal, data.wines]);

  async function handleSaveWine() {
    setSaving(true);
    const result = await saveNewWine({
      userId: session.user.id,
      draft,
      storageSpaceId: storage.selectedStorageSpaceId,
      storageRow: storage.selectedStorageRow,
      storageSlot: storage.selectedStorageSlot,
      selectedCatalogNameEntry: catalog.selectedCatalogNameEntry,
    });
    setSaving(false);
    if (result.error) { showError("Kunde inte spara", result.error); return; }
    setDraft(defaultDraft); catalog.setSelectedCatalogNameEntry(null);
    storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1");
    await Promise.all([data.fetchWines(), data.fetchCatalogEntries(), data.fetchReferenceOptions()]);
    success.show("wine_added");
    Alert.alert("Vinet är sparat!", "Vad vill du göra nu?", [
      { text: "Lägg till fler", style: "default" },
      { text: "Gå till min källare", onPress: () => setActiveSection("cellar") },
    ]);
  }

  async function handleOpenSystembolaget(productId: string) {
    const result = await openSystembolaget(productId);
    if (result.error) showError("Kunde inte öppna länken", result.error);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Kunde inte logga ut", error.message);
  }

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
      onOpenSystembolaget={handleOpenSystembolaget}
      onEditWine={edit.actions.open}
      onDrinkWine={drink.actions.open}
      onDeleteWine={(id, imagePath) => {
            Alert.alert("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?", [
              { text: "Avbryt", style: "cancel" },
              { text: "Ta bort", style: "destructive", onPress: () => data.deleteWine(id, imagePath) },
            ]);
          }}
      storageSpaceDraft={data.storageSpaceDraft}
      savingStorageSpace={data.savingStorageSpace}
      onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      onSaveStorageSpace={async () => { const newId = await data.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
      onUpdateStorageSpace={data.updateStorageSpace}
      onDeleteStorageSpace={async (id) => { const ok = await data.deleteStorageSpace(id); if (ok) { if (storage.selectedStorageSpaceId === id) { storage.setSelectedStorageSpaceId(""); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } if (filters.selectedStorageSpaceFilterId === id) { filters.setSelectedStorageSpaceFilterId(""); } } }}
      onNavigateToAdd={() => setActiveSection("add")}
      onOpenTastingSessions={() => { setTastingSessionsVisible(true); tastingSessions.fetchSessions(); }}
      selectedStorageSpaceFilterId={filters.selectedStorageSpaceFilterId}
      onStorageSpaceFilterChange={filters.setSelectedStorageSpaceFilterId}
      hasMoreWines={data.hasMoreWines}
      onLoadMoreWines={data.fetchMoreWines}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
    />
  );
  if (activeSection === "cellar" && tastingSessionsVisible) {
    activePanel = (
      <TastingSessionPanel
        styles={styles} userId={session.user.id}
        sessions={tastingSessions.sessions} loading={tastingSessions.loading} toasts={tastingSessions.toasts}
        activeSession={tastingSessions.activeSession} activeWines={tastingSessions.activeWines}
        activeTastings={tastingSessions.activeTastings} wines={data.wines}
        searchWineNames={data.searchCatalogWineNames}
        onBack={() => { setTastingSessionsVisible(false); tastingSessions.closeSession(); }}
        onFetchSessions={tastingSessions.fetchSessions} onCreateSession={tastingSessions.createSession}
        onJoinSession={tastingSessions.joinSession} onOpenSession={tastingSessions.openSession}
        onCloseSession={tastingSessions.closeSession} onSetActiveWines={tastingSessions.setActiveWines}
        onSetActiveTastings={tastingSessions.setActiveTastings} onSetActiveSession={tastingSessions.setActiveSession}
        onOpenWsat={sessionWsat.open} wsatData={sessionWsat.data}
        onSessionEnded={() => { setTastingSessionsVisible(false); setActiveSection("history"); }}
      />
    );
  } else if (activeSection === "history") {
    activePanel = <HistoryPanel styles={styles} historyEntries={data.historyEntries} loadingHistory={data.loadingHistory} storageSpaceById={data.storageSpaceById}
      endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
      onOpenSession={(ses) => { setTastingSessionsVisible(true); setActiveSection("cellar"); tastingSessions.openSession(ses); }}
    />;
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
        onSaveStorageSpace={async () => { const newId = await data.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
        onStartBarcodeScanner={catalog.startBarcodeScanner}
        onOpenSystembolaget={handleOpenSystembolaget}
        onSetImportMode={catalog.setImportMode}
        onApplyCatalogSuggestion={() => catalog.applyCatalogSuggestion(draft, setDraft)}
        onToggleImportField={catalog.toggleImportField}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onSaveWine={handleSaveWine}
        {...tasting.panelProps}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <SuccessOverlay config={success.config} onDone={success.clear} />
      <PrivacyPolicyModal visible={privacy.visible} styles={styles} onClose={privacy.close} />
      <BarcodeScannerModal visible={catalog.scannerVisible} styles={styles} onClose={() => catalog.setScannerVisible(false)} onBarcodeScanned={({ data: d }) => catalog.handleBarcodeScanned(d, draft, setDraft)} onLabelPhoto={() => catalog.handleLabelPhoto(setDraft)} />
      <LabelMatchPickerModal visible={catalog.labelPickerVisible} matches={catalog.labelMatches} onSelect={(m) => catalog.handleLabelMatchSelected(m, setDraft)} onDismiss={() => catalog.handleLabelMatchDismissed(setDraft)} />
      <WsatTastingModal {...tasting.wsatProps} wineType={draft.type} />
      <VintagePickerModal visible={catalog.vintagePickerVisible} wineName={catalog.vintagePickerWineName} vintages={catalog.vintagePickerOptions} onSelectVintage={(e) => catalog.handleVintageSelected(e, setDraft)} onAddNew={() => catalog.handleVintageAddNew(setDraft)} onClose={() => catalog.setVintagePickerVisible(false)} styles={styles} />
      <CatalogEditorModal
        {...catalogEditor.modalProps} styles={styles}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions} effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows} regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
      />
      <WsatTastingModal {...drink.wsatProps} />
      <DrinkWineModal {...drink.modalProps} styles={styles} />
      <WsatTastingModal {...sessionWsat.wsatProps} />
      <EditWineModal
        {...edit.modalProps} styles={styles}
        storageSpaces={data.storageSpaces}
        storageSpaceById={data.storageSpaceById}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions} effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows} regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        storageSpaceDraft={data.storageSpaceDraft} savingStorageSpace={data.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} />}>
        {activePanel}
        <RNView style={styles.footerRow}>
          <RNText style={styles.footerVersion}>{BUILD_VERSION}</RNText>
          <Pressable onPress={privacy.open}><RNText style={styles.footerLink}>Integritetspolicy</RNText></Pressable>
        </RNView>
      </ScrollView>
      <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={setActiveSection} />
    </SafeAreaView>
  );
}
