import { useRef, useState } from "react";
import { findCatalogMatch, type ProductCatalogEntry } from "../lib/product-catalog";
import {
  applyCatalogLocksToDraft,
  mergeDraftWithCatalogSuggestion,
} from "../lib/wine-helpers";
import { defaultImportSelection, type ImportFieldSelection, type ImportMode, type WineDraft } from "../types/cellar-drafts";
import type { ProductCatalogWineRow } from "../types/product-catalog";

type CatalogLookupDeps = {
  selectedCatalogNameEntry: ProductCatalogWineRow | null;
};

export function useCatalogLookup(deps: CatalogLookupDeps) {
  const { selectedCatalogNameEntry } = deps;

  const [catalogSuggestion, setCatalogSuggestion] = useState<ProductCatalogEntry | null>(null);
  const [importSelection, setImportSelection] = useState<ImportFieldSelection>(defaultImportSelection);
  const [importMode, setImportMode] = useState<ImportMode>("custom");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const lookupSeqRef = useRef(0);

  function updateDraft(current: WineDraft, patch: Partial<WineDraft>): WineDraft {
    return applyCatalogLocksToDraft(current, patch, selectedCatalogNameEntry);
  }

  async function maybeSuggestCatalogMatch(nextDraft: WineDraft) {
    const barcode = nextDraft.barcode.trim();
    const systembolagetProductId = nextDraft.systembolagetProductId.trim();
    if (barcode.length < 8 && systembolagetProductId.length < 4) {
      setCatalogSuggestion(null);
      setLookupMessage("");
      return null;
    }
    const seq = ++lookupSeqRef.current;
    setLookupBusy(true);
    try {
      const match = await findCatalogMatch({ barcode, systembolagetProductId });
      if (seq !== lookupSeqRef.current) return null;
      const normalizedMatch = match && !match.barcode && barcode ? { ...match, barcode } : match;
      setCatalogSuggestion(normalizedMatch);
      setImportSelection(defaultImportSelection);
      setImportMode("custom");
      setLookupMessage(match ? `Träff hittad från ${match.sourceLabel}.` : barcode ? "Ingen träff på streckkoden ännu." : "Ingen träff på artikelnumret ännu.");
      return normalizedMatch;
    } catch {
      if (seq !== lookupSeqRef.current) return null;
      setCatalogSuggestion(null);
      setLookupMessage("Kunde inte hämta produktdata just nu.");
      return null;
    } finally {
      if (seq === lookupSeqRef.current) setLookupBusy(false);
    }
  }

  function applyCatalogSuggestion(
    _draft: WineDraft,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
    mode: ImportMode = importMode,
  ) {
    if (!catalogSuggestion) return;
    setDraft((current) => mergeDraftWithCatalogSuggestion(current, catalogSuggestion, mode, importSelection));
  }

  function toggleImportField(field: keyof ImportFieldSelection) {
    setImportSelection((current) => ({ ...current, [field]: !current[field] }));
    setImportMode("custom");
  }

  return {
    catalogSuggestion, importSelection, importMode, setImportMode,
    lookupBusy, lookupMessage, setLookupBusy, setLookupMessage,
    updateDraft, maybeSuggestCatalogMatch,
    applyCatalogSuggestion, toggleImportField,
  };
}
