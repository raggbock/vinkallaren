import { useState } from "react";
import { Platform } from "react-native";
import { saveOcrTextForCatalogEntry } from "../lib/product-catalog";
import { scoreCatalogCompleteness } from "../lib/wine-helpers";
import { recognizeLabel, parseWineLabel, normalizeOcrText } from "../lib/label-ocr";
import { computeImageHashes } from "../lib/image-hash";
import { matchCatalogByImage, mergeHybridMatches } from "../lib/catalog-search";
import type { WineDraft } from "../types/cellar-drafts";
import type { CatalogTextMatch, ProductCatalogWineRow } from "../types/product-catalog";

type LabelScannerDeps = {
  takePhoto: () => Promise<string | null>;
  matchCatalogByText: (query: string, maxResults?: number, rawOcrQuery?: string, vintage?: number | null) => Promise<CatalogTextMatch[]>;
  fetchCatalogEntriesByName: (name: string, producer?: string | null) => Promise<ProductCatalogWineRow[]>;
  setScannerVisible: (visible: boolean) => void;
  setLookupBusy: (busy: boolean) => void;
  setLookupMessage: (msg: string) => void;
  setSelectedCatalogNameEntry: (entry: ProductCatalogWineRow | null) => void;
};

export function useLabelScanner(deps: LabelScannerDeps) {
  const {
    takePhoto, matchCatalogByText, fetchCatalogEntriesByName,
    setScannerVisible, setLookupBusy, setLookupMessage, setSelectedCatalogNameEntry,
  } = deps;

  const [labelMatches, setLabelMatches] = useState<CatalogTextMatch[]>([]);
  const [labelPickerVisible, setLabelPickerVisible] = useState(false);
  const [labelOcrText, setLabelOcrText] = useState<string | null>(null);
  const [labelRawOcrText, setLabelRawOcrText] = useState<string | null>(null);

  function showLabelError() {
    setLookupBusy(false);
    setLookupMessage("Kunde inte läsa etiketten. Försök igen med bättre belysning.");
  }

  async function handleLabelPhoto(setDraft: React.Dispatch<React.SetStateAction<WineDraft>>) {
    setScannerVisible(false);
    setLabelRawOcrText(null);
    const uri = await takePhoto();
    if (!uri) { setScannerVisible(true); return; }

    setLookupBusy(true);
    setLookupMessage("Läser etiketten...");
    try {
      const ocrTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000));
      const blocks = await Promise.race([recognizeLabel(uri), ocrTimeout]);
      if (blocks.length === 0) { showLabelError(); return; }

      const parsed = parseWineLabel(blocks);

      if (!parsed.searchQuery && Platform.OS === "web") {
        setLookupMessage("Ingen text hittad, provar bildmatchning...");
        try {
          const hashes = await computeImageHashes(uri);
          const imageMatches = await matchCatalogByImage(hashes, 5);
          if (imageMatches.length > 0) {
            const asTextMatches = imageMatches.map((m) => ({
              ...m, similarity: 1 - m.hash_distance / 64,
            }));
            setLabelMatches(asTextMatches);
            setLabelPickerVisible(true);
            setLookupMessage("");
            return;
          }
        } catch { /* fall through */ }
        showLabelError();
        return;
      }
      if (!parsed.searchQuery) { showLabelError(); return; }

      setLabelOcrText(parsed.name);
      setLabelRawOcrText(parsed.rawText);
      if (parsed.vintage) {
        setDraft((current) => ({ ...current, vintage: current.vintage || parsed.vintage! }));
      }

      setLookupMessage("Söker i katalogen...");
      const normalizedQuery = normalizeOcrText(parsed.searchQuery);
      const parsedVintage = parsed.vintage ? parseInt(parsed.vintage, 10) : null;

      const imageHashPromise = Platform.OS === "web"
        ? computeImageHashes(uri).then((h) => matchCatalogByImage(h, 5)).catch(() => [])
        : Promise.resolve([]);
      const [textMatches, imageMatches] = await Promise.all([
        matchCatalogByText(normalizedQuery, 5, parsed.rawSearchQuery, parsedVintage),
        imageHashPromise,
      ]);
      const matches = mergeHybridMatches(textMatches, imageMatches, 5);

      if (matches.length > 0) {
        setLabelMatches(matches);
        setLabelPickerVisible(true);
        setLookupMessage("");
      } else {
        if (parsed.name) setDraft((current) => ({ ...current, name: current.name || parsed.name! }));
        if (parsed.producer) setDraft((current) => ({ ...current, producer: current.producer || parsed.producer! }));
        setLookupMessage("Ingen katalogträff — etikettexten har fyllts i, korrigera vid behov.");
      }
    } catch (err) {
      const msg = err instanceof Error && err.message === "timeout"
        ? "OCR tog för lång tid. Försök med en tydligare bild."
        : "Kunde inte läsa etiketten. Försök igen med bättre belysning.";
      setLookupMessage(msg);
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleLabelMatchSelected(
    match: CatalogTextMatch,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
  ) {
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
      setLookupMessage("Ingen matchning vald — etikettexten har fyllts i, korrigera vid behov.");
    } else {
      setLookupMessage("Ingen matchning vald. Fyll i vinets uppgifter manuellt.");
    }
  }

  return {
    labelMatches, labelPickerVisible,
    handleLabelPhoto, handleLabelMatchSelected, handleLabelMatchDismissed,
  };
}
