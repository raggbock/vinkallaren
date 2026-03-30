import "react-native-url-polyfill/auto";

import { useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, SafeAreaView, ScrollView } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import { cacheCatalogEntry, findCatalogMatch, type ProductCatalogEntry } from "./src/lib/product-catalog";
import { buildMealRecommendations, buildSystembolagetProductUrl, emptyToNull, normalizeLookupValue, parseTags, toNumberOrNull } from "./src/lib/cellar-helpers";
import {
  applyCatalogLocksToDraft,
  buildWineInsertFromDraft,
  cacheWineDraftAsCatalogEntry,
  getMissingCatalogFields,
  hydrateWineRecords,
  mergeDraftWithCatalogSuggestion,
  scoreCatalogCompleteness,
  syncCatalogEntryForEditedWine,
  toCatalogEditorDraft,
  toWineDraft,
  uploadWineImage,
} from "./src/lib/wine-helpers";
import { BottomTabBar, HistoryPanel, MealPlannerPanel, MinKallarePanel } from "./src/components/cellar-sections";
import { AddWinePanel, BarcodeScannerModal, CatalogEditorModal, DrinkWineModal, EditWineModal, VintagePickerModal } from "./src/components/cellar-workflows";
import type { WsatTastingData } from "./src/lib/wsat-data";
import { WsatTastingModal } from "./src/components/wsat-tasting-modal";
import { CELLAR_SECTIONS, type CellarSection } from "./src/types/cellar";
import type { ImportFieldSelection, ImportMode, WineDraft } from "./src/types/cellar-drafts";
import { defaultDraft, defaultImportSelection } from "./src/types/cellar-drafts";
import type { CatalogEditorDraft } from "./src/types/cellar-drafts";
import type { ProductCatalogWineRow } from "./src/types/product-catalog";
import type { WineHistoryInsert } from "./src/types/wine-history";
import type { WineInsert, WineRecord, WineRow } from "./src/types/wine";
import { styles } from "./src/styles/theme";
import { AuthScreen, LoadingScreen, SetupScreen } from "./src/screens/auth";
import { useCellarData } from "./src/hooks/useCellarData";
import { useCellarFilters } from "./src/hooks/useCellarFilters";
import { useImagePicker } from "./src/hooks/useImagePicker";

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

  // --- Local UI state ---
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [activeSection, setActiveSection] = useState<CellarSection>("cellar");
  const [highlightedWineId, setHighlightedWineId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState("lamm");

  // --- Storage space selection ---
  const [selectedStorageSpaceId, setSelectedStorageSpaceId] = useState("");
  const [selectedStorageRow, setSelectedStorageRow] = useState("1");
  const [selectedStorageSlot, setSelectedStorageSlot] = useState("1");

  // --- Catalog lookup ---
  const [catalogSuggestion, setCatalogSuggestion] = useState<ProductCatalogEntry | null>(null);
  const [importSelection, setImportSelection] = useState<ImportFieldSelection>(defaultImportSelection);
  const [importMode, setImportMode] = useState<ImportMode>("custom");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);

  // --- Barcode scanner ---
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- Vintage picker ---
  const [vintagePickerVisible, setVintagePickerVisible] = useState(false);
  const [vintagePickerWineName, setVintagePickerWineName] = useState("");
  const [vintagePickerOptions, setVintagePickerOptions] = useState<{ year: string; entry: ProductCatalogWineRow }[]>([]);

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

  // --- Derived ---
  const selectedStorageSpace = data.storageSpaces.find((s) => s.id === selectedStorageSpaceId) ?? null;
  const selectedEditStorageSpace = data.storageSpaces.find((s) => s.id === (editWineDraft?.storageSpaceId || "")) ?? null;
  const mealRecommendations = useMemo(() => buildMealRecommendations(data.wines, selectedMeal), [selectedMeal, data.wines]);

  // --- Storage space auto-select ---
  useEffect(() => {
    if (data.storageSpaces.length > 0 && !selectedStorageSpaceId) {
      setSelectedStorageSpaceId(data.storageSpaces[0].id);
      setSelectedStorageRow("1");
      setSelectedStorageSlot("1");
    }
  }, [selectedStorageSpaceId, data.storageSpaces]);

  useEffect(() => {
    if (!selectedStorageSpaceId) return;
    const space = data.storageSpaces.find((s) => s.id === selectedStorageSpaceId);
    if (!space) return;
    const row = Number(selectedStorageRow);
    const slot = Number(selectedStorageSlot);
    if (!Number.isFinite(row) || row < 1 || row > space.row_count) setSelectedStorageRow("1");
    if (!Number.isFinite(slot) || slot < 1 || slot > space.slots_per_row) setSelectedStorageSlot("1");
  }, [selectedStorageRow, selectedStorageSlot, selectedStorageSpaceId, data.storageSpaces]);

  // --- Draft & catalog helpers ---

  function updateAddWineDraft(patch: Partial<WineDraft>) {
    setDraft((current) => applyCatalogLocksToDraft(current, patch, selectedCatalogNameEntry));
  }

  async function handleWineNameSelected(name: string, producer?: string | null) {
    let entries = await data.fetchCatalogEntriesByName(name);
    if (producer) {
      const filtered = entries.filter((e) => normalizeLookupValue(e.producer ?? "") === normalizeLookupValue(producer));
      if (filtered.length > 0) entries = filtered;
    }
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
      const bestEntry = entries.reduce((best, e) => scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best);
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

  async function handleVintageAddNew() {
    setVintagePickerVisible(false);
    const entries = await data.fetchCatalogEntriesByName(vintagePickerWineName);
    if (entries.length > 0) {
      const bestEntry = entries.reduce((best, e) => scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best);
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
      const match = await findCatalogMatch({ barcode, systembolagetProductId });
      const normalizedMatch = match && !match.barcode && barcode ? { ...match, barcode } : match;
      setCatalogSuggestion(normalizedMatch);
      setImportSelection(defaultImportSelection);
      setImportMode("custom");
      setLookupMessage(match ? `Träff hittad från ${match.sourceLabel}.` : barcode ? "Ingen träff på streckkoden ännu." : "Ingen träff på artikelnumret ännu.");
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
    if (!catalogSuggestion) return;
    setDraft((current) => mergeDraftWithCatalogSuggestion(current, catalogSuggestion, mode, importSelection));
  }

  function toggleImportField(field: keyof ImportFieldSelection) {
    setImportSelection((current) => ({ ...current, [field]: !current[field] }));
    setImportMode("custom");
  }

  // --- Barcode scanner ---

  async function startBarcodeScanner() {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.protocol !== "https:") {
      Alert.alert("Skanning kräver säker anslutning", "På mobilwebb behöver kameraskanning vanligtvis https eller localhost. Testa den hostade sidan eller Expo-appen för att använda kameran.");
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

  async function handleBarcodeScanned({ data: scannedData }: { data: string }) {
    setScannerVisible(false);
    const matchedWine = data.wines.find((wine) => wine.barcode === scannedData);
    setDraft((current) => {
      const nextDraft = { ...current, barcode: scannedData };
      if (!matchedWine) return nextDraft;
      return {
        ...nextDraft,
        name: current.name || matchedWine.name,
        producer: current.producer || matchedWine.producer || "",
        country: current.country || matchedWine.country || "",
        region: current.region || matchedWine.region || "",
        grape: current.grape || matchedWine.grape || "",
        type: current.type || matchedWine.type || "Rött",
        foodPairings: current.foodPairings || matchedWine.food_pairings.join(", "),
        systembolagetProductId: current.systembolagetProductId || matchedWine.systembolaget_product_id || "",
      };
    });
    const match = await maybeSuggestCatalogMatch({ ...draft, barcode: scannedData });
    if (matchedWine) {
      Alert.alert("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
      return;
    }
    if (match) {
      await cacheCatalogEntry(match, session.user.id);
      setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
      Alert.alert("Produkt hittad", `Jag hittade ${match.name} från ${match.sourceLabel} och fyllde i tomma fält automatiskt.`);
      return;
    }
    Alert.alert("Ingen produktträff", "Streckkoden sparades. Fyll i vinets namn och detaljer nedan så kopplas de ihop automatiskt.");
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
    if (!catalogEditorDraft || !catalogEditorDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in ett namn innan du sparar katalogposten.");
      return;
    }
    setSavingCatalogEdit(true);
    try {
      const { error } = await supabase.from("product_catalog_wines").update({
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
      }).eq("id", catalogEditorDraft.id);
      if (error) throw error;
      closeCatalogEditor();
      await data.fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
    }
  }

  async function deleteCatalogEntryConfirmed(id: string) {
    setSavingCatalogEdit(true);
    try {
      const { error } = await supabase.from("product_catalog_wines").delete().eq("id", id);
      if (error) throw error;
      if (catalogEditorDraft?.id === id) closeCatalogEditor();
      await data.fetchCatalogEntries();
    } catch (error) {
      Alert.alert("Kunde inte ta bort produkt", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingCatalogEdit(false);
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
    if (savingDrinkHistory) return;
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
    if (savingWineEdit) return;
    setEditWineVisible(false);
    setEditingWine(null);
    setEditWineDraft(null);
  }

  // --- Image helpers ---

  async function chooseImage() {
    const uri = await images.pickImageFromLibrary();
    if (uri) setDraft((current) => ({ ...current, imageUri: uri }));
  }

  async function takeWinePhoto() {
    const uri = await images.takePhoto();
    if (uri) setDraft((current) => ({ ...current, imageUri: uri }));
  }

  async function chooseDrinkImage() {
    const uri = await images.pickImageFromLibrary();
    if (uri) setDrinkImageUri(uri);
  }

  async function takeDrinkPhoto() {
    const uri = await images.takePhoto();
    if (uri) setDrinkImageUri(uri);
  }

  // --- Save operations ---

  async function saveWine() {
    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill lägga till.");
      return;
    }
    const missingCatalogFields = getMissingCatalogFields(draft);
    if (!selectedCatalogNameEntry && missingCatalogFields.length > 0) {
      Alert.alert("Komplettera vinet", `Om vinet inte redan finns i katalogen behöver du fylla i: ${missingCatalogFields.join(", ")}. Då kan appen spara det i katalogen också.`);
      return;
    }
    setSaving(true);
    try {
      let imagePath: string | null = null;
      if (draft.imageUri) imagePath = await uploadWineImage(session.user.id, draft.imageUri);
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
      if (error) throw error;
      await cacheWineDraftAsCatalogEntry(payload, session.user.id);
      setDraft(defaultDraft);
      setSelectedCatalogNameEntry(null);
      await Promise.all([data.fetchWines(), data.fetchCatalogEntries(), data.fetchReferenceOptions()]);
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
      if (draft.imageUri) imagePath = await uploadWineImage(session.user.id, draft.imageUri);
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
        tasting_data: wsatData ?? null,
      };
      const { error } = await supabase.from("wine_history").insert(payload);
      if (error) throw error;
      setDraft(defaultDraft);
      setTastingRating("");
      setTastingDate(new Date().toISOString().slice(0, 10));
      setWsatData(null);
      await data.fetchHistoryEntries();
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingTasting(false);
    }
  }

  async function saveDrinkHistory() {
    if (!selectedDrinkWine) return;
    setSavingDrinkHistory(true);
    try {
      let imagePath = selectedDrinkWine.image_path;
      if (drinkImageUri) imagePath = await uploadWineImage(session.user.id, drinkImageUri);
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
      if (historyError) throw historyError;
      if (selectedDrinkWine.quantity <= 1) {
        const { error: deleteError } = await supabase.from("wines").delete().eq("id", selectedDrinkWine.id);
        if (deleteError) throw deleteError;
        data.setWines((current) => current.filter((wine) => wine.id !== selectedDrinkWine.id));
      } else {
        const { data: updatedData, error: updateError } = await supabase.from("wines").update({ quantity: selectedDrinkWine.quantity - 1 }).eq("id", selectedDrinkWine.id).select("*").single();
        if (updateError) throw updateError;
        const [hydrated] = await hydrateWineRecords([updatedData as WineRow]);
        data.setWines((current) => current.map((wine) => (wine.id === selectedDrinkWine.id ? hydrated : wine)));
      }
      await data.fetchHistoryEntries();
      closeDrinkModal();
    } catch (error) {
      Alert.alert("Kunde inte spara historiken", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingDrinkHistory(false);
    }
  }

  async function saveWineEdit() {
    if (!editingWine || !editWineDraft) return;
    if (!editWineDraft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill spara.");
      return;
    }
    const missingCatalogFields = getMissingCatalogFields(editWineDraft);
    if (missingCatalogFields.length > 0) {
      Alert.alert("Komplettera vinet", `Om vinet inte redan finns i katalogen behöver du fylla i: ${missingCatalogFields.join(", ")}. Då kan appen spara det i katalogen också.`);
      return;
    }
    setSavingWineEdit(true);
    try {
      const payload = buildWineInsertFromDraft(editWineDraft, editWineDraft.storageSpaceId, editWineDraft.storageRow, editWineDraft.storageSlot, editingWine.image_path);
      const { data: updatedData, error } = await supabase.from("wines").update(payload).eq("id", editingWine.id).select("*").single();
      if (error) throw error;
      const updatedWine = (updatedData ?? null) as WineRow | null;
      if (updatedWine) {
        await syncCatalogEntryForEditedWine(editingWine, updatedWine, session.user.id);
        const [hydrated] = await hydrateWineRecords([updatedWine]);
        data.setWines((current) => current.map((wine) => (wine.id === editingWine.id ? hydrated : wine)));
      }
      await data.fetchCatalogEntries();
      closeEditWineModal();
    } catch (error) {
      Alert.alert("Kunde inte spara ändringen", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSavingWineEdit(false);
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

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Kunde inte logga ut", error.message);
  }

  // --- Render ---

  let activePanel = (
    <MinKallarePanel
      styles={styles}
      stats={data.stats}
      searchQuery={filters.searchQuery}
      selectedPairingFilter={filters.selectedPairingFilter}
      selectedCountryFilter={filters.selectedCountryFilter}
      selectedRegionFilter={filters.selectedRegionFilter}
      selectedTypeFilter={filters.selectedTypeFilter}
      selectedVintageFilter={filters.selectedVintageFilter}
      pairingOptions={data.pairingOptions}
      countryOptions={data.countryOptions}
      regionOptions={data.regionOptions}
      typeOptions={data.typeOptions}
      vintageOptions={data.vintageOptions}
      storageSpaces={data.storageSpaces}
      storageSpaceBottleCounts={data.storageSpaceBottleCounts}
      filteredWines={filters.filteredWines}
      loading={data.loading}
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
      highlightedWineId={highlightedWineId}
      onClearHighlight={() => setHighlightedWineId(null)}
    />
  );

  if (activeSection === "history") {
    activePanel = (
      <HistoryPanel
        styles={styles}
        historyEntries={data.historyEntries}
        loadingHistory={data.loadingHistory}
        storageSpaceById={data.storageSpaceById}
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
        storageSpaces={data.storageSpaces}
        selectedStorageSpace={selectedStorageSpace}
        selectedStorageSpaceId={selectedStorageSpaceId}
        selectedStorageRow={selectedStorageRow}
        selectedStorageSlot={selectedStorageSlot}
        storageSpaceById={data.storageSpaceById}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions}
        effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows}
        regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
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
        wsatData={wsatData}
        onOpenWsat={() => setWsatModalVisible(true)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <BarcodeScannerModal visible={scannerVisible} styles={styles} onClose={() => setScannerVisible(false)} onBarcodeScanned={handleBarcodeScanned} />
      <WsatTastingModal
        visible={wsatModalVisible}
        wineType={draft.type}
        initialData={wsatData}
        onSave={(d) => setWsatData(d)}
        onClose={() => setWsatModalVisible(false)}
      />
      <VintagePickerModal visible={vintagePickerVisible} wineName={vintagePickerWineName} vintages={vintagePickerOptions} onSelectVintage={handleVintageSelected} onAddNew={handleVintageAddNew} onClose={() => setVintagePickerVisible(false)} styles={styles} />
      <CatalogEditorModal
        visible={catalogEditorVisible}
        styles={styles}
        draft={catalogEditorDraft}
        saving={savingCatalogEdit}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions}
        effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows}
        regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
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
        storageSpaces={data.storageSpaces}
        selectedStorageSpace={selectedEditStorageSpace}
        storageSpaceById={data.storageSpaceById}
        searchWineNames={data.searchCatalogWineNames}
        effectiveCountryOptions={data.effectiveCountryOptions}
        effectiveRegionOptions={data.effectiveRegionOptions}
        effectiveGrapeOptions={data.effectiveGrapeOptions}
        countryReferenceRows={data.countryReferenceRows}
        regionReferenceRows={data.regionReferenceRows}
        grapeReferenceRows={data.grapeReferenceRows}
        saving={savingWineEdit}
        onClose={closeEditWineModal}
        onDraftChange={(patch) => setEditWineDraft((current) => (current ? { ...current, ...patch } : current))}
        onStorageSpaceChange={(spaceId) => setEditWineDraft((current) => current ? { ...current, storageSpaceId: spaceId, storageRow: "1", storageSlot: "1" } : current)}
        onStorageRowChange={(value) => setEditWineDraft((current) => (current ? { ...current, storageRow: value } : current))}
        onStorageSlotChange={(value) => setEditWineDraft((current) => (current ? { ...current, storageSlot: value } : current))}
        onSave={saveWineEdit}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scrollFlex}>
        {activePanel}
      </ScrollView>
      <BottomTabBar activeSection={activeSection} sections={CELLAR_SECTIONS} styles={styles} onSelect={setActiveSection} />
    </SafeAreaView>
  );
}
