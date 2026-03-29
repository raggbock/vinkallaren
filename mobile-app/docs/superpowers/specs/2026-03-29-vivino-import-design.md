# Vivino Wine Catalog Import

## Overview

Add Vivino as a catalog source, starting with Italy, France, and USA. Includes a data cleanup migration to enforce that all catalog wines must have a vintage and producer, and a composite unique index to prevent cross-source duplicates.

## 1. Data Cleanup Migration

A one-time migration on `product_catalog_wines`:

- Delete all rows where `vintage IS NULL` or `producer IS NULL`
- Add composite unique index on `(name, producer, vintage)` — prevents any source from inserting a duplicate wine with the same name, producer, and vintage
- The existing `import_catalog_wines` RPC uses `ON CONFLICT DO NOTHING`, which will automatically respect this new index

```sql
DELETE FROM product_catalog_wines WHERE vintage IS NULL OR producer IS NULL;

CREATE UNIQUE INDEX product_catalog_wines_name_producer_vintage_uidx
  ON product_catalog_wines (name, producer, vintage);
```

After this migration, all importers (Systembolaget, Munskänkarna, Winefinder, Vivino) benefit from cross-source dedup.

## 2. Vivino Scraper

### API

Vivino has an internal JSON API that requires no authentication — only a User-Agent header.

- **Endpoint:** `GET https://www.vivino.com/api/explore/explore`
- **Pagination:** `page=N&per_page=50` (max 50 per page)
- **Filters:** `country_codes[]=XX`, `wine_type_ids[]=N`
- **Wine type IDs:** 1=Red, 2=White, 3=Sparkling, 4=Rosé, 7=Dessert

### Strategy

One pass per wine type per country. Countries: `it`, `fr`, `us`.

Expected volumes:
| Country | Red | White | Sparkling | Rosé | Dessert | Total |
|---------|-----|-------|-----------|------|---------|-------|
| Italy | 13,500 | 5,400 | 1,500 | 600 | 270 | ~21,200 |
| France | — | — | — | — | — | ~18,600 |
| USA | — | — | — | — | — | ~1,100 |
| **Total** | | | | | | **~41,000** |

After filtering out wines without a vintage (N.V.), expect ~35-40k wines.

### Field Mapping

| Our field | Vivino source |
|-----------|--------------|
| name | `vintage.wine.winery.name + " " + vintage.wine.name` |
| producer | `vintage.wine.winery.name` |
| country | `vintage.wine.region.country.name` |
| region | `vintage.wine.region.name_en` |
| vintage | `vintage.year` (skip if null) |
| type | From `wine_type_id`: 1→Rött, 2→Vitt, 3→Mousserande, 4→Rosé, 7→Sött |
| grape | `vintage.wine.style.grapes[].name` joined by ", " |
| sourceLabel | "Vivino" |

### Vintage stripping

Apply the same `stripTrailingYear` helper as other scrapers — if the constructed name ends with a 4-digit year, strip it and populate vintage from it (though Vivino provides vintage separately, this is a safety net).

### Deduplication within batch

Deduplicate by `vintage.wine.id` + `vintage.year` to avoid counting the same wine twice across overlapping API results.

### Rate limiting

400ms delay between requests. ~800 pages total = ~6 minutes.

### Output

File: `data/catalog-sources/vivino-wine-batch.json`

## 3. Import Script

`scripts/import-vivino-rpc.mjs` — same pattern as the other importers:

- Read JSON batch file
- Normalize type labels, validate vintage is a 4-digit year
- Skip wines without vintage or producer
- Call `import_catalog_wines` RPC in batches of 200
- The new composite unique index handles cross-source dedup automatically via `ON CONFLICT DO NOTHING`

## 4. Manifest and npm Scripts

Add Vivino to `catalog-source-manifest.json` as priority 6 (after Munskänkarna).

Add to `package.json`:
- `catalog:vivino:fetch` — runs the scraper
- `catalog:vivino:rpc` — runs the import

## 5. Existing Scraper Updates

All existing import scripts (`import-munskankarna-rpc.mjs`, `import-systembolaget-rpc.mjs`) should skip wines without a vintage, since these will now be rejected by the DB constraint. Add a filter step before the RPC call.
