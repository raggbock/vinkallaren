import "react-native-url-polyfill/auto";

import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { cacheCatalogEntry, findCatalogMatch, type ProductCatalogEntry } from "./src/lib/product-catalog";
import { GRAPE_VARIETIES, WINE_COUNTRIES, WINE_REGIONS } from "./src/lib/reference-data";
import {
  buildMealRecommendations,
  buildMealSuggestions,
  buildNumericOptions,
  buildPairingOptions,
  buildStats,
  buildStorageSpaceBottleCounts,
  buildSystembolagetProductUrl,
  buildValueOptions,
  buildVintageOptions,
  emptyToNull,
  getSuggestedPairings,
  getWineStoragePlacementLabel,
  mergeTagText,
  normalizeLookupValue,
  parseTags,
  resolveImportedValue,
  toNumberOrNull,
} from "./src/lib/cellar-helpers";
import {
  LabeledInput,
  MetricCard,
} from "./src/components/form-controls";
import {
  CellarSectionNav,
  MealPlannerPanel,
  ProductCatalogPanel,
  StatsPanel,
  StorageSpacesPanel,
  WineCollectionPanel,
} from "./src/components/cellar-sections";
import { AddWinePanel, BarcodeScannerModal, CatalogEditorModal } from "./src/components/cellar-workflows";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { CatalogEditorDraft, ImportFieldSelection, ImportMode, StorageSpaceDraft, WineDraft } from "./src/types/cellar-drafts";
import type { ProductCatalogWineRow } from "./src/types/product-catalog";
import type { ReferenceOptionRow } from "./src/types/reference-data";
import type { StorageSpaceInsert, StorageSpaceRow } from "./src/types/storage-space";
import type { WineInsert, WineRecord, WineRow } from "./src/types/wine";

type AuthMode = "signin" | "signup";

const defaultDraft: WineDraft = {
  name: "",
  producer: "",
  country: "",
  region: "",
  grape: "",
  vintage: "",
  quantity: "1",
  type: "Rött",
  drinkBy: "",
  location: "",
  storageSpaceId: "",
  storageRow: "1",
  storageSlot: "1",
  barcode: "",
  systembolagetProductId: "",
  tags: "",
  foodPairings: "",
  notes: "",
  imageUri: "",
};

const defaultStorageSpaceDraft: StorageSpaceDraft = {
  name: "",
  spaceType: "kallare",
  rowCount: "6",
  slotsPerRow: "6",
  notes: "",
};

const defaultImportSelection: ImportFieldSelection = {
  name: true,
  producer: true,
  country: true,
  region: true,
  vintage: true,
  grape: true,
  type: true,
  foodPairings: true,
  systembolagetProductId: true,
  barcode: true,
};

function toCatalogEditorDraft(entry: ProductCatalogWineRow): CatalogEditorDraft {
  return {
    id: entry.id,
    barcode: entry.barcode ?? "",
    systembolagetProductId: entry.systembolaget_product_id ?? "",
    name: entry.name,
    producer: entry.producer ?? "",
    country: entry.country ?? "",
    region: entry.region ?? "",
    grape: entry.grape ?? "",
    type: entry.type ?? "",
    vintage: entry.vintage ? String(entry.vintage) : "",
    foodPairings: entry.food_pairings.join(", "),
    sourceLabel: entry.source_label ?? "",
    sourceConfidence: entry.source_confidence ?? "high",
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!supabaseConfigured) {
    return <SetupScreen />;
  }

  if (loadingSession) {
    return <LoadingScreen label="Kopplar upp vinkällaren..." />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <CellarScreen session={session} />;
}

function SetupScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Mobilapp under uppbyggnad</Text>
        <Text style={styles.heroTitle}>Koppla in Supabase för att börja.</Text>
        <Text style={styles.heroText}>
          Lägg in <Text style={styles.mono}>EXPO_PUBLIC_SUPABASE_URL</Text> och{" "}
          <Text style={styles.mono}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> i en lokal{" "}
          <Text style={styles.mono}>.env</Text>-fil i appmappen. När de finns på plats får du inloggning, synkad databas
          och lagring i molnet.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Appmapp</Text>
          <Text style={styles.infoValue}>C:\Projects\vinkällaren\mobile-app</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.screenCentered}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#f4c38c" />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [signupNotice, setSignupNotice] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Saknar uppgifter", "Fyll i både e-post och lösenord.");
      return;
    }

    setBusy(true);
    setSignupNotice("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          throw error;
        }

        const confirmationMessage =
          "Kontot är skapat. Kolla din e-post och bekräfta adressen innan du loggar in.";

        setSignupNotice(confirmationMessage);
        setAwaitingVerification(!data.session);

        Alert.alert(
          "Konto skapat",
          data.session
            ? "Kontot skapades och du är nu inloggad."
            : confirmationMessage
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      Alert.alert("Inloggning misslyckades", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestSignIn() {
    setGuestBusy(true);
    setSignupNotice("");

    try {
      const { error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }
    } catch (error) {
      Alert.alert(
        "Gästläge gick inte att starta",
        error instanceof Error
          ? `${error.message} Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge.`
          : "Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge."
      );
    } finally {
      setGuestBusy(false);
    }
  }

  if (awaitingVerification) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.scrollContent}>
          <View style={styles.heroPanel}>
            <Text style={styles.eyebrow}>Verifiera din e-post</Text>
            <Text style={styles.heroTitle}>Ett steg kvar innan du kan logga in.</Text>
            <Text style={styles.heroText}>
              Vi har skickat ett bekräftelsemail till {email}. Öppna mailet och klicka på länken, kom sedan tillbaka och logga in.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.authNotice}>
              Hittar du inget mail? Kolla skräppost eller försök registrera igen om adressen blev fel.
            </Text>

            <Pressable
              onPress={() => {
                setAwaitingVerification(false);
                setMode("signin");
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Jag har verifierat min mail</Text>
            </Pressable>

            <Pressable onPress={handleGuestSignIn} style={styles.secondaryButton} disabled={guestBusy}>
              <Text style={styles.secondaryButtonText}>
                {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst i stället"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroPanel}>
            <Text style={styles.eyebrow}>Vinkällaren</Text>
            <Text style={styles.heroTitle}>En riktig mobilapp för din samling.</Text>
            <Text style={styles.heroText}>
              Logga in för att synka alla flaskor mellan enheter och bygga upp din källare i molnet.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setMode("signin")}
                style={[styles.segmentButton, mode === "signin" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, mode === "signin" && styles.segmentTextActive]}>Logga in</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("signup")}
                style={[styles.segmentButton, mode === "signup" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Skapa konto</Text>
              </Pressable>
            </View>

            <LabeledInput
              label="E-post"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <LabeledInput label="Lösenord" value={password} onChangeText={setPassword} secureTextEntry />

            <Pressable onPress={handleAuth} style={styles.primaryButton} disabled={busy}>
              <Text style={styles.primaryButtonText}>
                {busy ? "Arbetar..." : mode === "signup" ? "Skapa konto" : "Logga in"}
              </Text>
            </Pressable>

            {signupNotice ? <Text style={styles.authNotice}>{signupNotice}</Text> : null}

            <Pressable onPress={handleGuestSignIn} style={styles.secondaryButton} disabled={guestBusy}>
              <Text style={styles.secondaryButtonText}>
                {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst"}
              </Text>
            </Pressable>

            <Text style={styles.authFootnote}>
              Gästläge kräver att Anonymous Sign-Ins är aktiverat i ditt Supabase-projekt.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CellarScreen({ session }: { session: Session }) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [storageSpaceDraft, setStorageSpaceDraft] = useState<StorageSpaceDraft>(defaultStorageSpaceDraft);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceRow[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionRow[]>([]);
  const [catalogEditorVisible, setCatalogEditorVisible] = useState(false);
  const [catalogEditorDraft, setCatalogEditorDraft] = useState<CatalogEditorDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStorageSpaces, setLoadingStorageSpaces] = useState(true);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStorageSpace, setSavingStorageSpace] = useState(false);
  const [savingCatalogEntry, setSavingCatalogEntry] = useState(false);
  const [savingCatalogEdit, setSavingCatalogEdit] = useState(false);
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId] = useState("");
  const [selectedStorageSpaceId, setSelectedStorageSpaceId] = useState("");
  const [selectedStorageRow, setSelectedStorageRow] = useState("1");
  const [selectedStorageSlot, setSelectedStorageSlot] = useState("1");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [catalogSuggestion, setCatalogSuggestion] = useState<ProductCatalogEntry | null>(null);
  const [importSelection, setImportSelection] = useState<ImportFieldSelection>(defaultImportSelection);
  const [importMode, setImportMode] = useState<ImportMode>("custom");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [activeSection, setActiveSection] = useState<CellarSection>("overview");

  const stats = useMemo(() => buildStats(wines), [wines]);
  const grapeReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((option) => option.category === "grape")),
    [referenceOptions]
  );
  const wineNameReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((option) => option.category === "wine_name")),
    [referenceOptions]
  );
  const countryReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((option) => option.category === "country")),
    [referenceOptions]
  );
  const regionReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((option) => option.category === "region")),
    [referenceOptions]
  );
  const grapeOptions = useMemo(() => grapeReferenceRows.map((option) => option.name), [grapeReferenceRows]);
  const wineNameOptions = useMemo(() => wineNameReferenceRows.map((option) => option.name), [wineNameReferenceRows]);
  const countryReferenceOptions = useMemo(
    () => countryReferenceRows.map((option) => option.name),
    [countryReferenceRows]
  );
  const regionReferenceOptions = useMemo(
    () => regionReferenceRows.map((option) => option.name),
    [regionReferenceRows]
  );
  const effectiveGrapeOptions = grapeOptions.length > 0 ? grapeOptions : GRAPE_VARIETIES;
  const effectiveWineNameOptions = useMemo(() => {
    if (wineNameOptions.length > 0) {
      return wineNameOptions;
    }

    return Array.from(new Set([...catalogEntries.map((entry) => entry.name), ...wines.map((wine) => wine.name)])).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [catalogEntries, wineNameOptions, wines]);
  const effectiveCountryOptions = countryReferenceOptions.length > 0 ? countryReferenceOptions : WINE_COUNTRIES;
  const effectiveRegionOptions = regionReferenceOptions.length > 0 ? regionReferenceOptions : WINE_REGIONS;
  const pairingOptions = useMemo(() => buildPairingOptions(wines), [wines]);
  const countryOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.country), [wines]);
  const regionOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.region), [wines]);
  const typeOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.type), [wines]);
  const vintageOptions = useMemo(() => buildVintageOptions(wines), [wines]);
  const storageSpaceById = useMemo(() => new Map(storageSpaces.map((space) => [space.id, space])), [storageSpaces]);
  const storageSpaceBottleCounts = useMemo(() => buildStorageSpaceBottleCounts(wines), [wines]);
  const selectedStorageSpace = storageSpaces.find((space) => space.id === selectedStorageSpaceId) ?? null;
  const mealSuggestions = useMemo(() => buildMealSuggestions(wines), [wines]);
  const mealRecommendations = useMemo(
    () => buildMealRecommendations(wines, selectedMeal),
    [selectedMeal, wines]
  );

  function goToSection(section: CellarSection) {
    setActiveSection(section);
  }

  const filteredWines = useMemo(() => {
    return wines.filter((wine) => {
      const matchesPairing =
        selectedPairingFilter === "Alla" || wine.food_pairings.includes(selectedPairingFilter);
      const matchesCountry = selectedCountryFilter === "Alla" || wine.country === selectedCountryFilter;
      const matchesRegion = selectedRegionFilter === "Alla" || wine.region === selectedRegionFilter;
      const matchesType = selectedTypeFilter === "Alla" || wine.type === selectedTypeFilter;
      const matchesVintage =
        selectedVintageFilter === "Alla" || String(wine.vintage ?? "") === selectedVintageFilter;
      const matchesStorageSpace =
        !selectedStorageSpaceFilterId || wine.storage_space_id === selectedStorageSpaceFilterId;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [
          wine.name,
          wine.producer,
          wine.country,
          wine.region,
          wine.grape,
          wine.type,
          wine.cellar_location,
          getWineStoragePlacementLabel(wine, storageSpaceById),
          storageSpaceById.get(wine.storage_space_id ?? "")?.name,
          ...wine.food_pairings,
          ...wine.tags,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return (
        matchesPairing &&
        matchesCountry &&
        matchesRegion &&
        matchesType &&
        matchesVintage &&
        matchesStorageSpace &&
        matchesSearch
      );
    });
  }, [
    selectedStorageSpaceFilterId,
    searchQuery,
    selectedCountryFilter,
    selectedPairingFilter,
    selectedRegionFilter,
    selectedTypeFilter,
    selectedVintageFilter,
    storageSpaceById,
    wines,
  ]);

  useEffect(() => {
    void fetchWines();
    void fetchStorageSpaces();
    void fetchCatalogEntries();
    void fetchReferenceOptions();
  }, []);

  useEffect(() => {
    if (storageSpaces.length > 0 && !selectedStorageSpaceId) {
      setSelectedStorageSpaceId(storageSpaces[0].id);
      setSelectedStorageRow("1");
      setSelectedStorageSlot("1");
    }
  }, [selectedStorageSpaceId, storageSpaces]);

  useEffect(() => {
    if (!selectedStorageSpaceId) {
      return;
    }

    const selectedSpace = storageSpaces.find((space) => space.id === selectedStorageSpaceId);

    if (!selectedSpace) {
      return;
    }

    const rowNumber = Number(selectedStorageRow);
    const slotNumber = Number(selectedStorageSlot);

    if (!Number.isFinite(rowNumber) || rowNumber < 1 || rowNumber > selectedSpace.row_count) {
      setSelectedStorageRow("1");
    }

    if (!Number.isFinite(slotNumber) || slotNumber < 1 || slotNumber > selectedSpace.slots_per_row) {
      setSelectedStorageSlot("1");
    }
  }, [selectedStorageRow, selectedStorageSlot, selectedStorageSpaceId, storageSpaces]);

  async function fetchWines() {
    setLoading(true);

    const { data, error } = await supabase
      .from("wines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Kunde inte hämta viner", error.message);
      setLoading(false);
      return;
    }

    setWines(await hydrateWineRecords((data ?? []) as WineRow[]));
    setLoading(false);
  }

  async function fetchStorageSpaces() {
    setLoadingStorageSpaces(true);

    const { data, error } = await supabase
      .from("storage_spaces")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      Alert.alert("Kunde inte hämta förvaringsplatser", error.message);
      setLoadingStorageSpaces(false);
      return;
    }

    setStorageSpaces((data ?? []) as StorageSpaceRow[]);
    setLoadingStorageSpaces(false);
  }

  async function fetchCatalogEntries() {
    setLoadingCatalogEntries(true);

    const { data, error } = await supabase
      .from("product_catalog_wines")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(12);

    if (error) {
      Alert.alert("Kunde inte hämta produktkatalogen", error.message);
      setLoadingCatalogEntries(false);
      return;
    }

    setCatalogEntries((data ?? []) as ProductCatalogWineRow[]);
    setLoadingCatalogEntries(false);
  }

  async function fetchReferenceOptions() {
    const { data, error } = await supabase
      .from("reference_options")
      .select("*")
      .in("category", ["grape", "country", "region", "wine_name"])
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return;
    }

    setReferenceOptions((data ?? []) as ReferenceOptionRow[]);
  }

  function openCatalogEditor(entry: ProductCatalogWineRow) {
    setCatalogEditorDraft(toCatalogEditorDraft(entry));
    setCatalogEditorVisible(true);
  }

  function closeCatalogEditor() {
    setCatalogEditorVisible(false);
    setCatalogEditorDraft(null);
  }

  async function saveCatalogEditor() {
    if (!catalogEditorDraft) {
      return;
    }

    if (!catalogEditorDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in ett namn innan du sparar katalogposten.");
      return;
    }

    if (!catalogEditorDraft.barcode.trim()) {
      Alert.alert("Streckkod saknas", "Lägg in streckkoden innan du sparar katalogposten.");
      return;
    }

    setSavingCatalogEdit(true);

    try {
      const { error } = await supabase
        .from("product_catalog_wines")
        .update({
          barcode: emptyToNull(catalogEditorDraft.barcode),
          systembolaget_product_id: emptyToNull(catalogEditorDraft.systembolagetProductId),
          name: catalogEditorDraft.name.trim(),
          producer: emptyToNull(catalogEditorDraft.producer),
          country: emptyToNull(catalogEditorDraft.country),
          region: emptyToNull(catalogEditorDraft.region),
          grape: emptyToNull(catalogEditorDraft.grape),
          type: emptyToNull(catalogEditorDraft.type),
          vintage: toNumberOrNull(catalogEditorDraft.vintage),
          food_pairings: parseTags(catalogEditorDraft.foodPairings),
          source_label: emptyToNull(catalogEditorDraft.sourceLabel),
          source_confidence: emptyToNull(catalogEditorDraft.sourceConfidence) || "high",
        })
        .eq("id", catalogEditorDraft.id);

      if (error) {
        throw error;
      }

      closeCatalogEditor();
      await fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  function deleteCatalogEntry(entry: ProductCatalogWineRow) {
    Alert.alert(
      "Ta bort produkt?",
      `Vill du ta bort ${entry.name} från katalogen?`,
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Ta bort",
          style: "destructive",
          onPress: () => {
            void deleteCatalogEntryConfirmed(entry.id);
          },
        },
      ]
    );
  }

  async function deleteCatalogEntryConfirmed(id: string) {
    setSavingCatalogEdit(true);

    try {
      const { error } = await supabase.from("product_catalog_wines").delete().eq("id", id);

      if (error) {
        throw error;
      }

      if (catalogEditorDraft?.id === id) {
        closeCatalogEditor();
      }

      await fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte ta bort produkt", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  async function saveWine() {
    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill lägga till.");
      return;
    }

    setSaving(true);

    try {
      let imagePath: string | null = null;

      if (draft.imageUri) {
        imagePath = await uploadWineImage(session.user.id, draft.imageUri);
      }

      const payload: WineInsert = {
        user_id: session.user.id,
        name: draft.name.trim(),
        producer: emptyToNull(draft.producer),
        country: emptyToNull(draft.country),
        region: emptyToNull(draft.region),
        grape: emptyToNull(draft.grape),
        vintage: toNumberOrNull(draft.vintage),
        quantity: Math.max(1, Number(draft.quantity) || 1),
        type: draft.type.trim() || "Rött",
        drink_by_year: toNumberOrNull(draft.drinkBy),
        cellar_location: emptyToNull(draft.location),
        storage_space_id: emptyToNull(selectedStorageSpaceId),
        storage_row: selectedStorageSpaceId ? toNumberOrNull(selectedStorageRow) : null,
        storage_slot: selectedStorageSpaceId ? toNumberOrNull(selectedStorageSlot) : null,
        barcode: emptyToNull(draft.barcode),
        systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
        tags: parseTags(draft.tags),
        food_pairings: parseTags(draft.foodPairings),
        pairing_source: "manual",
        notes: emptyToNull(draft.notes),
        image_path: imagePath,
      };

      const { error } = await supabase.from("wines").insert(payload);

      if (error) {
        throw error;
      }

      await cacheWineDraftAsCatalogEntry(payload, session.user.id);

      setDraft(defaultDraft);
      await Promise.all([fetchWines(), fetchCatalogEntries()]);
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  async function saveStorageSpace() {
    if (!storageSpaceDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in namnet på förvaringsplatsen.");
      return;
    }

    const rowCount = Number(storageSpaceDraft.rowCount);
    const slotsPerRow = Number(storageSpaceDraft.slotsPerRow);

    if (!Number.isFinite(rowCount) || rowCount < 1 || !Number.isFinite(slotsPerRow) || slotsPerRow < 1) {
      Alert.alert("Ogiltiga mått", "Ange minst 1 rad och 1 plats per rad.");
      return;
    }

    setSavingStorageSpace(true);

    try {
      const payload: StorageSpaceInsert = {
        user_id: session.user.id,
        name: storageSpaceDraft.name.trim(),
        space_type: storageSpaceDraft.spaceType.trim() || "kallare",
        row_count: rowCount,
        slots_per_row: slotsPerRow,
        notes: emptyToNull(storageSpaceDraft.notes),
      };

      const { data, error } = await supabase
        .from("storage_spaces")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      setStorageSpaceDraft(defaultStorageSpaceDraft);

      if (data?.id) {
        setSelectedStorageSpaceId(data.id);
        setSelectedStorageRow("1");
        setSelectedStorageSlot("1");
      }

      await fetchStorageSpaces();
    } catch (error) {
      Alert.alert("Kunde inte spara platsen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingStorageSpace(false);
    }
  }

  async function decrementWine(wine: WineRecord) {
    if (wine.quantity <= 1) {
      await deleteWine(wine.id, wine.image_path);
      return;
    }

    const { data, error } = await supabase
      .from("wines")
      .update({ quantity: wine.quantity - 1 })
      .eq("id", wine.id)
      .select("*")
      .single();

    if (error) {
      Alert.alert("Kunde inte uppdatera", error.message);
      return;
    }

    const [hydrated] = await hydrateWineRecords([data as WineRow]);
    setWines((current) => current.map((item) => (item.id === wine.id ? hydrated : item)));
  }

  async function deleteWine(id: string, imagePath?: string | null) {
    const { error } = await supabase.from("wines").delete().eq("id", id);

    if (error) {
      Alert.alert("Kunde inte ta bort", error.message);
      return;
    }

    if (imagePath) {
      await supabase.storage.from("wine-images").remove([imagePath]);
    }

    setWines((current) => current.filter((wine) => wine.id !== id));
  }

  async function deleteStorageSpace(id: string) {
    const { error } = await supabase.from("storage_spaces").delete().eq("id", id);

    if (error) {
      Alert.alert("Kunde inte ta bort platsen", error.message);
      return;
    }

    if (selectedStorageSpaceId === id) {
      setSelectedStorageSpaceId("");
      setSelectedStorageRow("1");
      setSelectedStorageSlot("1");
    }

    if (selectedStorageSpaceFilterId === id) {
      setSelectedStorageSpaceFilterId("");
    }

    await Promise.all([fetchStorageSpaces(), fetchWines()]);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Kunde inte logga ut", error.message);
    }
  }

  async function saveDraftToCatalog() {
    const barcode = draft.barcode.trim();
    const systembolagetProductId = draft.systembolagetProductId.trim();

    if (!barcode) {
      Alert.alert("Streckkod saknas", "Lägg in streckkoden innan du sparar produkten i katalogen.");
      return;
    }

    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Fyll i åtminstone namnet på vinet innan du sparar det i katalogen.");
      return;
    }

    setSavingCatalogEntry(true);

    try {
      const entry: ProductCatalogEntry = {
        barcode: barcode || undefined,
        systembolagetProductId: systembolagetProductId || undefined,
        name: draft.name.trim(),
        producer: emptyToNull(draft.producer) ?? undefined,
        country: emptyToNull(draft.country) ?? undefined,
        region: emptyToNull(draft.region) ?? undefined,
        grape: emptyToNull(draft.grape) ?? undefined,
        type: emptyToNull(draft.type) ?? undefined,
        vintage: toNumberOrNull(draft.vintage) ?? undefined,
        foodPairings: parseTags(draft.foodPairings),
        sourceLabel: "MinVinkällare",
        sourceConfidence: "high",
      };

      await cacheCatalogEntry(entry, session.user.id);
      setCatalogSuggestion(entry);
      setLookupMessage("Produkten sparades i katalogen. Nästa skanning ska hitta den direkt.");
      await fetchCatalogEntries();
      Alert.alert("Sparad i katalogen", "Produkten är nu sparad och kan återanvändas vid nästa streckkodsskanning.");
    } catch (error) {
      Alert.alert("Kunde inte spara i katalogen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEntry(false);
    }
  }

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Behörighet saknas", "Ge appen tillgång till bilder för att välja en flaskbild.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setDraft((current) => ({ ...current, imageUri: result.assets[0].uri }));
    }
  }

  async function maybeSuggestCatalogMatch(nextDraft: WineDraft) {
    const barcode = nextDraft.barcode.trim();
    const systembolagetProductId = nextDraft.systembolagetProductId.trim();

    if (barcode.length < 8 && systembolagetProductId.length < 4) {
      setCatalogSuggestion(null);
      setLookupMessage("");
      return null;
    }

    setLookupBusy(true);

    try {
      const match = await findCatalogMatch({
        barcode,
        systembolagetProductId,
      });
      const normalizedMatch = match && !match.barcode && barcode ? { ...match, barcode } : match;

      setCatalogSuggestion(normalizedMatch);
      setImportSelection(defaultImportSelection);
      setImportMode("custom");
      setLookupMessage(
        match
          ? `Träff hittad från ${match.sourceLabel}.`
          : barcode
            ? "Ingen träff på streckkoden ännu."
            : "Ingen träff på artikelnumret ännu."
      );

      return normalizedMatch;
    } catch (_error) {
      setCatalogSuggestion(null);
      setLookupMessage("Kunde inte hämta produktdata just nu.");
      return null;
    } finally {
      setLookupBusy(false);
    }
  }

  function applyCatalogSuggestion(mode: ImportMode = importMode) {
    if (!catalogSuggestion) {
      return;
    }

    setDraft((current) => mergeDraftWithCatalogSuggestion(current, catalogSuggestion, mode, importSelection));
  }

  function toggleImportField(field: keyof ImportFieldSelection) {
    setImportSelection((current) => ({
      ...current,
      [field]: !current[field],
    }));
    setImportMode("custom");
  }

  function shouldApplyField(field: keyof ImportFieldSelection, mode: ImportMode, currentValue: string) {
    if (mode === "all") {
      return true;
    }

    if (mode === "empty") {
      return !currentValue.trim();
    }

    return importSelection[field];
  }

  async function startBarcodeScanner() {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.location.hostname !== "localhost" &&
      window.location.protocol !== "https:"
    ) {
      Alert.alert(
        "Skanning kräver säker anslutning",
        "På mobilwebb behöver kameraskanning vanligtvis https eller localhost. Testa den hostade sidan eller Expo-appen för att använda kameran."
      );
      return;
    }

    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        Alert.alert("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
        return;
      }
    }

    setScannerVisible(true);
  }

  async function handleBarcodeScanned({ data }: { data: string }) {
    setScannerVisible(false);

    const matchedWine = wines.find((wine) => wine.barcode === data);

    setDraft((current) => {
      const nextDraft = {
        ...current,
        barcode: data,
      };

      if (!matchedWine) {
        return nextDraft;
      }

      return {
        ...nextDraft,
        name: current.name || matchedWine.name,
        producer: current.producer || matchedWine.producer || "",
        country: current.country || matchedWine.country || "",
        region: current.region || matchedWine.region || "",
        grape: current.grape || matchedWine.grape || "",
        type: current.type || matchedWine.type || "Rött",
        foodPairings:
          current.foodPairings || matchedWine.food_pairings.join(", "),
        systembolagetProductId:
          current.systembolagetProductId || matchedWine.systembolaget_product_id || "",
      };
    });

    const match = await maybeSuggestCatalogMatch({
      ...draft,
      barcode: data,
    });

    if (matchedWine) {
      Alert.alert("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
      return;
    }

    if (match) {
      await cacheCatalogEntry(match, session.user.id);
      setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
      Alert.alert(
        "Produkt hittad",
        `Jag hittade ${match.name} från ${match.sourceLabel} och fyllde i tomma fält automatiskt.`
      );
      return;
    }

    Alert.alert("Ingen produktträff", "Jag hittade ingen produktdata för den här streckkoden ännu, men streckkoden sparades i formuläret.");
  }

  async function openSystembolaget(productId: string) {
    const url = buildSystembolagetProductUrl(productId);
    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      Alert.alert("Kunde inte öppna länken", "Det gick inte att öppna Systembolaget just nu.");
      return;
    }

    await Linking.openURL(url);
  }

  let activePanel = <StatsPanel stats={stats} styles={styles} onRefresh={fetchWines} />;

  if (activeSection === "storage") {
    activePanel = (
      <StorageSpacesPanel
        styles={styles}
        storageSpaces={storageSpaces}
        storageSpaceBottleCounts={storageSpaceBottleCounts}
        storageSpaceDraft={storageSpaceDraft}
        loadingStorageSpaces={loadingStorageSpaces}
        savingStorageSpace={savingStorageSpace}
        onDraftChange={(patch) => setStorageSpaceDraft((current) => ({ ...current, ...patch }))}
        onSave={saveStorageSpace}
        onDelete={deleteStorageSpace}
      />
    );
  } else if (activeSection === "catalog") {
    activePanel = (
      <ProductCatalogPanel
        styles={styles}
        loadingCatalogEntries={loadingCatalogEntries}
        catalogEntries={catalogEntries}
        onRefresh={fetchCatalogEntries}
        onEdit={openCatalogEditor}
        onDelete={deleteCatalogEntry}
      />
    );
  } else if (activeSection === "meal") {
    activePanel = (
      <MealPlannerPanel
        styles={styles}
        selectedMeal={selectedMeal}
        mealSuggestions={mealSuggestions}
        mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
      />
    );
  } else if (activeSection === "add") {
    activePanel = (
      <AddWinePanel
        styles={styles}
        draft={draft}
        storageSpaces={storageSpaces}
        selectedStorageSpace={selectedStorageSpace}
        selectedStorageSpaceId={selectedStorageSpaceId}
        selectedStorageRow={selectedStorageRow}
        selectedStorageSlot={selectedStorageSlot}
        storageSpaceById={storageSpaceById}
        effectiveWineNameOptions={effectiveWineNameOptions}
        effectiveCountryOptions={effectiveCountryOptions}
        effectiveRegionOptions={effectiveRegionOptions}
        effectiveGrapeOptions={effectiveGrapeOptions}
        wineNameReferenceRows={wineNameReferenceRows}
        countryReferenceRows={countryReferenceRows}
        regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        lookupBusy={lookupBusy}
        lookupMessage={lookupMessage}
        catalogSuggestion={catalogSuggestion}
        importMode={importMode}
        importSelection={importSelection}
        savingCatalogEntry={savingCatalogEntry}
        saving={saving}
        onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        onBarcodeChange={(value) =>
          setDraft((current) => {
            const nextDraft = { ...current, barcode: value };
            void maybeSuggestCatalogMatch(nextDraft);
            return nextDraft;
          })
        }
        onArticleNumberChange={(value) =>
          setDraft((current) => {
            const nextDraft = { ...current, systembolagetProductId: value };
            void maybeSuggestCatalogMatch(nextDraft);
            return nextDraft;
          })
        }
        onStorageSpaceChange={(spaceId) => {
          setSelectedStorageSpaceId(spaceId);
          setSelectedStorageRow("1");
          setSelectedStorageSlot("1");
        }}
        onStorageRowChange={setSelectedStorageRow}
        onStorageSlotChange={setSelectedStorageSlot}
        onStartBarcodeScanner={startBarcodeScanner}
        onOpenSystembolaget={openSystembolaget}
        onSetImportMode={setImportMode}
        onApplyCatalogSuggestion={applyCatalogSuggestion}
        onToggleImportField={toggleImportField}
        onSaveDraftToCatalog={saveDraftToCatalog}
        onChooseImage={chooseImage}
        onSaveWine={saveWine}
      />
    );
  } else if (activeSection === "cellar") {
    activePanel = (
      <WineCollectionPanel
        styles={styles}
        searchQuery={searchQuery}
        selectedPairingFilter={selectedPairingFilter}
        selectedCountryFilter={selectedCountryFilter}
        selectedRegionFilter={selectedRegionFilter}
        selectedTypeFilter={selectedTypeFilter}
        selectedVintageFilter={selectedVintageFilter}
        selectedStorageSpaceFilterId={selectedStorageSpaceFilterId}
        pairingOptions={pairingOptions}
        countryOptions={countryOptions}
        regionOptions={regionOptions}
        typeOptions={typeOptions}
        vintageOptions={vintageOptions}
        storageSpaces={storageSpaces}
        filteredWines={filteredWines}
        loading={loading}
        storageSpaceById={storageSpaceById}
        onSearchChange={setSearchQuery}
        onPairingChange={setSelectedPairingFilter}
        onCountryChange={setSelectedCountryFilter}
        onRegionChange={setSelectedRegionFilter}
        onTypeChange={setSelectedTypeFilter}
        onVintageChange={setSelectedVintageFilter}
        onStorageSpaceFilterChange={setSelectedStorageSpaceFilterId}
        onSignOut={signOut}
        onOpenSystembolaget={openSystembolaget}
        onDecrementWine={decrementWine}
        onDeleteWine={deleteWine}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <BarcodeScannerModal
        visible={scannerVisible}
        styles={styles}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <CatalogEditorModal
        visible={catalogEditorVisible}
        styles={styles}
        draft={catalogEditorDraft}
        saving={savingCatalogEdit}
        effectiveWineNameOptions={effectiveWineNameOptions}
        effectiveCountryOptions={effectiveCountryOptions}
        effectiveRegionOptions={effectiveRegionOptions}
        effectiveGrapeOptions={effectiveGrapeOptions}
        wineNameReferenceRows={wineNameReferenceRows}
        countryReferenceRows={countryReferenceRows}
        regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        onClose={closeCatalogEditor}
        onSave={saveCatalogEditor}
        onChange={(patch) => setCatalogEditorDraft((current) => (current ? { ...current, ...patch } : current))}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.heroPanel}>
          <Text style={styles.eyebrow}>Synkad vinkällare</Text>
          <Text style={styles.heroTitle}>Alla flaskor, alltid med dig.</Text>
          <Text style={styles.heroText}>{session.user.email}</Text>

          <View style={styles.metricsRow}>
            <MetricCard value={String(stats.totalBottles)} label="Flaskor" />
            <MetricCard value={String(stats.totalLabels)} label="Olika viner" />
            <MetricCard value={String(stats.drinkSoon)} label="Drick snart" />
          </View>
        </View>

        <CellarSectionNav activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={goToSection} />

        {activePanel}
      </ScrollView>
    </SafeAreaView>
  );
}

async function hydrateWineRecords(rows: WineRow[]): Promise<WineRecord[]> {
  const paths = rows.map((row) => row.image_path).filter((value): value is string => Boolean(value));
  const signedUrlMap = new Map<string, string>();

  if (paths.length > 0) {
    const { data } = await supabase.storage.from("wine-images").createSignedUrls(paths, 60 * 60);

    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    image_url: row.image_path ? signedUrlMap.get(row.image_path) ?? null : null,
  }));
}

async function uploadWineImage(userId: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from("wine-images").upload(filePath, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

async function cacheWineDraftAsCatalogEntry(payload: WineInsert, userId: string) {
  const barcode = payload.barcode?.trim();
  const systembolagetProductId = payload.systembolaget_product_id?.trim();

  if (!barcode) {
    return;
  }

  if (!payload.name.trim()) {
    return;
  }

  await cacheCatalogEntry(
    {
      barcode,
      systembolagetProductId,
      name: payload.name,
      producer: payload.producer ?? undefined,
      country: payload.country ?? undefined,
      region: payload.region ?? undefined,
      grape: payload.grape ?? undefined,
      type: payload.type ?? undefined,
      vintage: payload.vintage ?? undefined,
      foodPairings: payload.food_pairings ?? [],
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}

function mergeDraftWithCatalogSuggestion(
  current: WineDraft,
  suggestion: ProductCatalogEntry,
  mode: ImportMode,
  selection: ImportFieldSelection
) {
  const shouldApply = (field: keyof ImportFieldSelection, currentValue: string) => {
    if (mode === "all") {
      return true;
    }

    if (mode === "empty") {
      return !currentValue.trim();
    }

    return selection[field];
  };

  return {
    ...current,
    name: resolveImportedValue(current.name, suggestion.name, shouldApply("name", current.name)),
    producer: resolveImportedValue(current.producer, suggestion.producer || "", shouldApply("producer", current.producer)),
    country: resolveImportedValue(current.country, suggestion.country || "", shouldApply("country", current.country)),
    region: resolveImportedValue(current.region, suggestion.region || "", shouldApply("region", current.region)),
    vintage: resolveImportedValue(
      current.vintage,
      suggestion.vintage ? String(suggestion.vintage) : "",
      shouldApply("vintage", current.vintage)
    ),
    grape: resolveImportedValue(current.grape, suggestion.grape || "", shouldApply("grape", current.grape)),
    type: resolveImportedValue(current.type, suggestion.type || "Rött", shouldApply("type", current.type)),
    foodPairings: resolveImportedValue(
      current.foodPairings,
      (suggestion.foodPairings ?? []).join(", "),
      shouldApply("foodPairings", current.foodPairings)
    ),
    systembolagetProductId: resolveImportedValue(
      current.systembolagetProductId,
      suggestion.systembolagetProductId || "",
      shouldApply("systembolagetProductId", current.systembolagetProductId)
    ),
    barcode: resolveImportedValue(current.barcode, suggestion.barcode || "", shouldApply("barcode", current.barcode)),
  };
}

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  argentina: "Argentina",
  australia: "Australien",
  austria: "Österrike",
  chile: "Chile",
  england: "England",
  france: "Frankrike",
  frankrike: "Frankrike",
  germany: "Tyskland",
  greece: "Grekland",
  hungary: "Ungern",
  italy: "Italien",
  italien: "Italien",
  "new zealand": "Nya Zeeland",
  portugal: "Portugal",
  "south africa": "Sydafrika",
  spain: "Spanien",
  sweden: "Sverige",
  usa: "USA",
  "united states": "USA",
};

function mergeReferenceRows(rows: ReferenceOptionRow[]) {
  const merged = new Map<string, ReferenceOptionRow>();

  for (const row of rows) {
    const displayName =
      row.category === "country" ? COUNTRY_NAME_OVERRIDES[normalizeLookupValue(row.name)] ?? row.name : row.name;
    const key = normalizeLookupValue(displayName);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...row,
        name: displayName,
        aliases: [...new Set([row.name, ...(row.aliases ?? [])].filter(Boolean))],
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      aliases: [...new Set([existing.name, row.name, ...(existing.aliases ?? []), ...(row.aliases ?? [])].filter(Boolean))],
      sort_order: Math.min(existing.sort_order, row.sort_order),
      parent_name: existing.parent_name ?? row.parent_name,
    });
  }

  return [...merged.values()].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.name.localeCompare(right.name, "sv");
  });
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#2b1714",
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b1714",
    gap: 12,
  },
  scannerScreen: {
    flex: 1,
    backgroundColor: "#2b1714",
    padding: 18,
    gap: 18,
  },
  catalogEditorContent: {
    gap: 14,
    paddingBottom: 24,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  scannerTitle: {
    color: "#fff6ee",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "700",
  },
  scannerFrame: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#120907",
    minHeight: 420,
  },
  camera: {
    flex: 1,
    minHeight: 420,
  },
  scannerHint: {
    color: "#ead8ca",
    fontSize: 15,
    lineHeight: 22,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  heroPanel: {
    backgroundColor: "#5c1d1b",
    borderRadius: 28,
    padding: 22,
    gap: 12,
  },
  eyebrow: {
    color: "#f4c38c",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff6ee",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
  },
  heroText: {
    color: "#ead8ca",
    fontSize: 15,
    lineHeight: 23,
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#fff6ee",
  },
  infoBox: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  infoLabel: {
    color: "#f4c38c",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#fff6ee",
    fontSize: 14,
  },
  loadingText: {
    color: "#fff6ee",
    fontSize: 16,
  },
  panel: {
    backgroundColor: "#f8f1e8",
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#6f1d1b",
  },
  segmentText: {
    color: "#6f6259",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#fffaf5",
  },
  sectionNavWrapper: {
    marginTop: -4,
    marginHorizontal: -18,
  },
  sectionNav: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  sectionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ead8ca",
  },
  sectionPillActive: {
    backgroundColor: "#6f1d1b",
  },
  sectionPillText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  sectionPillTextActive: {
    color: "#fffaf5",
  },
  inputGroup: {
    gap: 6,
    flex: 1,
  },
  inputLabel: {
    color: "#6f6259",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fffaf5",
    color: "#231815",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  autocompleteList: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#e6d7c8",
    overflow: "hidden",
  },
  autocompleteItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f2e7db",
  },
  autocompleteText: {
    color: "#231815",
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#6f1d1b",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  authNotice: {
    color: "#6f1d1b",
    lineHeight: 21,
  },
  authFootnote: {
    color: "#6f6259",
    lineHeight: 21,
    fontSize: 13,
  },
  inlineLinkButton: {
    alignSelf: "flex-start",
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
  },
  linkText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: "#fffaf5",
    fontSize: 22,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#ead8ca",
    fontSize: 12,
  },
  insightCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 6,
  },
  importSuggestionCard: {
    borderRadius: 18,
    backgroundColor: "#fff6e7",
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#f4c38c",
  },
  importModeRow: {
    gap: 8,
  },
  quickImportButton: {
    backgroundColor: "#fffaf5",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  quickImportButtonActive: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  quickImportText: {
    color: "#6f1d1b",
    fontWeight: "700",
    textAlign: "center",
  },
  quickImportTextActive: {
    color: "#fffaf5",
  },
  importOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fffaf5",
  },
  importOptionRowActive: {
    backgroundColor: "#f4c38c",
  },
  importOptionText: {
    color: "#231815",
    fontWeight: "600",
  },
  importOptionState: {
    color: "#6f6259",
    fontWeight: "700",
  },
  importOptionTextActive: {
    color: "#5c1d1b",
  },
  insightValue: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  recommendationCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 10,
  },
  storageSpaceCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  recommendationHeader: {
    flexDirection: "row",
    gap: 12,
  },
  storageSpaceHeader: {
    flexDirection: "row",
    gap: 12,
  },
  recommendationName: {
    color: "#231815",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  wineCard: {
    borderTopWidth: 1,
    borderTopColor: "#ead8ca",
    paddingTop: 16,
    gap: 12,
  },
  wineImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 20,
    backgroundColor: "#ead8ca",
  },
  wineCardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  wineType: {
    color: "#6f1d1b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  wineName: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  wineMeta: {
    color: "#6f6259",
    marginTop: 4,
  },
  locationText: {
    color: "#6f1d1b",
    marginTop: 6,
    fontWeight: "600",
  },
  quantityBadge: {
    backgroundColor: "#ead8ca",
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quantityBadgeText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  foodSection: {
    gap: 8,
  },
  tagPill: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  foodPill: {
    backgroundColor: "#f4c38c",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  foodPillActive: {
    backgroundColor: "#6f1d1b",
  },
  foodText: {
    color: "#5c1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  foodTextActive: {
    color: "#fffaf5",
  },
  suggestionPill: {
    backgroundColor: "#fffaf5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  suggestionPillActive: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  suggestionText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  suggestionTextActive: {
    color: "#fffaf5",
  },
  notesText: {
    color: "#6f6259",
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dangerText: {
    color: "#9c3d31",
    fontWeight: "700",
  },
  emptyState: {
    color: "#6f6259",
    lineHeight: 21,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
