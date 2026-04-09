import "react-native-url-polyfill/auto";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, Text as RNText, View as RNView } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { buildMealRecommendations } from "./src/lib/cellar-helpers";
import { openSystembolaget, saveNewWine, updateHistoryEntry } from "./src/lib/cellar-actions";
import { hydrateWineRecords } from "./src/lib/wine-helpers";
import { confirmAction, showError } from "./src/lib/show-error";
import { BottomTabBar, HistoryPanel, MealPlannerPanel } from "./src/components/cellar-sections";
import { MinKallarePanel } from "./src/components/min-kallare-panel";
import { BarcodeScannerModal, CatalogEditorModal, DrinkWineModal, EditHistoryModal, VintagePickerModal } from "./src/components/cellar-workflows";
import { AddWinePanel } from "./src/components/add-wine-panel";
import { EditWineModal } from "./src/components/edit-wine-modal";
import { WsetTastingModal } from "./src/components/wset-tasting-modal";
import { TastingSessionPanel } from "./src/components/tasting-session-modal";
import { LabelMatchPickerModal } from "./src/components/label-match-picker";
import { PrivacyPolicyModal } from "./src/components/privacy-policy-modal";
import { SuccessOverlay, useSuccessOverlay } from "./src/components/success-overlay";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { WineHistoryRecord } from "./src/types/wine-history";
import { defaultDraft, type WineDraft } from "./src/types/cellar-drafts";
import { colors, styles } from "./src/styles/theme";
import { BUILD_VERSION } from "./src/lib/build-version";
import { LoadingScreen, SetupScreen } from "./src/screens/auth";
import { LandingScreen } from "./src/screens/landing";
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
import { useSessionWset } from "./src/hooks/useSessionWset";
import { useProfile } from "./src/hooks/useProfile";
import { DisplayNamePrompt } from "./src/components/display-name-prompt";
import { ProfilePage } from "./src/components/profile-page";
import { OcrDebugPage } from "./src/components/ocr-debug-page";
import { parseJoinCodeFromUrl } from "./src/lib/join-link";

function useWebStyles() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Load Cormorant Garamond + Caveat for hand-drawn accents
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = [
      "body { background-color: #FDFAF6; }",
      'div[tabindex="0"] { transition: opacity 0.15s; }',
      'div[tabindex="0"]:hover { opacity: 0.85; }',
      'div[tabindex="0"]:active { opacity: 0.65 !important; transition: opacity 0.05s; }',
    ].join("\n");
    document.head.appendChild(style);
  }, []);
}

export default function App() {
  useWebStyles();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() => parseJoinCodeFromUrl());
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
  if (!session) return <LandingScreen pendingJoinCode={pendingJoinCode} />;
  return <CellarScreen session={session} pendingJoinCode={pendingJoinCode} onJoinCodeConsumed={() => setPendingJoinCode(null)} />;
}

function CellarScreen({ session, pendingJoinCode, onJoinCodeConsumed }: { session: Session; pendingJoinCode: string | null; onJoinCodeConsumed: () => void }) {
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
  const userProfile = useProfile(session.user.id);
  const [profileVisible, setProfileVisible] = useState(false);
  const [ocrDebugVisible, setOcrDebugVisible] = useState(false);
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVersionTap = useCallback(() => {
    versionTapCount.current++;
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
    if (versionTapCount.current >= 5) {
      versionTapCount.current = 0;
      setOcrDebugVisible(true);
    } else {
      versionTapTimer.current = setTimeout(() => { versionTapCount.current = 0; }, 1500);
    }
  }, []);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);

  // Auto-join session from /join/:code URL
  useEffect(() => {
    if (!pendingJoinCode) return;
    onJoinCodeConsumed();
    setTastingSessionsVisible(true);
    tastingSessions.joinSession(pendingJoinCode);
  }, [pendingJoinCode]);

  const drink = useDrinkWineModal({
    userId: session.user.id,
    setHistoryEntries: data.setHistoryEntries,
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
  const sessionWset = useSessionWset();
  const [editingHistory, setEditingHistory] = useState<WineHistoryRecord | null>(null);
  const [editHistorySaving, setEditHistorySaving] = useState(false);

  const handleSaveHistoryEdit = useCallback(async (fields: { rating: string; notes: string; date: string; quantity: string }) => {
    if (!editingHistory) return;
    setEditHistorySaving(true);
    const result = await updateHistoryEntry({
      id: editingHistory.id,
      rating: fields.rating ? Number(fields.rating) : null,
      tasting_notes: fields.notes.trim() || null,
      consumed_at: fields.date,
      quantity_consumed: Math.max(1, Number(fields.quantity) || 1),
    });
    setEditHistorySaving(false);
    if (result.error) { showError("Kunde inte spara ändringen", result.error); return; }
    data.setHistoryEntries((prev) => prev.map((e) => (e.id === editingHistory.id ? { ...e, ...result.data! } : e)));
    setEditingHistory(null);
    success.show("history_edited");
  }, [editingHistory, data, success]);

  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([data.fetchWines(), data.fetchStorageSpaces(), data.fetchHistoryEntries(), data.fetchCatalogEntries(), data.fetchReferenceOptions()]);
    setRefreshing(false);
  }, [data.fetchWines, data.fetchStorageSpaces, data.fetchHistoryEntries, data.fetchCatalogEntries, data.fetchReferenceOptions]);
  const [tastingSessionsVisible, setTastingSessionsVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const tasting = useAddWineTasting({
    userId: session.user.id,
    draft,
    resetDraft: useCallback(() => setDraft(defaultDraft), []),
    setHistoryEntries: data.setHistoryEntries,
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
    const savedRow = result.data!;
    const [hydrated] = await hydrateWineRecords([savedRow]);
    data.setWines(prev => [hydrated, ...prev]);
    data.mergeReferenceOptions(savedRow);
    success.show("wine_added");
    if (Platform.OS === "web") {
      if (window.confirm("Vinet är sparat! Vill du gå till din källare?")) setActiveSection("cellar");
    } else {
      Alert.alert("Vinet är sparat!", "Vad vill du göra nu?", [
        { text: "Lägg till fler", style: "default" },
        { text: "Gå till min källare", onPress: () => setActiveSection("cellar") },
      ]);
    }
  }

  async function handleOpenSystembolaget(productId: string) {
    const result = await openSystembolaget(productId);
    if (result.error) showError("Kunde inte öppna länken", result.error);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) showError("Kunde inte logga ut", error.message);
  }

  if (ocrDebugVisible) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <OcrDebugPage onClose={() => setOcrDebugVisible(false)} />
      </SafeAreaView>
    );
  }

  if (profileVisible && userProfile.profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
          <RNView style={styles.panel}>
            <ProfilePage
              profile={userProfile.profile}
              onUpdateName={userProfile.updateName}
              onSignOut={signOut}
              onBack={() => setProfileVisible(false)}
            />
          </RNView>
        </ScrollView>
        <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={(s) => { setProfileVisible(false); setActiveSection(s); }} />
      </SafeAreaView>
    );
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
      selectedGrapeFilter={filters.selectedGrapeFilter}
      pairingOptions={data.pairingOptions} countryOptions={data.countryOptions}
      regionOptions={data.regionOptions} typeOptions={data.typeOptions}
      vintageOptions={data.vintageOptions} grapeOptions={data.cellarGrapeOptions}
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
      onGrapeChange={filters.setSelectedGrapeFilter}
      onSignOut={() => setProfileVisible(true)}
      onOpenSystembolaget={handleOpenSystembolaget}
      onEditWine={edit.actions.open}
      onDrinkWine={drink.actions.open}
      onDeleteWine={(id, imagePath) => confirmAction("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?", () => data.deleteWine(id, imagePath))}
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
      refreshing={refreshing}
      onRefresh={onRefresh}
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
        onOpenWset={sessionWset.open} wsetData={sessionWset.data}
        onSessionEnded={() => { setTastingSessionsVisible(false); setActiveSection("history"); }}
        onUpdateParticipantNames={tastingSessions.updateParticipantNames}
      />
    );
  } else if (activeSection === "history") {
    activePanel = <HistoryPanel styles={styles} historyEntries={data.historyEntries} loadingHistory={data.loadingHistory} storageSpaceById={data.storageSpaceById}
      endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
      refreshing={refreshing} onRefresh={onRefresh} hasMore={data.hasMoreHistory} onLoadMore={data.fetchMoreHistory}
      onEditEntry={setEditingHistory} onOpenProfile={() => setProfileVisible(true)}
    />;
  } else if (activeSection === "meal") {
    activePanel = (
      <MealPlannerPanel styles={styles} wines={data.wines} selectedMeal={selectedMeal} mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
        onWinePress={(wine) => { setHighlightedWineId(wine.id); setActiveSection("cellar"); }}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
  } else if (activeSection === "add") {
    activePanel = (
      <AddWinePanel
        styles={styles} draft={draft}
        storageSpaces={data.storageSpaces}
        wines={data.wines}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions}
        effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows}
        regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        lookupBusy={catalog.lookupBusy}
        lookupMessage={catalog.lookupMessage}
        saving={saving}
        onDraftChange={(patch) => setDraft((c) => catalog.updateDraft(c, patch))}
        onNameSelected={(name, producer) => catalog.handleWineNameSelected(name, producer, setDraft)}
        onArticleNumberChange={(value) => {
          setDraft((current) => catalog.updateDraft(current, { systembolagetProductId: value }));
          void catalog.maybeSuggestCatalogMatch({ ...draft, systembolagetProductId: value });
        }}
        storageSpaceDraft={data.storageSpaceDraft}
        savingStorageSpace={data.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => data.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
        onSaveStorageSpace={async () => { const newId = await data.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); }}
        onPositionChange={(spaceId, row, slot) => { storage.setSelectedStorageSpaceId(spaceId); storage.setSelectedStorageRow(row); storage.setSelectedStorageSlot(slot); }}
        onScanLabel={() => catalog.handleLabelPhoto(setDraft)}
        onOpenSystembolaget={handleOpenSystembolaget}
        onChooseImage={async () => { const uri = await images.pickImageFromLibrary(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onTakePhoto={async () => { const uri = await images.takePhoto(); if (uri) setDraft((c) => ({ ...c, imageUri: uri })); }}
        onSaveWine={handleSaveWine}
        onOpenProfile={() => setProfileVisible(true)}
        {...tasting.panelProps}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <DisplayNamePrompt
        visible={userProfile.needsDisplayName && !promptDismissed}
        saving={promptSaving}
        onSave={async (name) => {
          setPromptSaving(true);
          const ok = await userProfile.saveDisplayName(name);
          setPromptSaving(false);
          if (ok) setPromptDismissed(true);
        }}
        onSkip={async () => {
          setPromptSaving(true);
          const guestName = `Gäst${String(Math.floor(1000 + Math.random() * 9000))}`;
          await userProfile.saveDisplayName(guestName);
          setPromptSaving(false);
          setPromptDismissed(true);
        }}
      />
      <SuccessOverlay config={success.config} onDone={success.clear} />
      <PrivacyPolicyModal visible={privacy.visible} styles={styles} onClose={privacy.close} />
      <BarcodeScannerModal visible={catalog.scannerVisible} styles={styles} onClose={() => catalog.setScannerVisible(false)} onBarcodeScanned={({ data: d }) => catalog.handleBarcodeScanned(d, draft, setDraft)} onLabelPhoto={() => catalog.handleLabelPhoto(setDraft)} />
      <LabelMatchPickerModal visible={catalog.labelPickerVisible} matches={catalog.labelMatches} onSelect={(m) => catalog.handleLabelMatchSelected(m, setDraft)} onDismiss={() => catalog.handleLabelMatchDismissed(setDraft)} />
      <WsetTastingModal {...tasting.wsetProps} wineType={draft.type} />
      <VintagePickerModal visible={catalog.vintagePickerVisible} wineName={catalog.vintagePickerWineName} vintages={catalog.vintagePickerOptions} loading={catalog.vintagePickerLoading} onSelectVintage={(e) => catalog.handleVintageSelected(e, setDraft)} onAddNew={() => catalog.handleVintageAddNew(setDraft)} onClose={() => catalog.setVintagePickerVisible(false)} styles={styles} />
      <CatalogEditorModal
        {...catalogEditor.modalProps} styles={styles}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions} effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows} regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
      />
      <WsetTastingModal {...drink.wsetProps} />
      <DrinkWineModal {...drink.modalProps} styles={styles} />
      <EditHistoryModal visible={editingHistory !== null} styles={styles} entry={editingHistory} saving={editHistorySaving}
        onClose={() => setEditingHistory(null)} onSave={handleSaveHistoryEdit}
      />
      <WsetTastingModal {...sessionWset.wsetProps} />
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
      {activeSection === "history" || (activeSection === "cellar" && !tastingSessionsVisible) ? (
        <RNView style={[styles.scrollFlex, { backgroundColor: colors.bg }]}>
          {activePanel}
        </RNView>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={[styles.scrollFlex, { backgroundColor: colors.bg }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>
          {activePanel}
          <RNView style={styles.footerRow}>
            <Pressable onPress={handleVersionTap}><RNText style={styles.footerVersion}>{BUILD_VERSION}</RNText></Pressable>
            <Pressable onPress={privacy.open}><RNText style={styles.footerLink}>Integritetspolicy</RNText></Pressable>
          </RNView>
        </ScrollView>
      )}
      <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={setActiveSection} />
    </SafeAreaView>
  );
}
