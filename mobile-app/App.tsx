import "react-native-url-polyfill/auto";

import * as ImagePicker from "expo-image-picker";
import { useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { cacheCatalogEntry, findCatalogMatch, type ProductCatalogEntry } from "./src/lib/product-catalog";
import { GRAPE_VARIETIES, WINE_COUNTRIES, WINE_REGIONS } from "./src/lib/reference-data";
import {
  buildMealRecommendations,
  buildPairingOptions,
  buildStats,
  buildStorageSpaceBottleCounts,
  buildSystembolagetProductUrl,
  buildValueOptions,
  buildVintageOptions,
  emptyToNull,
  getWineStoragePlacementLabel,
  normalizeLookupValue,
  parseTags,
  toNumberOrNull,
} from "./src/lib/cellar-helpers";
import {
  applyCatalogLocksToDraft,
  buildWineInsertFromDraft,
  cacheWineDraftAsCatalogEntry,
  cacheWineRecordAsCatalogEntry,
  canBeSavedAsCatalogEntry,
  getMissingCatalogFields,
  hydrateWineHistoryRecords,
  hydrateWineRecords,
  mergeDraftWithCatalogSuggestion,
  mergeReferenceRows,
  scoreCatalogCompleteness,
  syncCatalogEntryForEditedWine,
  toCatalogEditorDraft,
  toWineDraft,
  toWineNameReferenceRows,
  uploadWineImage,
} from "./src/lib/wine-helpers";
import {
  BottomTabBar,
  HistoryPanel,
  MealPlannerPanel,
  MinKallarePanel,
} from "./src/components/cellar-sections";
import { AddWinePanel, BarcodeScannerModal, CatalogEditorModal, DrinkWineModal, EditWineModal, VintagePickerModal } from "./src/components/cellar-workflows";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { ImportFieldSelection, ImportMode, StorageSpaceDraft, WineDraft } from "./src/types/cellar-drafts";
import { defaultDraft, defaultImportSelection, defaultStorageSpaceDraft } from "./src/types/cellar-drafts";
import type { ProductCatalogWineRow } from "./src/types/product-catalog";
import type { StorageSpaceInsert, StorageSpaceRow } from "./src/types/storage-space";
import type { WineHistoryInsert, WineHistoryRow } from "./src/types/wine-history";
import type { WineInsert, WineRecord, WineRow } from "./src/types/wine";
import { styles } from "./src/styles/theme";
import { AuthScreen, LoadingScreen, SetupScreen } from "./src/screens/auth";

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

function CellarScreen({ session }: { session: Session }) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [historyEntries, setHistoryEntries] = useState<import("./src/types/wine-history").WineHistoryRecord[]>([]);
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [storageSpaceDraft, setStorageSpaceDraft] = useState<StorageSpaceDraft>(defaultStorageSpaceDraft);
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceRow[]>([]);
  const [catalogEntries, setCatalogEntries] = useState<ProductCatalogWineRow[]>([]);
  const [catalogNameEntries, setCatalogNameEntries] = useState<ProductCatalogWineRow[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<import("./src/types/reference-data").ReferenceOptionRow[]>([]);
  const [catalogEditorVisible, setCatalogEditorVisible] = useState(false);
  const [catalogEditorDraft, setCatalogEditorDraft] = useState<import("./src/types/cellar-drafts").CatalogEditorDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingStorageSpaces, setLoadingStorageSpaces] = useState(true);
  const [loadingCatalogEntries, setLoadingCatalogEntries] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStorageSpace, setSavingStorageSpace] = useState(false);
  const [savingCatalogEdit, setSavingCatalogEdit] = useState(false);
  const [savingDrinkHistory, setSavingDrinkHistory] = useState(false);
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
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [drinkModalVisible, setDrinkModalVisible] = useState(false);
  const [selectedDrinkWine, setSelectedDrinkWine] = useState<WineRecord | null>(null);
  const [drinkRating, setDrinkRating] = useState("");
  const [drinkNotes, setDrinkNotes] = useState("");
  const [drinkConsumedDate, setDrinkConsumedDate] = useState("");
  const [drinkImageUri, setDrinkImageUri] = useState("");
  const [tastingMode, setTastingMode] = useState(false);
  const [tastingRating, setTastingRating] = useState("");
  const [tastingDate, setTastingDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingTasting, setSavingTasting] = useState(false);
  const [catalogBackfillDone, setCatalogBackfillDone] = useState(false);
  const [editWineVisible, setEditWineVisible] = useState(false);
  const [editingWine, setEditingWine] = useState<WineRecord | null>(null);
  const [editWineDraft, setEditWineDraft] = useState<WineDraft | null>(null);
  const [savingWineEdit, setSavingWineEdit] = useState(false);
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);
  const [vintagePickerVisible, setVintagePickerVisible] = useState(false);
  const [vintagePickerWineName, setVintagePickerWineName] = useState("");
  const [vintagePickerOptions, setVintagePickerOptions] = useState<{ year: string; entry: ProductCatalogWineRow }[]>([]);

  // --- Derived data ---

  const stats = useMemo(() => buildStats(wines), [wines]);
  const grapeReferenceRows = useMemo(
    () => mergeReferenceRows(referenceOptions.filter((option) => option.category === "grape")),
    [referenceOptions]
  );
  const catalogWineNameReferenceRows = useMemo(() => {
    const bestByName = new Map<string, ProductCatalogWineRow>();
    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = bestByName.get(key);
      if (!existing || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(existing)) {
        bestByName.set(key, entry);
      }
    }
    return toWineNameReferenceRows([...bestByName.values()], "catalog-wine-name");
  }, [catalogNameEntries]);
  const wineNameReferenceRows = useMemo(
    () => mergeReferenceRows([...catalogWineNameReferenceRows]),
    [catalogWineNameReferenceRows]
  );
  const catalogNameEntryByName = useMemo(() => {
    const map = new Map<string, ProductCatalogWineRow>();

    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = map.get(key);

      if (!existing || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(existing)) {
        map.set(key, entry);
      }
    }

    return map;
  }, [catalogNameEntries]);
  const catalogEntriesByName = useMemo(() => {
    const map = new Map<string, ProductCatalogWineRow[]>();
    for (const entry of catalogNameEntries) {
      const key = normalizeLookupValue(entry.name);
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }
    return map;
  }, [catalogNameEntries]);
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
  const effectiveWineNameOptions = wineNameOptions;
  const effectiveWineNameReferenceRows = wineNameReferenceRows;
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
  const selectedEditStorageSpace =
    storageSpaces.find((space) => space.id === (editWineDraft?.storageSpaceId || "")) ?? null;

  const mealRecommendations = useMemo(
    () => buildMealRecommendations(wines, selectedMeal),
    [selectedMeal, wines]
  );

  // --- Event handlers ---

  function goToSection(section: CellarSection) {
    setActiveSection(section);
  }

  function updateAddWineDraft(patch: Partial<WineDraft>) {
    let lockedEntry = selectedCatalogNameEntry;

    if (typeof patch.name === "string") {
      lockedEntry = catalogNameEntryByName.get(normalizeLookupValue(patch.name)) ?? null;
      setSelectedCatalogNameEntry(lockedEntry);
    }

    setDraft((current) => applyCatalogLocksToDraft(current, patch, lockedEntry));
  }

  function handleWineNameSelected(name: string) {
    const entries = catalogEntriesByName.get(normalizeLookupValue(name)) ?? [];

    if (entries.length === 0) {
      setSelectedCatalogNameEntry(null);
      setDraft((current) => ({ ...current, name }));
      return;
    }

    const vintageMap = new Map<string, ProductCatalogWineRow>();
    for (const entry of entries) {
      const year = entry.vintage ? String(entry.vintage) : "";
      if (!vintageMap.has(year) || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(vintageMap.get(year)!)) {
        vintageMap.set(year, entry);
      }
    }

    const uniqueVintages = [...vintageMap.entries()]
      .filter(([year]) => year !== "")
      .map(([year, entry]) => ({ year, entry }))
      .sort((a, b) => b.year.localeCompare(a.year));

    if (uniqueVintages.length <= 1) {
      const bestEntry = entries.reduce((best, e) =>
        scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best
      );
      applySelectedCatalogEntry(bestEntry);
      return;
    }

    setVintagePickerWineName(entries[0].name);
    setVintagePickerOptions(uniqueVintages);
    setVintagePickerVisible(true);
    setDraft((current) => ({ ...current, name: entries[0].name }));
  }

  function applySelectedCatalogEntry(entry: ProductCatalogWineRow) {
    setSelectedCatalogNameEntry(entry);
    setDraft((current) => ({
      ...current,
      name: entry.name,
      producer: entry.producer ?? "",
      country: entry.country ?? "",
      region: entry.region ?? "",
      grape: entry.grape ?? "",
      vintage: entry.vintage ? String(entry.vintage) : "",
      type: entry.type ?? current.type,
      barcode: entry.barcode ?? "",
      systembolagetProductId: entry.systembolaget_product_id ?? "",
      foodPairings: entry.food_pairings.join(", "),
    }));
  }

  function handleVintageSelected(entry: ProductCatalogWineRow) {
    setVintagePickerVisible(false);
    applySelectedCatalogEntry(entry);
  }

  function handleVintageAddNew() {
    setVintagePickerVisible(false);
    const entries = catalogEntriesByName.get(normalizeLookupValue(vintagePickerWineName)) ?? [];
    if (entries.length > 0) {
      const bestEntry = entries.reduce((best, e) =>
        scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best
      );
      setSelectedCatalogNameEntry(bestEntry);
      setDraft((current) => ({
        ...current,
        name: bestEntry.name,
        producer: bestEntry.producer ?? "",
        country: bestEntry.country ?? "",
        region: bestEntry.region ?? "",
        grape: bestEntry.grape ?? "",
        vintage: "",
        type: bestEntry.type ?? current.type,
        barcode: "",
        systembolagetProductId: "",
        foodPairings: bestEntry.food_pairings.join(", "),
      }));
    }
  }

  // --- Filtering ---

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

  // --- Effects ---

  useEffect(() => {
    void fetchWines();
    void fetchHistoryEntries();
    void fetchStorageSpaces();
    void fetchCatalogEntries();
    void fetchCatalogNameEntries();
    void fetchReferenceOptions();
  }, []);

  useEffect(() => {
    if (catalogBackfillDone || wines.length === 0) {
      return;
    }

    const completeWines = wines.filter((wine) => canBeSavedAsCatalogEntry(wine));

    if (completeWines.length === 0) {
      setCatalogBackfillDone(true);
      return;
    }

    const runBackfill = async () => {
      for (const wine of completeWines) {
        const alreadyKnown = catalogNameEntries.some(
          (entry) =>
            normalizeLookupValue(entry.name) === normalizeLookupValue(wine.name) &&
            normalizeLookupValue(entry.producer ?? "") === normalizeLookupValue(wine.producer ?? "")
        );

        if (alreadyKnown) {
          continue;
        }

        await cacheWineRecordAsCatalogEntry(wine, session.user.id);
      }

      await Promise.all([fetchCatalogEntries(), fetchCatalogNameEntries()]);
      setCatalogBackfillDone(true);
    };

    void runBackfill();
  }, [catalogBackfillDone, catalogNameEntries, session.user.id, wines]);

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

  // --- Data fetching ---

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

  async function fetchHistoryEntries() {
    setLoadingHistory(true);

    const { data, error } = await supabase
      .from("wine_history")
      .select("*")
      .order("consumed_at", { ascending: false })
      .limit(100);

    if (error) {
      Alert.alert("Kunde inte hämta historiken", error.message);
      setLoadingHistory(false);
      return;
    }

    setHistoryEntries(await hydrateWineHistoryRecords((data ?? []) as WineHistoryRow[]));
    setLoadingHistory(false);
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

  async function fetchCatalogNameEntries() {
    const allEntries: ProductCatalogWineRow[] = [];
    let offset = 0;
    const pageSize = 5000;

    while (true) {
      const { data, error } = await supabase
        .from("product_catalog_wines")
        .select("*")
        .order("name", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) return;

      allEntries.push(...(data as ProductCatalogWineRow[]));

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    setCatalogNameEntries(allEntries);
  }

  async function fetchReferenceOptions() {
    const { data, error } = await supabase
      .from("reference_options")
      .select("*")
      .in("category", ["grape", "country", "region"])
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return;
    }

    setReferenceOptions((data ?? []) as import("./src/types/reference-data").ReferenceOptionRow[]);
  }

  // --- Catalog editor ---

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
      await Promise.all([fetchCatalogEntries(), fetchCatalogNameEntries()]);
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

      await Promise.all([fetchCatalogEntries(), fetchCatalogNameEntries()]);
    } catch (error) {
      Alert.alert("Kunde inte ta bort produkt", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  // --- Save operations ---

  async function saveWine() {
    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill lägga till.");
      return;
    }

    const knownCatalogName = effectiveWineNameReferenceRows.some(
      (option) => normalizeLookupValue(option.name) === normalizeLookupValue(draft.name)
    );
    const missingCatalogFields = getMissingCatalogFields(draft);

    if (!knownCatalogName && missingCatalogFields.length > 0) {
      Alert.alert(
        "Komplettera vinet",
        `Om vinet inte redan finns i katalogen behöver du fylla i: ${missingCatalogFields.join(", ")}. Då kan appen spara det i katalogen också.`
      );
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
        acquired_at: emptyToNull(draft.acquiredAt),
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
      setSelectedCatalogNameEntry(null);
      await Promise.all([fetchWines(), fetchCatalogEntries(), fetchCatalogNameEntries(), fetchReferenceOptions()]);
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTasting() {
    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du provade.");
      return;
    }

    setSavingTasting(true);

    try {
      let imagePath: string | null = null;

      if (draft.imageUri) {
        imagePath = await uploadWineImage(session.user.id, draft.imageUri);
      }

      const payload: WineHistoryInsert = {
        user_id: session.user.id,
        name: draft.name.trim(),
        producer: emptyToNull(draft.producer),
        country: emptyToNull(draft.country),
        region: emptyToNull(draft.region),
        grape: emptyToNull(draft.grape),
        vintage: toNumberOrNull(draft.vintage),
        type: draft.type.trim() || "Rött",
        barcode: emptyToNull(draft.barcode),
        systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
        image_path: imagePath,
        quantity_consumed: 1,
        rating: tastingRating ? Number(tastingRating) : null,
        tasting_notes: emptyToNull(draft.notes),
        consumed_at: tastingDate || null,
      };

      const { error } = await supabase.from("wine_history").insert(payload);

      if (error) {
        throw error;
      }

      setDraft(defaultDraft);
      setTastingRating("");
      setTastingDate(new Date().toISOString().slice(0, 10));
      await fetchHistoryEntries();
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingTasting(false);
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

  // --- Modal operations ---

  function openDrinkModal(wine: WineRecord) {
    setSelectedDrinkWine(wine);
    setDrinkRating("");
    setDrinkNotes("");
    setDrinkConsumedDate(new Date().toISOString().slice(0, 10));
    setDrinkImageUri("");
    setDrinkModalVisible(true);
  }

  function closeDrinkModal() {
    if (savingDrinkHistory) {
      return;
    }

    setDrinkModalVisible(false);
    setSelectedDrinkWine(null);
    setDrinkRating("");
    setDrinkNotes("");
  }

  function openEditWineModal(wine: WineRecord) {
    setEditingWine(wine);
    setEditWineDraft(toWineDraft(wine));
    setEditWineVisible(true);
  }

  function closeEditWineModal() {
    if (savingWineEdit) {
      return;
    }

    setEditWineVisible(false);
    setEditingWine(null);
    setEditWineDraft(null);
  }

  async function saveDrinkHistory() {
    if (!selectedDrinkWine) {
      return;
    }

    setSavingDrinkHistory(true);

    try {
      let imagePath = selectedDrinkWine.image_path;
      if (drinkImageUri) {
        imagePath = await uploadWineImage(session.user.id, drinkImageUri);
      }

      const payload: WineHistoryInsert = {
        user_id: session.user.id,
        wine_id: selectedDrinkWine.id,
        name: selectedDrinkWine.name,
        producer: selectedDrinkWine.producer,
        country: selectedDrinkWine.country,
        region: selectedDrinkWine.region,
        grape: selectedDrinkWine.grape,
        vintage: selectedDrinkWine.vintage,
        type: selectedDrinkWine.type,
        barcode: selectedDrinkWine.barcode,
        systembolaget_product_id: selectedDrinkWine.systembolaget_product_id,
        storage_space_id: selectedDrinkWine.storage_space_id,
        storage_row: selectedDrinkWine.storage_row,
        storage_slot: selectedDrinkWine.storage_slot,
        cellar_location: selectedDrinkWine.cellar_location,
        image_path: imagePath,
        quantity_consumed: 1,
        rating: drinkRating ? Number(drinkRating) : null,
        tasting_notes: emptyToNull(drinkNotes),
        consumed_at: drinkConsumedDate || null,
      };

      const { error: historyError } = await supabase.from("wine_history").insert(payload);

      if (historyError) {
        throw historyError;
      }

      if (selectedDrinkWine.quantity <= 1) {
        const { error: deleteError } = await supabase.from("wines").delete().eq("id", selectedDrinkWine.id);

        if (deleteError) {
          throw deleteError;
        }

        setWines((current) => current.filter((wine) => wine.id !== selectedDrinkWine.id));
      } else {
        const { data, error: updateError } = await supabase
          .from("wines")
          .update({ quantity: selectedDrinkWine.quantity - 1 })
          .eq("id", selectedDrinkWine.id)
          .select("*")
          .single();

        if (updateError) {
          throw updateError;
        }

        const [hydrated] = await hydrateWineRecords([data as WineRow]);
        setWines((current) => current.map((wine) => (wine.id === selectedDrinkWine.id ? hydrated : wine)));
      }

      await fetchHistoryEntries();
      closeDrinkModal();
    } catch (error) {
      Alert.alert("Kunde inte spara historiken", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingDrinkHistory(false);
    }
  }

  async function saveWineEdit() {
    if (!editingWine || !editWineDraft) {
      return;
    }

    if (!editWineDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill spara.");
      return;
    }

    const knownCatalogName = effectiveWineNameReferenceRows.some(
      (option) => normalizeLookupValue(option.name) === normalizeLookupValue(editWineDraft.name)
    );
    const missingCatalogFields = getMissingCatalogFields(editWineDraft);

    if (!knownCatalogName && missingCatalogFields.length > 0) {
      Alert.alert(
        "Komplettera vinet",
        `Om vinet inte redan finns i katalogen behöver du fylla i: ${missingCatalogFields.join(", ")}. Då kan appen spara det i katalogen också.`
      );
      return;
    }

    setSavingWineEdit(true);

    try {
      const payload = buildWineInsertFromDraft(editWineDraft, editWineDraft.storageSpaceId, editWineDraft.storageRow, editWineDraft.storageSlot, editingWine.image_path);

      const { data, error } = await supabase
        .from("wines")
        .update(payload)
        .eq("id", editingWine.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedWine = (data ?? null) as WineRow | null;

      if (updatedWine) {
        await syncCatalogEntryForEditedWine(editingWine, updatedWine, session.user.id);
        const [hydrated] = await hydrateWineRecords([updatedWine]);
        setWines((current) => current.map((wine) => (wine.id === editingWine.id ? hydrated : wine)));
      }

      await Promise.all([fetchCatalogEntries(), fetchCatalogNameEntries()]);
      closeEditWineModal();
    } catch (error) {
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingWineEdit(false);
    }
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

  // --- Image handling ---

  async function pickImageFromLibrary(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Behörighet saknas", "Ge appen tillgång till bilder.");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    return result.canceled ? null : result.assets[0].uri;
  }

  async function takePhoto(): Promise<string | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Behörighet saknas", "Ge appen tillgång till kameran.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    return result.canceled ? null : result.assets[0].uri;
  }

  async function chooseImage() {
    const uri = await pickImageFromLibrary();
    if (uri) setDraft((current) => ({ ...current, imageUri: uri }));
  }

  async function takeWinePhoto() {
    const uri = await takePhoto();
    if (uri) setDraft((current) => ({ ...current, imageUri: uri }));
  }

  async function chooseDrinkImage() {
    const uri = await pickImageFromLibrary();
    if (uri) setDrinkImageUri(uri);
  }

  async function takeDrinkPhoto() {
    const uri = await takePhoto();
    if (uri) setDrinkImageUri(uri);
  }

  // --- Catalog lookup ---

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

  // --- Render ---

  let activePanel = (
    <MinKallarePanel
      styles={styles}
      stats={stats}
      searchQuery={searchQuery}
      selectedPairingFilter={selectedPairingFilter}
      selectedCountryFilter={selectedCountryFilter}
      selectedRegionFilter={selectedRegionFilter}
      selectedTypeFilter={selectedTypeFilter}
      selectedVintageFilter={selectedVintageFilter}
      pairingOptions={pairingOptions}
      countryOptions={countryOptions}
      regionOptions={regionOptions}
      typeOptions={typeOptions}
      vintageOptions={vintageOptions}
      storageSpaces={storageSpaces}
      storageSpaceBottleCounts={storageSpaceBottleCounts}
      filteredWines={filteredWines}
      loading={loading}
      storageSpaceById={storageSpaceById}
      onRefreshStats={fetchWines}
      onSearchChange={setSearchQuery}
      onPairingChange={setSelectedPairingFilter}
      onCountryChange={setSelectedCountryFilter}
      onRegionChange={setSelectedRegionFilter}
      onTypeChange={setSelectedTypeFilter}
      onVintageChange={setSelectedVintageFilter}
      onSignOut={signOut}
      onOpenSystembolaget={openSystembolaget}
      onEditWine={openEditWineModal}
      onDrinkWine={openDrinkModal}
      onDeleteWine={deleteWine}
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
    />
  );

  if (activeSection === "history") {
    activePanel = (
      <HistoryPanel
        styles={styles}
        historyEntries={historyEntries}
        loadingHistory={loadingHistory}
        storageSpaceById={storageSpaceById}
      />
    );
  } else if (activeSection === "meal") {
    activePanel = (
      <MealPlannerPanel
        styles={styles}
        selectedMeal={selectedMeal}
        mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
        onWinePress={(wine) => {
          setHighlightedWineId(wine.id);
          setActiveSection("cellar");
        }}
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
        wineNameReferenceRows={effectiveWineNameReferenceRows}
        countryReferenceRows={countryReferenceRows}
        regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        lookupBusy={lookupBusy}
        lookupMessage={lookupMessage}
        catalogSuggestion={catalogSuggestion}
        importMode={importMode}
        importSelection={importSelection}
        saving={saving}
        selectedCatalogNameEntry={selectedCatalogNameEntry}
        onDraftChange={updateAddWineDraft}
        onNameSelected={handleWineNameSelected}
        onBarcodeChange={(value) =>
          setDraft((current) => {
            const nextDraft = applyCatalogLocksToDraft(current, { barcode: value }, selectedCatalogNameEntry);
            void maybeSuggestCatalogMatch(nextDraft);
            return nextDraft;
          })
        }
        onArticleNumberChange={(value) =>
          setDraft((current) => {
            const nextDraft = applyCatalogLocksToDraft(current, { systembolagetProductId: value }, selectedCatalogNameEntry);
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
        onChooseImage={chooseImage}
        onTakePhoto={takeWinePhoto}
        onSaveWine={saveWine}
        tastingMode={tastingMode}
        onTastingModeChange={setTastingMode}
        tastingRating={tastingRating}
        onTastingRatingChange={setTastingRating}
        tastingDate={tastingDate}
        onTastingDateChange={setTastingDate}
        onSaveTasting={saveTasting}
        savingTasting={savingTasting}
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
      <VintagePickerModal
        visible={vintagePickerVisible}
        wineName={vintagePickerWineName}
        vintages={vintagePickerOptions}
        onSelectVintage={handleVintageSelected}
        onAddNew={handleVintageAddNew}
        onClose={() => setVintagePickerVisible(false)}
        styles={styles}
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
        wineNameReferenceRows={effectiveWineNameReferenceRows}
        countryReferenceRows={countryReferenceRows}
        regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        onClose={closeCatalogEditor}
        onSave={saveCatalogEditor}
        onChange={(patch) => setCatalogEditorDraft((current) => (current ? { ...current, ...patch } : current))}
      />
      <DrinkWineModal
        visible={drinkModalVisible}
        styles={styles}
        wine={selectedDrinkWine}
        rating={drinkRating}
        notes={drinkNotes}
        consumedDate={drinkConsumedDate}
        imageUri={drinkImageUri}
        saving={savingDrinkHistory}
        onClose={closeDrinkModal}
        onRatingChange={setDrinkRating}
        onNotesChange={setDrinkNotes}
        onConsumedDateChange={setDrinkConsumedDate}
        onChooseImage={chooseDrinkImage}
        onTakePhoto={takeDrinkPhoto}
        onConfirm={saveDrinkHistory}
      />
      <EditWineModal
        visible={editWineVisible}
        styles={styles}
        draft={editWineDraft}
        storageSpaces={storageSpaces}
        selectedStorageSpace={selectedEditStorageSpace}
        storageSpaceById={storageSpaceById}
        effectiveWineNameOptions={effectiveWineNameOptions}
        effectiveCountryOptions={effectiveCountryOptions}
        effectiveRegionOptions={effectiveRegionOptions}
        effectiveGrapeOptions={effectiveGrapeOptions}
        wineNameReferenceRows={effectiveWineNameReferenceRows}
        countryReferenceRows={countryReferenceRows}
        regionReferenceRows={regionReferenceRows}
        grapeReferenceRows={grapeReferenceRows}
        saving={savingWineEdit}
        onClose={closeEditWineModal}
        onDraftChange={(patch) => setEditWineDraft((current) => (current ? { ...current, ...patch } : current))}
        onStorageSpaceChange={(spaceId) =>
          setEditWineDraft((current) =>
            current ? { ...current, storageSpaceId: spaceId, storageRow: "1", storageSlot: "1" } : current
          )
        }
        onStorageRowChange={(value) =>
          setEditWineDraft((current) => (current ? { ...current, storageRow: value } : current))
        }
        onStorageSlotChange={(value) =>
          setEditWineDraft((current) => (current ? { ...current, storageSlot: value } : current))
        }
        onSave={saveWineEdit}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
        {activePanel}
      </ScrollView>
      <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={goToSection} />
    </SafeAreaView>
  );
}
