import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { WineDraft } from "../types/cellar-drafts";
import { AutocompleteInput, DoubleRow, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";

const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

export function WineCoreFields({ draft, tastingMode, selectedCatalogNameEntry, effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions, countryReferenceRows, regionReferenceRows, grapeReferenceRows, searchWineNames, onDraftChange, onNameSelected }: {
  draft: WineDraft; tastingMode: boolean; selectedCatalogNameEntry: ProductCatalogWineRow | null;
  effectiveCountryOptions: string[]; effectiveRegionOptions: string[]; effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[]; regionReferenceRows: ReferenceOptionRow[]; grapeReferenceRows: ReferenceOptionRow[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  onDraftChange: (patch: Partial<WineDraft>) => void; onNameSelected: (value: string, producer?: string | null) => void;
}) {
  const isLockedByCatalog = (field: keyof ProductCatalogWineRow) => {
    if (!selectedCatalogNameEntry) return false;
    const value = selectedCatalogNameEntry[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== "";
  };

  return (
    <>
      <AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} onOptionSelected={onNameSelected} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
      <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onDraftChange({ producer: value })} editable={!isLockedByCatalog("producer")} />
      <DoubleRow>
        <AutocompleteInput label="Land" value={draft.country} onChangeText={(value) => onDraftChange({ country: value })} options={effectiveCountryOptions} optionRows={countryReferenceRows} placeholder="Skriv t.ex. fr eller it" editable={!isLockedByCatalog("country")} />
        <AutocompleteInput label="Region" value={draft.region} onChangeText={(value) => onDraftChange({ region: value })} options={effectiveRegionOptions} optionRows={regionReferenceRows} placeholder="Skriv t.ex. bor, rio, nap..." editable={!isLockedByCatalog("region")} />
      </DoubleRow>
      <AutocompleteInput label="Druva" value={draft.grape} onChangeText={(value) => onDraftChange({ grape: value })} options={effectiveGrapeOptions} optionRows={grapeReferenceRows} placeholder="Nebbiolo, Chardonnay..." editable={!isLockedByCatalog("grape")} />
      {tastingMode ? (
        <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
      ) : (
        <DoubleRow>
          <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
          <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
        </DoubleRow>
      )}
      <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onDraftChange({ type: value })} disabled={isLockedByCatalog("type")} />
    </>
  );
}
