# Unified Wine Search — Design Spec

## Problem

The "Snabbimport" section in the add-wine form has three separate input methods (barcode, article number, name search) spread across multiple sections. Barcode scanning is useless with only ~3 barcodes in the database. The name search is buried under "Om vinet". Users don't know where to start.

## Solution

Replace the "Snabbimport" section with a single unified search field at the top of the form. Clicking a result fills in all fields directly. Article number and label scanning are available behind a "Fler alternativ" toggle.

## User Flow

1. User opens "Lägg till" tab
2. First thing they see: search field with placeholder "Sök vin eller producent..."
3. Types 4+ characters → results appear as a list showing name, producer, country
4. Clicks a result → all fields populated (name, producer, country, region, grape, type, vintage, food pairings, article number)
5. User adjusts fields if needed, saves

If no result matches, user fills in fields manually as before.

## Component Changes

### `add-wine-panel.tsx`
- Remove `<SectionLabel label="Snabbimport" />` and `<QuickImportSection>` and `<CatalogImportCard>`
- Add unified search field at the top (before "Om vinet"), using existing `AutocompleteInput` with `searchWineNames`
- On result selected: call `onNameSelected` which already populates fields, then also apply the full catalog entry via `onApplyCatalogSuggestion("all")`
- Add a "Fler alternativ" expandable section containing article number input and label scan button (mobile only)

### `quick-import-section.tsx`
- Simplify to only contain: article number field + label scan button
- Remove barcode field, barcode scanner button, all barcode-related prompts
- This component is now only rendered inside "Fler alternativ"

### `catalog-import-card.tsx`
- Delete entirely. No more import mode selection — results auto-fill all fields.

### `wine-core-fields.tsx`
- Remove `AutocompleteInput` for name field, replace with plain `LabeledInput`
- The autocomplete search is now handled by the unified search above

### `cellar-workflows.tsx` / `App.tsx`
- Remove `onBarcodeChange` prop and barcode lookup logic
- Keep `onArticleNumberChange` and article number lookup
- Keep `catalogSuggestion` flow but auto-apply on search result selection

## Props Removed
- `onBarcodeChange`
- `onStartBarcodeScanner`  
- `importMode` / `onSetImportMode` / `onToggleImportField` / `importSelection`

## Props Kept
- `searchWineNames` — moved to top-level search
- `onNameSelected` — still fills in fields
- `onArticleNumberChange` — inside "Fler alternativ"
- `onScanLabel` — inside "Fler alternativ" (mobile only)
- `catalogSuggestion` / `onApplyCatalogSuggestion` — auto-applied on selection

## Out of Scope
- Changing the search algorithm or database
- Adding new search capabilities (fuzzy, phonetic)
- Barcode scanning improvements
