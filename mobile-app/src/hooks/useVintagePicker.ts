import { useState } from "react";
import { scoreCatalogCompleteness } from "../lib/wine-helpers";
import type { WineDraft } from "../types/cellar-drafts";
import type { ProductCatalogWineRow } from "../types/product-catalog";

type VintagePickerDeps = {
  fetchCatalogEntriesByName: (name: string, producer?: string | null) => Promise<ProductCatalogWineRow[]>;
  setSelectedCatalogNameEntry: (entry: ProductCatalogWineRow | null) => void;
};

export function useVintagePicker(deps: VintagePickerDeps) {
  const { fetchCatalogEntriesByName, setSelectedCatalogNameEntry } = deps;

  const [vintagePickerVisible, setVintagePickerVisible] = useState(false);
  const [vintagePickerWineName, setVintagePickerWineName] = useState("");
  const [vintagePickerOptions, setVintagePickerOptions] = useState<{ year: string; entry: ProductCatalogWineRow }[]>([]);
  const [vintagePickerLoading, setVintagePickerLoading] = useState(false);

  function applySelectedCatalogEntry(
    entry: ProductCatalogWineRow,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
    allEntries?: ProductCatalogWineRow[],
  ) {
    setSelectedCatalogNameEntry(entry);
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

  async function handleWineNameSelected(
    name: string,
    producer: string | null | undefined,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
  ) {
    setVintagePickerWineName(name);
    setVintagePickerOptions([]);
    setVintagePickerLoading(true);
    setVintagePickerVisible(true);

    const entries = await fetchCatalogEntriesByName(name, producer);
    setVintagePickerLoading(false);

    if (entries.length === 0) {
      setVintagePickerVisible(false);
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
      setVintagePickerVisible(false);
      const bestEntry = entries.reduce((best, e) => scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best);
      applySelectedCatalogEntry(bestEntry, setDraft, entries);
      return;
    }
    setVintagePickerWineName(entries[0].name);
    setVintagePickerOptions(uniqueVintages);
    setDraft((current) => ({ ...current, name: entries[0].name }));
  }

  function handleVintageSelected(
    entry: ProductCatalogWineRow,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
  ) {
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

  return {
    vintagePickerVisible, setVintagePickerVisible,
    vintagePickerWineName, vintagePickerOptions, vintagePickerLoading,
    handleWineNameSelected, handleVintageSelected, handleVintageAddNew,
  };
}
