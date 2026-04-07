import type { ReferenceOptionRow } from "../types/reference-data";
import type { WineDraft } from "../types/cellar-drafts";
import { AutocompleteInput, DoubleRow, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";

const WINE_TYPE_OPTIONS = ["Rött", "Vitt", "Mousserande", "Sött"];

export function WineCoreFields({ draft, tastingMode, effectiveCountryOptions, effectiveRegionOptions, effectiveGrapeOptions, countryReferenceRows, regionReferenceRows, grapeReferenceRows, searchWineNames, onDraftChange, onNameSelected }: {
  draft: WineDraft; tastingMode: boolean;
  effectiveCountryOptions: string[]; effectiveRegionOptions: string[]; effectiveGrapeOptions: string[];
  countryReferenceRows: ReferenceOptionRow[]; regionReferenceRows: ReferenceOptionRow[]; grapeReferenceRows: ReferenceOptionRow[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  onDraftChange: (patch: Partial<WineDraft>) => void; onNameSelected: (value: string, producer?: string | null) => void;
}) {
  return (
    <>
      <AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} onOptionSelected={onNameSelected} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
      <LabeledInput label="Producent" value={draft.producer} onChangeText={(value) => onDraftChange({ producer: value })} />
      <DoubleRow>
        <AutocompleteInput label="Land" value={draft.country} onChangeText={(value) => onDraftChange({ country: value })} options={effectiveCountryOptions} optionRows={countryReferenceRows} placeholder="Skriv t.ex. fr eller it" />
        <AutocompleteInput label="Region" value={draft.region} onChangeText={(value) => onDraftChange({ region: value })} options={effectiveRegionOptions} optionRows={regionReferenceRows} placeholder="Skriv t.ex. bor, rio, nap..." />
      </DoubleRow>
      <AutocompleteInput label="Druva" value={draft.grape} onChangeText={(value) => onDraftChange({ grape: value })} options={effectiveGrapeOptions} optionRows={grapeReferenceRows} placeholder="Nebbiolo, Chardonnay..." />
      {tastingMode ? (
        <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
      ) : (
        <DoubleRow>
          <LabeledInput label="Årgång" value={draft.vintage} onChangeText={(value) => onDraftChange({ vintage: value })} keyboardType="number-pad" />
          <LabeledInput label="Antal" value={draft.quantity} onChangeText={(value) => onDraftChange({ quantity: value })} keyboardType="number-pad" />
        </DoubleRow>
      )}
      <SuggestionRow title="Vintyp" options={WINE_TYPE_OPTIONS} selected={draft.type} onSelect={(value) => onDraftChange({ type: value })} />
    </>
  );
}
