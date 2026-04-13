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
import { DiscoverTab } from "./src/components/discover-tab";
import { SuccessOverlay, useSuccessOverlay } from "./src/components/success-overlay";

// Lazy-load heavy components
const TastingSessionPanel = lazy(() => import("./src/components/tasting-session-modal").then(m => ({ default: m.TastingSessionPanel })));
import { CellarProvider, useCellar } from "./src/contexts/CellarContext";
import { TastingProvider, useTasting } from "./src/contexts/TastingContext";
import { ModalLayer } from "./src/components/modal-layer";
import { HistoryTab } from "./src/components/history-tab";
import { TastingTab } from "./src/components/tasting-tab";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { StorageProps } from "./src/types/panel-prop-groups";
import { colors, styles } from "./src/styles/theme";
import { BUILD_VERSION } from "./src/lib/build-version";
import { LoadingScreen, SetupScreen } from "./src/screens/auth";
import { LandingScreen } from "./src/screens/landing";
import { useImagePicker } from "./src/hooks/useImagePicker";
import { useStorageSelection } from "./src/hooks/useStorageSelection";
import { useDrinkWineModal } from "./src/hooks/useDrinkWineModal";
import { useEditWineModal } from "./src/hooks/useEditWineModal";
import { useCatalogEditorModal } from "./src/hooks/useCatalogEditorModal";
import { useModalToggle } from "./src/hooks/useModalToggle";
import { useProfile } from "./src/hooks/useProfile";
import { usePublicProfile } from "./src/hooks/usePublicProfile";
import { DisplayNamePrompt } from "./src/components/display-name-prompt";
import { ProfilePage } from "./src/components/profile-page";
import { CellarLookupModal } from "./src/components/cellar-lookup-modal";
import { PublicProfilePage } from "./src/components/public-profile-page";
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
  return (
    <CellarProvider userId={session.user.id}>
      <TastingProvider userId={session.user.id}>
        <CellarScreenInner session={session} pendingJoinCode={pendingJoinCode} onJoinCodeConsumed={onJoinCodeConsumed} />
      </TastingProvider>
    </CellarProvider>
  );
}

function CellarScreenInner({ session, pendingJoinCode, onJoinCodeConsumed }: { session: Session; pendingJoinCode: string | null; onJoinCodeConsumed: () => void }) {
  const ctx = useCellar();
  const tasting = useTasting();
  const images = useImagePicker();
  const storage = useStorageSelection(ctx.storageSpaces, ctx.wines);
  const success = useSuccessOverlay();
  const userProfile = useProfile(session.user.id);
  const [profileVisible, setProfileVisible] = useState(false);
  const [ocrDebugVisible, setOcrDebugVisible] = useState(false);
  const [cellarLookupVisible, setCellarLookupVisible] = useState(false);
  const [peekCode, setPeekCode] = useState<string | null>(null);
  const publicProfile = usePublicProfile(peekCode);
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
    tasting.joinSession(pendingJoinCode);
  }, [pendingJoinCode]);

  const drink = useDrinkWineModal({
    userId: session.user.id,
    setHistoryEntries: ctx.setHistoryEntries,
    setWines: ctx.setWines,
    showSuccess: success.show,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const edit = useEditWineModal({
    userId: session.user.id,
    setWines: ctx.setWines,
    fetchCatalogEntries: ctx.fetchCatalogEntries,
    showSuccess: success.show,
    storageSpaces: ctx.storageSpaces,
    saveStorageSpace: ctx.saveStorageSpace,
    getOccupiedPositions: storage.getOccupiedPositions,
    pickImageFromLibrary: images.pickImageFromLibrary,
    takePhoto: images.takePhoto,
  });
  const catalogEditor = useCatalogEditorModal({
    fetchCatalogEntries: ctx.fetchCatalogEntries,
  });
  const privacy = useModalToggle();
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await ctx.refreshAll();
    setRefreshing(false);
  }, [ctx.refreshAll]);

  const storageProps: StorageProps = useMemo(() => ({
    storageSpaces: ctx.storageSpaces, storageSpaceById: ctx.storageSpaceById, storageSpaceBottleCounts: ctx.storageSpaceBottleCounts,
    storageSpaceDraft: ctx.storageSpaceDraft, savingStorageSpace: ctx.savingStorageSpace,
    onStorageSpaceDraftChange: (patch: Partial<import("./src/types/cellar-drafts").StorageSpaceDraft>) => ctx.setStorageSpaceDraft((c) => ({ ...c, ...patch })),
    onSaveStorageSpace: async () => { const newId = await ctx.saveStorageSpace(); if (newId) { storage.setSelectedStorageSpaceId(newId); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } success.show("storage_saved"); },
    onUpdateStorageSpace: ctx.updateStorageSpace,
    onDeleteStorageSpace: async (id: string) => { const ok = await ctx.deleteStorageSpace(id); if (ok) { if (storage.selectedStorageSpaceId === id) { storage.setSelectedStorageSpaceId(""); storage.setSelectedStorageRow("1"); storage.setSelectedStorageSlot("1"); } } },
  }), [ctx, storage, success]);

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

  if (peekCode && publicProfile.profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
          <RNView style={styles.panel}>
            <PublicProfilePage
              profile={publicProfile.profile}
              summary={publicProfile.summary}
              wines={publicProfile.wines}
              tasteProfile={publicProfile.tasteProfile}
              onClose={() => setPeekCode(null)}
            />
          </RNView>
        </ScrollView>
        <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={(s) => { setPeekCode(null); setActiveSection(s); }} />
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
              onProfileUpdated={(p) => userProfile.setProfile(p)}
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
      stats={ctx.stats}
      onRefreshStats={ctx.refreshWines}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
      onHighlightWine={setHighlightedWineId}
    />
  );
  if (activeSection === "history") {
    activePanel = (
      <HistoryTab hidden={false}
        endedSessions={tasting.sessions.filter((ses) => ses.status === "ended")}
        refreshing={refreshing} onRefresh={onRefresh}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
  } else if (activeSection === "tasting") {
    if (tasting.activeSession) {
      activePanel = (
        <Suspense fallback={<ActivityIndicator style={{ flex: 1, justifyContent: "center" }} color={colors.accent} />}>
          <TastingSessionPanel
            styles={styles} userId={session.user.id}
            sessions={tasting.sessions} loading={tasting.loading} toasts={tasting.toasts}
            activeSession={tasting.activeSession} activeWines={tasting.activeWines}
            activeTastings={tasting.activeTastings} wines={ctx.wines}
            searchWineNames={ctx.searchCatalogWineNames}
            onBack={() => { tasting.closeSession(); }}
            onFetchSessions={tasting.fetchSessions} onCreateSession={tasting.createSession}
            onJoinSession={tasting.joinSession} onOpenSession={tasting.openSession}
            onCloseSession={tasting.closeSession} onSetActiveWines={tasting.setActiveWines}
            onSetActiveTastings={tasting.setActiveTastings} onSetActiveSession={tasting.setActiveSession}
            onOpenWset={tasting.openWset} wsetData={tasting.wsetData}
            onSessionEnded={() => { tasting.closeSession(); setActiveSection("history"); }}
          />
        </Suspense>
      );
    } else {
      activePanel = (
        <TastingTab
          sessions={tasting.sessions}
          loading={tasting.loading}
          onCreateSession={tasting.createSession}
          onJoinSession={tasting.joinSession}
          onOpenSession={tasting.openSession}
          onOpenProfile={() => setProfileVisible(true)}
          onFetchSessions={tasting.fetchSessions}
        />
      );
    }
  } else if (activeSection === "add") {
    activePanel = (
      <AddWineTab
        hidden={false}
        isAnonymous={session.user.is_anonymous ?? false}
        onOpenProfile={() => setProfileVisible(true)}
        onNavigateToCellar={() => setActiveSection("cellar")}
        images={images}
        storage={storage}
        success={success}
        sessionUserId={session.user.id}
      />
    );
  } else if (activeSection === "discover") {
    activePanel = (
      <DiscoverTab onOpenProfile={() => setProfileVisible(true)} />
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
      <ModalLayer drink={drink} edit={edit} catalogEditor={catalogEditor} privacy={privacy} />
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
      <Pressable
        style={peekBtnStyle}
        onPress={() => setCellarLookupVisible(true)}
        accessibilityLabel="Titta in i en källare"
      >
        <RNText style={peekBtnText}>👥</RNText>
      </Pressable>
      {cellarLookupVisible && (
        <CellarLookupModal
          onSelectProfile={(p) => { setCellarLookupVisible(false); setPeekCode(p.cellar_code ?? null); }}
          onClose={() => setCellarLookupVisible(false)}
        />
      )}
    </SafeAreaView>
  );
}

const peekBtnStyle = {
  position: "absolute" as const,
  bottom: 68,
  right: 16,
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: "rgba(0,0,0,0.55)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const peekBtnText = { fontSize: 20, lineHeight: 24 };
