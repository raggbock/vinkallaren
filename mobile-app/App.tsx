import "react-native-url-polyfill/auto";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, Text as RNText, View as RNView } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { showError } from "./src/lib/show-error";
import { BottomTabBar } from "./src/components/cellar-sections";
import { CellarTab } from "./src/components/cellar-tab";
import { AddWineTab } from "./src/components/add-wine-tab";
import { SuccessOverlay, useSuccessOverlay } from "./src/components/success-overlay";

// Lazy-load heavy modals (only loaded when opened)
const CatalogEditorModal = lazy(() => import("./src/components/cellar-workflows").then(m => ({ default: m.CatalogEditorModal })));
const DrinkWineModal = lazy(() => import("./src/components/cellar-workflows").then(m => ({ default: m.DrinkWineModal })));
const EditWineModal = lazy(() => import("./src/components/edit-wine-modal").then(m => ({ default: m.EditWineModal })));
const WsetTastingModal = lazy(() => import("./src/components/wset-tasting-modal").then(m => ({ default: m.WsetTastingModal })));
const TastingSessionPanel = lazy(() => import("./src/components/tasting-session-modal").then(m => ({ default: m.TastingSessionPanel })));
const PrivacyPolicyModal = lazy(() => import("./src/components/privacy-policy-modal").then(m => ({ default: m.PrivacyPolicyModal })));
import { CellarContext, type CellarContextValue } from "./src/contexts/CellarContext";
import { HistoryTab } from "./src/components/history-tab";
import { TastingTab } from "./src/components/tasting-tab";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { StorageProps } from "./src/types/panel-prop-groups";
import { colors, styles } from "./src/styles/theme";
import { BUILD_VERSION } from "./src/lib/build-version";
import { LoadingScreen, SetupScreen } from "./src/screens/auth";
import { LandingScreen } from "./src/screens/landing";
import { useWines } from "./src/hooks/useWines";
import { useHistory } from "./src/hooks/useHistory";
import { useCatalog } from "./src/hooks/useCatalog";
import { useReferenceOptions } from "./src/hooks/useReferenceOptions";
import { useStorageSpaces } from "./src/hooks/useStorageSpaces";
import { useImagePicker } from "./src/hooks/useImagePicker";
import { useStorageSelection } from "./src/hooks/useStorageSelection";
import { useTastingSessions } from "./src/hooks/useTastingSessions";
import { useDrinkWineModal } from "./src/hooks/useDrinkWineModal";
import { useEditWineModal } from "./src/hooks/useEditWineModal";
import { useCatalogEditorModal } from "./src/hooks/useCatalogEditorModal";
import { useModalToggle } from "./src/hooks/useModalToggle";
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
      '[aria-modal="true"] *, [aria-modal="true"] { opacity: 1 !important; }',
    ].join("\n");
    document.head.appendChild(style);

    // Paper grain texture on panel backgrounds (rgb(248, 241, 232))
    const svgData = encodeURIComponent(
      "<svg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'>" +
      "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter>" +
      "<rect width='100%' height='100%' filter='url(#n)' opacity='0.06'/></svg>"
    );
    const grainBg = `url("data:image/svg+xml,${svgData}")`;
    const PANEL_COLOR = "rgb(240, 235, 227)"; // tokens.surfaceAlt (#F0EBE3)

    function applyGrain(el: HTMLElement) {
      if (getComputedStyle(el).backgroundColor === PANEL_COLOR && !el.style.backgroundImage) {
        el.style.backgroundImage = grainBg;
        el.style.backgroundSize = "200px";
      }
    }

    // Apply to existing panels
    document.querySelectorAll<HTMLElement>("div").forEach(applyGrain);

    // Watch for new panels added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.tagName === "DIV") applyGrain(node);
            node.querySelectorAll<HTMLElement>("div").forEach(applyGrain);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
}

function AppRoot() {
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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppRoot />
    </GestureHandlerRootView>
  );
}

function CellarScreen({ session, pendingJoinCode, onJoinCodeConsumed }: { session: Session; pendingJoinCode: string | null; onJoinCodeConsumed: () => void }) {
  const wineData = useWines();
  const historyData = useHistory();
  const storageData = useStorageSpaces(session.user.id);
  const catalogData = useCatalog(session.user.id, wineData.wines, wineData.loading);
  const refOptions = useReferenceOptions();
  const storageSpaceById = useMemo(() => new Map(storageData.storageSpaces.map((s) => [s.id, s])), [storageData.storageSpaces]);
  const cellarCtx: CellarContextValue = useMemo(() => ({
    userId: session.user.id,
    wines: wineData.wines,
    winesLoading: wineData.loading,
    storageSpaces: storageData.storageSpaces,
    storageSpaceById,
    refreshWines: wineData.fetchWines,
    fetchMoreWines: wineData.fetchMoreWines,
    hasMoreWines: wineData.hasMoreWines,
    setWines: wineData.setWines,
    deleteWine: wineData.deleteWine,
    storageSpaceBottleCounts: wineData.storageSpaceBottleCounts,
    pairingOptions: wineData.pairingOptions,
    countryOptions: wineData.countryOptions,
    regionOptions: wineData.regionOptions,
    typeOptions: wineData.typeOptions,
    vintageOptions: wineData.vintageOptions,
    cellarGrapeOptions: wineData.cellarGrapeOptions,
    stats: wineData.stats,
  }), [session.user.id, wineData, storageData.storageSpaces, storageSpaceById]);
  const images = useImagePicker();
  const storage = useStorageSelection(storageData.storageSpaces, wineData.wines);
  const success = useSuccessOverlay();
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
    setActiveSection("tasting");
    tastingSessions.joinSession(pendingJoinCode);
  }, [pendingJoinCode]);

  const deleteStorageSpace = useCallback(async (id: string): Promise<boolean> => {
    const ok = await storageData.deleteStorageSpace(id);
    if (ok) await wineData.fetchWines();
    return ok;
  }, [storageData, wineData]);
  const drink = useDrinkWineModal({
    userId: session.user.id,
    setHistoryEntries: historyData.setHistoryEntries,
    setWines: wineData.setWines,
    showSuccess: success.show,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const edit = useEditWineModal({
    userId: session.user.id,
    setWines: wineData.setWines,
    fetchCatalogEntries: catalogData.fetchCatalogEntries,
    showSuccess: success.show,
    storageSpaces: storageData.storageSpaces,
    saveStorageSpace: storageData.saveStorageSpace,
    getOccupiedPositions: storage.getOccupiedPositions,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const catalogEditor = useCatalogEditorModal({
    fetchCatalogEntries: catalogData.fetchCatalogEntries,
  });
  const privacy = useModalToggle();
  const sessionWset = useSessionWset();
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([wineData.fetchWines(), storageData.fetchStorageSpaces(), historyData.fetchHistoryEntries(), catalogData.fetchCatalogEntries(), refOptions.fetchReferenceOptions()]);
    setRefreshing(false);
  }, [wineData.fetchWines, storageData.fetchStorageSpaces, historyData.fetchHistoryEntries, catalogData.fetchCatalogEntries, refOptions.fetchReferenceOptions]);


  const storageProps: StorageProps = useMemo(() => ({
    storageSpaces: storageData.storageSpaces, storageSpaceById, storageSpaceBottleCounts: wineData.storageSpaceBottleCounts,
    storageSpaceDraft: storageData.storageSpaceDraft, savingStorageSpace: storageData.savingStorageSpace,
    onStorageSpaceDraftChange: (patch: Partial<import("./src/types/cellar-drafts").StorageSpaceDraft>) => storageData.setStorageSpaceDraft((c) => ({ ...c, ...patch })),
    onSaveStorageSpace: async () => { const newId = await storageData.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); },
    onUpdateStorageSpace: storageData.updateStorageSpace,
    onDeleteStorageSpace: async (id: string) => { const ok = await deleteStorageSpace(id); if (ok) { if (storage.selectedStorageSpaceId === id) { storage.setSelectedStorageSpaceId(""); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } } },
  }), [storageData, storageSpaceById, wineData.storageSpaceBottleCounts, storage, deleteStorageSpace, success]);

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
    <CellarTab
      hidden={activeSection !== "cellar"}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onNavigateToAdd={() => setActiveSection("add")}
      onOpenProfile={() => setProfileVisible(true)}
      onEditWine={edit.actions.open}
      onDrinkWine={drink.actions.open}
      storage={storageProps}
      stats={wineData.stats}
      onRefreshStats={wineData.fetchWines}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
      onHighlightWine={setHighlightedWineId}
    />
  );
  if (activeSection === "history") {
    activePanel = (
      <HistoryTab hidden={false}
        historyData={historyData}
        endedSessions={tastingSessions.sessions.filter((ses) => ses.status === "ended")}
        refreshing={refreshing} onRefresh={onRefresh}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
  } else if (activeSection === "tasting") {
    if (tastingSessions.activeSession) {
      activePanel = (
        <Suspense fallback={<ActivityIndicator style={{ flex: 1, justifyContent: "center" }} color={colors.accent} />}>
          <TastingSessionPanel
            styles={styles} userId={session.user.id}
            sessions={tastingSessions.sessions} loading={tastingSessions.loading} toasts={tastingSessions.toasts}
            activeSession={tastingSessions.activeSession} activeWines={tastingSessions.activeWines}
            activeTastings={tastingSessions.activeTastings} wines={wineData.wines}
            searchWineNames={catalogData.searchCatalogWineNames}
            onBack={() => { tastingSessions.closeSession(); }}
            onFetchSessions={tastingSessions.fetchSessions} onCreateSession={tastingSessions.createSession}
            onJoinSession={tastingSessions.joinSession} onOpenSession={tastingSessions.openSession}
            onCloseSession={tastingSessions.closeSession} onSetActiveWines={tastingSessions.setActiveWines}
            onSetActiveTastings={tastingSessions.setActiveTastings} onSetActiveSession={tastingSessions.setActiveSession}
            onOpenWset={sessionWset.open} wsetData={sessionWset.data}
            onSessionEnded={() => { tastingSessions.closeSession(); setActiveSection("history"); }}
          />
        </Suspense>
      );
    } else {
      activePanel = (
        <TastingTab
          sessions={tastingSessions.sessions}
          loading={tastingSessions.loading}
          onCreateSession={tastingSessions.createSession}
          onJoinSession={tastingSessions.joinSession}
          onOpenSession={tastingSessions.openSession}
          onOpenProfile={() => setProfileVisible(true)}
          onFetchSessions={tastingSessions.fetchSessions}
        />
      );
    }
  } else if (activeSection === "add") {
    activePanel = (
      <AddWineTab
        hidden={false}
        onOpenProfile={() => setProfileVisible(true)}
        onNavigateToCellar={() => setActiveSection("cellar")}
        catalogData={catalogData}
        refOptions={refOptions}
        images={images}
        storageData={storageData}
        storage={storage}
        success={success}
        wineData={{ wines: wineData.wines, setWines: wineData.setWines }}
        historyData={{ setHistoryEntries: historyData.setHistoryEntries }}
        sessionUserId={session.user.id}
      />
    );
  }

  return (
    <CellarContext.Provider value={cellarCtx}>
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
      <Suspense fallback={null}>
      <PrivacyPolicyModal visible={privacy.visible} styles={styles} onClose={privacy.close} />
      <CatalogEditorModal
        {...catalogEditor.modalProps} styles={styles}
        searchWineNames={catalogData.searchCatalogWineNames}
        effectiveCountryOptions={refOptions.effectiveCountryOptions} effectiveRegionOptions={refOptions.effectiveRegionOptions}
        effectiveGrapeOptions={refOptions.effectiveGrapeOptions}
        countryReferenceRows={refOptions.countryReferenceRows} regionReferenceRows={refOptions.regionReferenceRows}
        grapeReferenceRows={refOptions.grapeReferenceRows}
      />
      <WsetTastingModal {...drink.wsetProps} />
      <DrinkWineModal {...drink.modalProps} styles={styles} />
      <WsetTastingModal {...sessionWset.wsetProps} />
      <EditWineModal
        {...edit.modalProps} styles={styles}
        storageSpaces={storageData.storageSpaces}
        storageSpaceById={storageSpaceById}
        searchWineNames={catalogData.searchCatalogWineNames}
        effectiveCountryOptions={refOptions.effectiveCountryOptions} effectiveRegionOptions={refOptions.effectiveRegionOptions}
        effectiveGrapeOptions={refOptions.effectiveGrapeOptions}
        countryReferenceRows={refOptions.countryReferenceRows} regionReferenceRows={refOptions.regionReferenceRows}
        grapeReferenceRows={refOptions.grapeReferenceRows}
        storageSpaceDraft={storageData.storageSpaceDraft} savingStorageSpace={storageData.savingStorageSpace}
        onStorageSpaceDraftChange={(patch) => storageData.setStorageSpaceDraft((c) => ({ ...c, ...patch }))}
      />
      </Suspense>
      {activeSection === "history" || activeSection === "cellar" ? (
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
    </CellarContext.Provider>
  );
}
