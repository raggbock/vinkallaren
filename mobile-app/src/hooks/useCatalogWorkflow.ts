import { useState } from "react";
import { Alert, Platform } from "react-native";
import { showError } from "../lib/show-error";
import { useCameraPermissions } from "expo-camera";

import { cacheCatalogEntry, findCatalogMatch, saveOcrTextForCatalogEntry, type ProductCatalogEntry } from "../lib/product-catalog";
import { normalizeLookupValue } from "../lib/cellar-helpers";
import {
  applyCatalogLocksToDraft,
  mergeDraftWithCatalogSuggestion,
  scoreCatalogCompleteness,
} from "../lib/wine-helpers";
import { recognizeLabel, parseWineLabel, normalizeOcrText } from "../lib/label-ocr";
import { defaultImportSelection, type ImportFieldSelection, type ImportMode, type WineDraft } from "../types/cellar-drafts";
import type { CatalogTextMatch, ProductCatalogWineRow } from "../types/product-catalog";
import type { WineRecord } from "../types/wine";

type CatalogWorkflowDeps = {
  sessionUserId: string;
  wines: WineRecord[];
  fetchCatalogEntriesByName: (name: string) => Promise<ProductCatalogWineRow[]>;
  matchCatalogByText: (query: string, maxResults?: number, rawOcrQuery?: string, vintage?: number | null) => Promise<CatalogTextMatch[]>;
  takePhoto: () => Promise<string | null>;
};

export function useCatalogWorkflow(deps: CatalogWorkflowDeps) {
  const { sessionUserId, wines, fetchCatalogEntriesByName, matchCatalogByText, takePhoto } = deps;

  // --- Catalog lookup ---
  const [catalogSuggestion, setCatalogSuggestion] = useState<ProductCatalogEntry | null>(null);
  const [importSelection, setImportSelection] = useState<ImportFieldSelection>(defaultImportSelection);
  const [importMode, setImportMode] = useState<ImportMode>("custom");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [selectedCatalogNameEntry, setSelectedCatalogNameEntry] = useState<ProductCatalogWineRow | null>(null);

  // --- Label scanner ---
  const [labelMatches, setLabelMatches] = useState<CatalogTextMatch[]>([]);
  const [labelPickerVisible, setLabelPickerVisible] = useState(false);
  const [labelOcrText, setLabelOcrText] = useState<string | null>(null);
  const [labelRawOcrText, setLabelRawOcrText] = useState<string | null>(null);

  // --- Barcode scanner ---
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- Vintage picker ---
  const [vintagePickerVisible, setVintagePickerVisible] = useState(false);
  const [vintagePickerWineName, setVintagePickerWineName] = useState("");
  const [vintagePickerOptions, setVintagePickerOptions] = useState<{ year: string; entry: ProductCatalogWineRow }[]>([]);

  // --- Draft helpers ---

  function updateDraft(current: WineDraft, patch: Partial<WineDraft>): WineDraft {
    return applyCatalogLocksToDraft(current, patch, selectedCatalogNameEntry);
  }

  function applySelectedCatalogEntry(entry: ProductCatalogWineRow, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>, allEntries?: ProductCatalogWineRow[]) {
    setSelectedCatalogNameEntry(entry);
    // If this entry lacks grape, try to find it from another entry with same name/producer
    const grape = entry.grape ?? allEntries?.find((e) => e.grape)?.grape ?? "";
    setDraft((current) => ({
      ...current,
      name: entry.name,
      producer: entry.producer ?? "",
      country: entry.country ?? "",
      region: entry.region ?? "",
      grape,
      vintage: entry.vintage ? String(entry.vintage) : "",
      type: entry.type ?? current.type,
      barcode: entry.barcode ?? "",
      systembolagetProductId: entry.systembolaget_product_id ?? "",
      foodPairings: entry.food_pairings.join(", "),
    }));
  }

  async function handleWineNameSelected(name: string, producer: string | null | undefined, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    let entries = await fetchCatalogEntriesByName(name);
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
      applySelectedCatalogEntry(bestEntry, setDraft, entries);
      return;
    }
    setVintagePickerWineName(entries[0].name);
    setVintagePickerOptions(uniqueVintages);
    setVintagePickerVisible(true);
    setDraft((current) => ({ ...current, name: entries[0].name }));
  }

  function handleVintageSelected(entry: ProductCatalogWineRow, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setVintagePickerVisible(false);
    applySelectedCatalogEntry(entry, setDraft);
  }

  async function handleVintageAddNew(setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setVintagePickerVisible(false);
    const entries = await fetchCatalogEntriesByName(vintagePickerWineName);
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

  // --- Catalog suggestion ---

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
    } catch {
      setCatalogSuggestion(null);
      setLookupMessage("Kunde inte hämta produktdata just nu.");
      return null;
    } finally {
      setLookupBusy(false);
    }
  }

  function applyCatalogSuggestion(draft: WineDraft, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>, mode: ImportMode = importMode) {
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
      showError("Skanning kräver säker anslutning", "På mobilwebb behöver kameraskanning vanligtvis https eller localhost.");
      return;
    }
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        showError("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
        return;
      }
    }
    setScannerVisible(true);
  }

  async function handleBarcodeScanned(scannedData: string, draft: WineDraft, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setScannerVisible(false);
    const matchedWine = wines.find((wine) => wine.barcode === scannedData);
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
      await cacheCatalogEntry(match, sessionUserId);
      setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
      Alert.alert("Produkt hittad", `Jag hittade ${match.name} från ${match.sourceLabel} och fyllde i tomma fält automatiskt.`);
      return;
    }
    Alert.alert("Ingen produktträff", "Streckkoden sparades. Fyll i vinets namn och detaljer nedan.");
  }

  // --- Label scanning ---

  async function handleLabelPhoto(setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setScannerVisible(false);
    setLabelRawOcrText(null);
    const uri = await takePhoto();
    if (!uri) { setScannerVisible(true); return; }

    setLookupBusy(true);
    setLookupMessage("Läser etiketten...");
    try {
      const blocks = await recognizeLabel(uri);
      if (blocks.length === 0) { showLabelError(); return; }

      const parsed = parseWineLabel(blocks);
      if (!parsed.searchQuery) { showLabelError(); return; }

      setLabelOcrText(parsed.name);
      setLabelRawOcrText(parsed.rawText);
      if (parsed.vintage) {
        setDraft((current) => ({ ...current, vintage: current.vintage || parsed.vintage! }));
      }

      // Normalize the search query to handle OCR errors (accents, l/1/I, rn/m, etc.)
      const normalizedQuery = normalizeOcrText(parsed.searchQuery);
      const parsedVintage = parsed.vintage ? parseInt(parsed.vintage, 10) : null;
      const matches = await matchCatalogByText(normalizedQuery, 5, parsed.rawSearchQuery, parsedVintage);
      if (matches.length > 0) {
        setLabelMatches(matches);
        setLabelPickerVisible(true);
      } else {
        if (parsed.name) setDraft((current) => ({ ...current, name: current.name || parsed.name! }));
        if (parsed.producer) setDraft((current) => ({ ...current, producer: current.producer || parsed.producer! }));
        Alert.alert("Inga matchningar hittades", "Texten från etiketten har fyllts i — korrigera vid behov.");
      }
    } catch {
      showError("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
    } finally {
      setLookupBusy(false);
      setLookupMessage("");
    }
  }

  function showLabelError() {
    showError("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
    setLookupBusy(false);
    setLookupMessage("");
  }

  async function handleLabelMatchSelected(match: CatalogTextMatch, setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setLabelPickerVisible(false);
    setLabelMatches([]);
    if (labelRawOcrText) {
      void saveOcrTextForCatalogEntry(match.id, labelRawOcrText);
    }
    const entries = await fetchCatalogEntriesByName(match.name);
    if (entries.length > 0) {
      const best = entries.reduce((a, b) => scoreCatalogCompleteness(b) > scoreCatalogCompleteness(a) ? b : a);
      setSelectedCatalogNameEntry(best);
      setDraft((current) => ({
        ...current,
        name: best.name,
        producer: best.producer ?? current.producer,
        country: best.country ?? current.country,
        region: best.region ?? current.region,
        grape: best.grape ?? current.grape,
        type: best.type ?? current.type,
        vintage: best.vintage?.toString() ?? current.vintage,
        foodPairings: best.food_pairings?.join(", ") || current.foodPairings,
        barcode: best.barcode ?? current.barcode,
        systembolagetProductId: best.systembolaget_product_id ?? current.systembolagetProductId,
      }));
    } else {
      setDraft((current) => ({
        ...current,
        name: match.name,
        producer: match.producer ?? current.producer,
        vintage: match.vintage?.toString() ?? current.vintage,
      }));
    }
  }

  function handleLabelMatchDismissed(setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setLabelPickerVisible(false);
    setLabelMatches([]);
    if (labelOcrText) {
      setDraft((current) => ({ ...current, name: current.name || labelOcrText! }));
      Alert.alert("Ingen matchning vald", "Texten från etiketten har fyllts i — korrigera vid behov.");
    } else {
      Alert.alert("Ingen matchning vald", "Fyll i vinets uppgifter manuellt.");
    }
  }

  return {
    // Catalog lookup
    catalogSuggestion, importSelection, importMode, setImportMode,
    lookupBusy, lookupMessage,
    selectedCatalogNameEntry, setSelectedCatalogNameEntry,
    updateDraft, maybeSuggestCatalogMatch,
    applyCatalogSuggestion, toggleImportField,
    // Name/vintage selection
    handleWineNameSelected, handleVintageSelected, handleVintageAddNew,
    vintagePickerVisible, setVintagePickerVisible, vintagePickerWineName, vintagePickerOptions,
    // Barcode scanner
    scannerVisible, setScannerVisible, startBarcodeScanner, handleBarcodeScanned,
    // Label scanner
    labelMatches, labelPickerVisible, handleLabelPhoto,
    handleLabelMatchSelected, handleLabelMatchDismissed,
  };
}
