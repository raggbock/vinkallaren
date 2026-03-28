import "react-native-url-polyfill/auto";

import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { findCatalogMatch, type ProductCatalogEntry } from "./src/lib/product-catalog";
import type { WineInsert, WineRecord, WineRow } from "./src/types/wine";

type AuthMode = "signin" | "signup";

type WineDraft = {
  name: string;
  producer: string;
  country: string;
  region: string;
  grape: string;
  vintage: string;
  quantity: string;
  type: string;
  drinkBy: string;
  location: string;
  barcode: string;
  systembolagetProductId: string;
  tags: string;
  foodPairings: string;
  notes: string;
  imageUri: string;
};

type ImportFieldSelection = {
  name: boolean;
  producer: boolean;
  country: boolean;
  region: boolean;
  vintage: boolean;
  grape: boolean;
  type: boolean;
  foodPairings: boolean;
  systembolagetProductId: boolean;
  barcode: boolean;
};

type ImportMode = "custom" | "all" | "empty";

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
  barcode: "",
  systembolagetProductId: "",
  tags: "",
  foodPairings: "",
  notes: "",
  imageUri: "",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedMeal, setSelectedMeal] = useState("lamm");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [catalogSuggestion, setCatalogSuggestion] = useState<ProductCatalogEntry | null>(null);
  const [importSelection, setImportSelection] = useState<ImportFieldSelection>(defaultImportSelection);
  const [importMode, setImportMode] = useState<ImportMode>("custom");
  const [lookupBusy, setLookupBusy] = useState(false);

  const stats = useMemo(() => buildStats(wines), [wines]);
  const pairingOptions = useMemo(() => buildPairingOptions(wines), [wines]);
  const countryOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.country), [wines]);
  const regionOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.region), [wines]);
  const typeOptions = useMemo(() => buildValueOptions(wines, (wine) => wine.type), [wines]);
  const vintageOptions = useMemo(() => buildVintageOptions(wines), [wines]);
  const mealSuggestions = useMemo(() => buildMealSuggestions(wines), [wines]);
  const mealRecommendations = useMemo(
    () => buildMealRecommendations(wines, selectedMeal),
    [selectedMeal, wines]
  );
  const filteredWines = useMemo(() => {
    return wines.filter((wine) => {
      const matchesPairing =
        selectedPairingFilter === "Alla" || wine.food_pairings.includes(selectedPairingFilter);
      const matchesCountry = selectedCountryFilter === "Alla" || wine.country === selectedCountryFilter;
      const matchesRegion = selectedRegionFilter === "Alla" || wine.region === selectedRegionFilter;
      const matchesType = selectedTypeFilter === "Alla" || wine.type === selectedTypeFilter;
      const matchesVintage =
        selectedVintageFilter === "Alla" || String(wine.vintage ?? "") === selectedVintageFilter;
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
          ...wine.food_pairings,
          ...wine.tags,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesPairing && matchesCountry && matchesRegion && matchesType && matchesVintage && matchesSearch;
    });
  }, [
    searchQuery,
    selectedCountryFilter,
    selectedPairingFilter,
    selectedRegionFilter,
    selectedTypeFilter,
    selectedVintageFilter,
    wines,
  ]);

  useEffect(() => {
    fetchWines();
  }, []);

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

      setDraft(defaultDraft);
      await fetchWines();
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
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

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Kunde inte logga ut", error.message);
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
    setLookupBusy(true);

    const match = await findCatalogMatch({
      barcode: nextDraft.barcode,
      systembolagetProductId: nextDraft.systembolagetProductId,
    });

    setCatalogSuggestion(match);
    setImportSelection(defaultImportSelection);
    setImportMode("custom");
    setLookupBusy(false);
  }

  function applyCatalogSuggestion(mode: ImportMode = importMode) {
    if (!catalogSuggestion) {
      return;
    }

    setDraft((current) => ({
      ...current,
      name: resolveImportedValue(current.name, catalogSuggestion.name, shouldApplyField("name", mode, current.name)),
      producer: resolveImportedValue(
        current.producer,
        catalogSuggestion.producer || "",
        shouldApplyField("producer", mode, current.producer)
      ),
      country: resolveImportedValue(
        current.country,
        catalogSuggestion.country || "",
        shouldApplyField("country", mode, current.country)
      ),
      region: resolveImportedValue(
        current.region,
        catalogSuggestion.region || "",
        shouldApplyField("region", mode, current.region)
      ),
      vintage: resolveImportedValue(
        current.vintage,
        catalogSuggestion.vintage ? String(catalogSuggestion.vintage) : "",
        shouldApplyField("vintage", mode, current.vintage)
      ),
      grape: resolveImportedValue(
        current.grape,
        catalogSuggestion.grape || "",
        shouldApplyField("grape", mode, current.grape)
      ),
      type: resolveImportedValue(current.type, catalogSuggestion.type || "Rött", shouldApplyField("type", mode, current.type)),
      foodPairings: resolveImportedValue(
        current.foodPairings,
        (catalogSuggestion.foodPairings ?? []).join(", "),
        shouldApplyField("foodPairings", mode, current.foodPairings)
      ),
      systembolagetProductId: resolveImportedValue(
        current.systembolagetProductId,
        catalogSuggestion.systembolagetProductId || "",
        shouldApplyField("systembolagetProductId", mode, current.systembolagetProductId)
      ),
      barcode: resolveImportedValue(
        current.barcode,
        catalogSuggestion.barcode || "",
        shouldApplyField("barcode", mode, current.barcode)
      ),
    }));
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
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        Alert.alert("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
        return;
      }
    }

    setScannerVisible(true);
  }

  function handleBarcodeScanned({ data }: { data: string }) {
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

    void maybeSuggestCatalogMatch({
      ...draft,
      barcode: data,
    });

    if (matchedWine) {
      Alert.alert("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
    }
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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <Modal visible={scannerVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.scannerScreen}>
          <View style={styles.scannerHeader}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>Streckkodsskanning</Text>
              <Text style={styles.scannerTitle}>Rikta kameran mot etiketten</Text>
            </View>
            <Pressable onPress={() => setScannerVisible(false)}>
              <Text style={styles.linkText}>Stäng</Text>
            </Pressable>
          </View>

          <View style={styles.scannerFrame}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          </View>

          <Text style={styles.scannerHint}>
            Om koden redan finns i din källare fyller appen i relevanta fält automatiskt.
          </Text>
        </SafeAreaView>
      </Modal>
      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Statistik</Text>
            <Pressable onPress={fetchWines}>
              <Text style={styles.linkText}>Uppdatera</Text>
            </Pressable>
          </View>

          <InsightCard label="Mest flaskor från" value={stats.topCountry} />
          <InsightCard label="Vanligaste typ" value={stats.topType} />
          <InsightCard label="Vanligaste matmatch" value={stats.topPairing} />
          <InsightCard label="Snittårgång" value={stats.averageVintage} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Vad ska vi äta?</Text>
            <Text style={styles.linkText}>{selectedMeal}</Text>
          </View>

          <SuggestionRow
            title="Välj maträtt"
            options={mealSuggestions}
            selected={selectedMeal}
            onSelect={setSelectedMeal}
          />

          {mealRecommendations.length === 0 ? (
            <Text style={styles.emptyState}>Inga viner matchar den maten ännu. Lägg till fler matmatchningar på dina flaskor.</Text>
          ) : (
            mealRecommendations.map((wine) => (
              <View key={`meal-${wine.id}`} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.wineType}>{wine.type}</Text>
                    <Text style={styles.recommendationName}>{wine.name}</Text>
                    <Text style={styles.wineMeta}>
                      {[wine.producer, wine.grape, wine.country].filter(Boolean).join(" • ")}
                    </Text>
                  </View>
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>{wine.quantity} st</Text>
                  </View>
                </View>

                <View style={styles.tagRow}>
                  {wine.food_pairings.map((pairing) => (
                    <View
                      key={`recommend-${wine.id}-${pairing}`}
                      style={[styles.foodPill, pairing === selectedMeal && styles.foodPillActive]}
                    >
                      <Text style={[styles.foodText, pairing === selectedMeal && styles.foodTextActive]}>{pairing}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Lägg till vin</Text>
          <LabeledInput label="Namn" value={draft.name} onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <LabeledInput
            label="Producent"
            value={draft.producer}
            onChangeText={(value) => setDraft((current) => ({ ...current, producer: value }))}
          />
          <DoubleRow>
            <LabeledInput label="Land" value={draft.country} onChangeText={(value) => setDraft((current) => ({ ...current, country: value }))} />
            <LabeledInput label="Region" value={draft.region} onChangeText={(value) => setDraft((current) => ({ ...current, region: value }))} />
          </DoubleRow>
          <LabeledInput
            label="Druva"
            value={draft.grape}
            onChangeText={(value) => setDraft((current) => ({ ...current, grape: value }))}
            placeholder="Nebbiolo, Chardonnay..."
          />
          <DoubleRow>
            <LabeledInput
              label="Årgång"
              value={draft.vintage}
              onChangeText={(value) => setDraft((current) => ({ ...current, vintage: value }))}
              keyboardType="number-pad"
            />
            <LabeledInput
              label="Antal"
              value={draft.quantity}
              onChangeText={(value) => setDraft((current) => ({ ...current, quantity: value }))}
              keyboardType="number-pad"
            />
          </DoubleRow>
          <DoubleRow>
            <LabeledInput label="Typ" value={draft.type} onChangeText={(value) => setDraft((current) => ({ ...current, type: value }))} />
            <LabeledInput
              label="Drick senast"
              value={draft.drinkBy}
              onChangeText={(value) => setDraft((current) => ({ ...current, drinkBy: value }))}
              keyboardType="number-pad"
            />
          </DoubleRow>
          <SuggestionRow
            title="Matförslag"
            options={getSuggestedPairings(draft.type)}
            onSelect={(pairing) =>
              setDraft((current) => ({
                ...current,
                foodPairings: mergeTagText(current.foodPairings, pairing),
              }))
            }
          />
          <LabeledInput
            label="Plats i källaren"
            value={draft.location}
            onChangeText={(value) => setDraft((current) => ({ ...current, location: value }))}
          />
          <LabeledInput
            label="Streckkod"
            value={draft.barcode}
            onChangeText={(value) =>
              setDraft((current) => {
                const nextDraft = { ...current, barcode: value };
                void maybeSuggestCatalogMatch(nextDraft);
                return nextDraft;
              })
            }
          />
          <Pressable onPress={startBarcodeScanner} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Skanna streckkod</Text>
          </Pressable>
          <LabeledInput
            label="Systembolaget artikelnummer"
            value={draft.systembolagetProductId}
            onChangeText={(value) =>
              setDraft((current) => {
                const nextDraft = { ...current, systembolagetProductId: value };
                void maybeSuggestCatalogMatch(nextDraft);
                return nextDraft;
              })
            }
            placeholder="t.ex. 12345"
          />

          {lookupBusy ? <Text style={styles.notesText}>Söker produktmatch...</Text> : null}

          {draft.systembolagetProductId ? (
            <Pressable
              onPress={() => openSystembolaget(draft.systembolagetProductId)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Öppna hos Systembolaget</Text>
            </Pressable>
          ) : null}

          {catalogSuggestion ? (
            <View style={styles.importSuggestionCard}>
              <Text style={styles.inputLabel}>Importförslag</Text>
              <Text style={styles.recommendationName}>{catalogSuggestion.name}</Text>
              <Text style={styles.linkText}>{catalogSuggestion.sourceLabel}</Text>
              <Text style={styles.notesText}>
                {[catalogSuggestion.producer, catalogSuggestion.country, catalogSuggestion.region]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
              <View style={styles.importModeRow}>
                <Pressable
                  onPress={() => {
                    setImportMode("all");
                    applyCatalogSuggestion("all");
                  }}
                  style={[styles.quickImportButton, importMode === "all" && styles.quickImportButtonActive]}
                >
                  <Text style={[styles.quickImportText, importMode === "all" && styles.quickImportTextActive]}>
                    Importera allt
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setImportMode("empty");
                    applyCatalogSuggestion("empty");
                  }}
                  style={[styles.quickImportButton, importMode === "empty" && styles.quickImportButtonActive]}
                >
                  <Text style={[styles.quickImportText, importMode === "empty" && styles.quickImportTextActive]}>
                    Bara tomma fält
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setImportMode("custom")}
                  style={[styles.quickImportButton, importMode === "custom" && styles.quickImportButtonActive]}
                >
                  <Text style={[styles.quickImportText, importMode === "custom" && styles.quickImportTextActive]}>
                    Välj själv
                  </Text>
                </Pressable>
              </View>
              {importMode === "custom" ? (
                <>
              <ImportSelectionRow
                label="Namn"
                selected={importSelection.name}
                onToggle={() => toggleImportField("name")}
              />
              <ImportSelectionRow
                label="Producent"
                selected={importSelection.producer}
                onToggle={() => toggleImportField("producer")}
              />
              <ImportSelectionRow
                label="Land"
                selected={importSelection.country}
                onToggle={() => toggleImportField("country")}
              />
              <ImportSelectionRow
                label="Region"
                selected={importSelection.region}
                onToggle={() => toggleImportField("region")}
              />
              <ImportSelectionRow
                label="Årgång"
                selected={importSelection.vintage}
                onToggle={() => toggleImportField("vintage")}
              />
              <ImportSelectionRow
                label="Druva"
                selected={importSelection.grape}
                onToggle={() => toggleImportField("grape")}
              />
              <ImportSelectionRow
                label="Typ"
                selected={importSelection.type}
                onToggle={() => toggleImportField("type")}
              />
              <ImportSelectionRow
                label="Matmatchning"
                selected={importSelection.foodPairings}
                onToggle={() => toggleImportField("foodPairings")}
              />
              <ImportSelectionRow
                label="Artikelnummer"
                selected={importSelection.systembolagetProductId}
                onToggle={() => toggleImportField("systembolagetProductId")}
              />
              <ImportSelectionRow
                label="Streckkod"
                selected={importSelection.barcode}
                onToggle={() => toggleImportField("barcode")}
              />
              <Pressable onPress={() => applyCatalogSuggestion("custom")} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Fyll i från förslag</Text>
              </Pressable>
                </>
              ) : null}
            </View>
          ) : null}

          <LabeledInput
            label="Etiketter"
            value={draft.tags}
            onChangeText={(value) => setDraft((current) => ({ ...current, tags: value }))}
            placeholder="middag, present, lagring"
          />
          <LabeledInput
            label="Passar till"
            value={draft.foodPairings}
            onChangeText={(value) => setDraft((current) => ({ ...current, foodPairings: value }))}
            placeholder="lamm, ost, svamp, fisk"
          />
          <LabeledInput
            label="Anteckningar"
            value={draft.notes}
            onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
            multiline
          />

          <Pressable onPress={chooseImage} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{draft.imageUri ? "Byt bild" : "Välj flaskbild"}</Text>
          </Pressable>

          {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={styles.wineImage} /> : null}

          <Pressable onPress={saveWine} style={styles.primaryButton} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara i molnet"}</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Min källare</Text>
            <Pressable onPress={signOut}>
              <Text style={styles.linkText}>Logga ut</Text>
            </Pressable>
          </View>

          <LabeledInput
            label="Sök"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="namn, druva, region, mat..."
          />

          <SuggestionRow
            title="Filtrera mat"
            options={pairingOptions}
            selected={selectedPairingFilter}
            onSelect={(pairing) => setSelectedPairingFilter(pairing)}
          />

          <SuggestionRow
            title="Filtrera land"
            options={countryOptions}
            selected={selectedCountryFilter}
            onSelect={(country) => setSelectedCountryFilter(country)}
          />

          <SuggestionRow
            title="Filtrera region"
            options={regionOptions}
            selected={selectedRegionFilter}
            onSelect={(region) => setSelectedRegionFilter(region)}
          />

          <SuggestionRow
            title="Filtrera typ"
            options={typeOptions}
            selected={selectedTypeFilter}
            onSelect={(type) => setSelectedTypeFilter(type)}
          />

          <SuggestionRow
            title="Filtrera årgång"
            options={vintageOptions}
            selected={selectedVintageFilter}
            onSelect={(vintage) => setSelectedVintageFilter(vintage)}
          />

          {loading ? <LoadingInline /> : null}

          {!loading && filteredWines.length === 0 ? (
            <Text style={styles.emptyState}>Inga viner ännu. Lägg till din första flaska ovan.</Text>
          ) : null}

          {filteredWines.map((wine) => (
            <View key={wine.id} style={styles.wineCard}>
              {wine.image_url ? <Image source={{ uri: wine.image_url }} style={styles.wineImage} /> : null}

              <View style={styles.wineCardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.wineType}>{wine.type}</Text>
                  <Text style={styles.wineName}>{wine.name}</Text>
                  <Text style={styles.wineMeta}>
                    {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>{wine.quantity} st</Text>
                </View>
              </View>

              {wine.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {wine.tags.map((tag) => (
                    <View key={`${wine.id}-${tag}`} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {wine.food_pairings.length > 0 ? (
                <View style={styles.foodSection}>
                  <Text style={styles.inputLabel}>Passar till</Text>
                  <View style={styles.tagRow}>
                    {wine.food_pairings.map((pairing) => (
                      <View key={`${wine.id}-food-${pairing}`} style={styles.foodPill}>
                        <Text style={styles.foodText}>{pairing}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {wine.systembolaget_product_id ? (
                <View style={styles.foodSection}>
                  <Text style={styles.inputLabel}>Importkoppling</Text>
                  <Text style={styles.notesText}>Systembolaget #{wine.systembolaget_product_id}</Text>
                  <Pressable
                    onPress={() => openSystembolaget(wine.systembolaget_product_id!)}
                    style={styles.inlineLinkButton}
                  >
                    <Text style={styles.linkText}>Öppna produktsida</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.notesText}>{wine.notes || "Ingen anteckning ännu."}</Text>

              <View style={styles.actionRow}>
                <Pressable onPress={() => decrementWine(wine)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Drack 1 flaska</Text>
                </Pressable>
                <Pressable onPress={() => deleteWine(wine.id, wine.image_path)}>
                  <Text style={styles.dangerText}>Ta bort</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LabeledInput({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#8f8178"
        style={[styles.input, multiline && styles.textarea]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

function DoubleRow({ children }: { children: ReactNode }) {
  return <View style={styles.doubleRow}>{children}</View>;
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function SuggestionRow({
  title,
  options,
  onSelect,
  selected,
}: {
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  selected?: string;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={styles.tagRow}>
        {options.map((option) => {
          const isSelected = selected === option;

          return (
            <Pressable
              key={`${title}-${option}`}
              onPress={() => onSelect(option)}
              style={[styles.suggestionPill, isSelected && styles.suggestionPillActive]}
            >
              <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ImportSelectionRow({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.importOptionRow, selected && styles.importOptionRowActive]}>
      <Text style={[styles.importOptionText, selected && styles.importOptionTextActive]}>{label}</Text>
      <Text style={[styles.importOptionState, selected && styles.importOptionTextActive]}>
        {selected ? "Ja" : "Nej"}
      </Text>
    </Pressable>
  );
}

function LoadingInline() {
  return (
    <View style={styles.loadingInline}>
      <ActivityIndicator color="#6f1d1b" />
      <Text style={styles.notesText}>Laddar viner...</Text>
    </View>
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

function buildStats(wines: WineRecord[]) {
  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const drinkSoon = wines
    .filter((wine) => wine.drink_by_year && wine.drink_by_year <= new Date().getFullYear() + 1)
    .reduce((sum, wine) => sum + wine.quantity, 0);

  const byCountry = new Map<string, number>();
  const byType = new Map<string, number>();
  const byPairing = new Map<string, number>();
  const vintages = wines.map((wine) => wine.vintage).filter((value): value is number => Boolean(value));

  for (const wine of wines) {
    if (wine.country) {
      byCountry.set(wine.country, (byCountry.get(wine.country) || 0) + wine.quantity);
    }

    byType.set(wine.type, (byType.get(wine.type) || 0) + wine.quantity);

    for (const pairing of wine.food_pairings) {
      byPairing.set(pairing, (byPairing.get(pairing) || 0) + wine.quantity);
    }
  }

  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];
  const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPairing = [...byPairing.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalBottles,
    totalLabels: wines.length,
    drinkSoon,
    topCountry: topCountry ? `${topCountry[0]} (${topCountry[1]})` : "Ingen data",
    topType: topType ? `${topType[0]} (${topType[1]})` : "Ingen data",
    topPairing: topPairing ? `${topPairing[0]} (${topPairing[1]})` : "Ingen data",
    averageVintage:
      vintages.length > 0
        ? String(Math.round(vintages.reduce((sum, value) => sum + value, 0) / vintages.length))
        : "-",
  };
}

function buildPairingOptions(wines: WineRecord[]) {
  const pairings = new Set<string>(["Alla"]);

  for (const wine of wines) {
    for (const pairing of wine.food_pairings) {
      pairings.add(pairing);
    }
  }

  return [...pairings];
}

function buildSystembolagetProductUrl(productId: string) {
  const normalized = productId.trim();
  return `https://www.systembolaget.se/${encodeURIComponent(normalized)}/`;
}

function buildMealSuggestions(wines: WineRecord[]) {
  const defaults = ["lamm", "nöt", "fisk", "skaldjur", "ost", "svamp"];
  const values = new Set<string>(defaults);

  for (const wine of wines) {
    for (const pairing of wine.food_pairings) {
      values.add(pairing);
    }
  }

  return [...values];
}

function buildValueOptions(wines: WineRecord[], selector: (wine: WineRecord) => string | null) {
  const values = new Set<string>(["Alla"]);

  for (const wine of wines) {
    const value = selector(wine);

    if (value) {
      values.add(value);
    }
  }

  return [...values];
}

function buildVintageOptions(wines: WineRecord[]) {
  const values = new Set<string>(["Alla"]);

  for (const wine of wines) {
    if (wine.vintage) {
      values.add(String(wine.vintage));
    }
  }

  return [...values].sort((a, b) => {
    if (a === "Alla") {
      return -1;
    }

    if (b === "Alla") {
      return 1;
    }

    return Number(b) - Number(a);
  });
}

function buildMealRecommendations(wines: WineRecord[], selectedMeal: string) {
  return [...wines]
    .filter((wine) => wine.food_pairings.includes(selectedMeal))
    .sort((a, b) => {
      const aReady = a.drink_by_year ? Math.abs(a.drink_by_year - new Date().getFullYear()) : 999;
      const bReady = b.drink_by_year ? Math.abs(b.drink_by_year - new Date().getFullYear()) : 999;

      if (aReady !== bReady) {
        return aReady - bReady;
      }

      return b.quantity - a.quantity;
    })
    .slice(0, 5);
}

function getSuggestedPairings(wineType: string) {
  const normalized = wineType.trim().toLowerCase();

  if (normalized.includes("vitt")) {
    return ["fisk", "skaldjur", "sallad", "getost"];
  }

  if (normalized.includes("mousserande")) {
    return ["aperitif", "skaldjur", "chips", "ost"];
  }

  if (normalized.includes("ros")) {
    return ["grillat", "sallad", "kyckling", "snacks"];
  }

  if (normalized.includes("dessert")) {
    return ["dessert", "blåmögelost", "frukt"];
  }

  return ["lamm", "nöt", "svamp", "lagrad ost"];
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mergeTagText(currentValue: string, nextValue: string) {
  const parts = parseTags(currentValue);

  if (parts.includes(nextValue)) {
    return currentValue;
  }

  return [...parts, nextValue].join(", ");
}

function resolveImportedValue(currentValue: string, importedValue: string, modeOrSelection: boolean) {
  if (!modeOrSelection) {
    return currentValue;
  }

  return importedValue || currentValue;
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
  recommendationHeader: {
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
