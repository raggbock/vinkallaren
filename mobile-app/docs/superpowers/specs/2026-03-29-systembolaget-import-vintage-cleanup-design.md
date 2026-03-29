# Systembolaget Import + Vintage Cleanup

## Overview

Three changes that improve wine catalog data quality and add Systembolaget as a source:

1. **Retroactive vintage cleanup** — strip trailing years from wine names, populate vintage field
2. **Scraper fixes** — all scrapers strip years from names going forward
3. **Systembolaget scraper** — new scraper to import wines from Systembolaget, skipping SB-IDs already in DB
4. **UI: vintage popup** — when a wine name has multiple vintages, let the user choose

## 1. Vintage Cleanup Migration

A one-time Supabase SQL migration on `product_catalog_wines`:

- Match trailing 4-digit year (1800-2099) in `name`, e.g. "Barolo Rocche 2021"
- If `vintage` is null: set it to the extracted year
- Remove the year from `name` (trim trailing whitespace)
- Runs on all existing rows

```sql
UPDATE product_catalog_wines
SET
  vintage = CASE
    WHEN vintage IS NULL
    THEN (regexp_match(name, '\m((?:18|19|20)\d{2})\s*$'))[1]
    ELSE vintage
  END,
  name = regexp_replace(name, '\s+(18|19|20)\d{2}\s*$', '')
WHERE name ~ '\m(18|19|20)\d{2}\s*$';
```

After migration, rows like:
- `name: "Barolo 2021", vintage: null` → `name: "Barolo", vintage: "2021"`
- `name: "Barolo 2021", vintage: "2021"` → `name: "Barolo", vintage: "2021"` (vintage kept)
- `name: "Cuvée 1896", vintage: null` → `name: "Cuvée", vintage: "1896"`

## 2. Scraper Name Normalization

All scraper scripts that produce JSON for the catalog pipeline must strip trailing years from `name` and put them in `vintage`. This applies to:

- `fetch-munskankarna-playwright.mjs` — already puts vintage in its own field from API data (`wineBottleYearName`), but `wineBottleName` from the API may still contain years. Strip trailing year from `name` after mapping.
- `fetch-winefinder-red-batch.mjs` — check and fix if needed
- Any future scrapers including the new Systembolaget scraper

Rule: after building the wine object, apply:
```js
const yearMatch = wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
if (yearMatch) {
  if (!wine.vintage) wine.vintage = yearMatch[1];
  wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
}
```

## 3. Systembolaget Scraper

### Source

Systembolaget.se has a product search. Investigate their search page for an underlying API (same approach that worked for Munskankarna — check network requests for JSON endpoints).

Filter: only wine categories (rott, vitt, rose, mousserande, dessert/sok). Exclude beer, spirits, cider, alcohol-free.

### Data to extract per wine

| Field | Source |
|---|---|
| name | Product name (strip trailing year) |
| producer | Producer/brand |
| country | Country of origin |
| region | Region |
| type | Category → normalized (Rott, Vitt, Rose, Mousserande, Sott) |
| vintage | Year (from name or dedicated field) |
| grape | Grape variety if available |
| systembolagetProductId | Article number |
| sourceLabel | "Systembolaget" |
| sourceUrl | Product page URL |

### Deduplication

Before importing, skip wines where `systembolagetProductId` already exists in the database. Query existing IDs first:

```js
const { data } = await supabase
  .from('product_catalog_wines')
  .select('systembolagetProductId')
  .not('systembolagetProductId', 'is', null);
const existingIds = new Set(data.map(r => r.systembolagetProductId));
```

Then filter the scraped wines before calling `import_catalog_wines` RPC.

### Output

- File: `data/catalog-sources/systembolaget-wine-batch.json`
- Add to `catalog-source-manifest.json` as a new source with appropriate priority
- npm script: `catalog:systembolaget:fetch`

## 4. UI: Vintage Popup on Wine Selection

### Current behavior

`handleWineNameSelected()` in App.tsx picks the first catalog match and auto-fills all fields including vintage.

### New behavior

When user selects a wine name from the autocomplete dropdown:

1. **Dropdown shows unique wine names** — deduplicate by name so "Barolo Rocche" appears once even if there are entries for 2020, 2021, 2022
2. **Check for multiple vintages** — query/filter catalog entries with the same name
3. **Single vintage** — auto-fill as today, no change
4. **Multiple vintages** — show a popup/modal:
   - Title: wine name
   - List of available vintages as tappable options (e.g. "2020", "2021", "2022")
   - Button: "Lagg till nytt" — dismisses popup and leaves vintage field empty for manual input
   - Selecting a vintage fills in all fields from that catalog entry

### Implementation location

- **App.tsx** `handleWineNameSelected()` — add vintage grouping logic
- **App.tsx** `fetchCatalogNameEntries()` — deduplicate names when building autocomplete options
- **New component or inline modal** in cellar-workflows.tsx — the vintage picker popup

### Deduplication for dropdown

When building `wineNameReferenceRows`, group by normalized name. Each name appears once. Store a map of name → [catalog entries with different vintages] for lookup when selected.
