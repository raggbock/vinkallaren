# Improved Autocomplete Search

## Problem

The current autocomplete in `useAutocompleteSearch` uses ILIKE (`%query%`) on `name` only. This means:

- No fuzzy matching (typos like "bordo" won't find "Bordeaux")
- No producer search (can't type "Antinori" and find their wines)
- No OCR text matching (label text not leveraged)
- ILIKE with leading wildcard can't use B-tree indexes efficiently

## Solution

Replace the ILIKE autocomplete with a new Supabase RPC function that uses trigram similarity across multiple fields.

### New RPC function: `autocomplete_catalog`

**Parameters:**
- `query text` — user input
- `max_results int default 20` — result limit

**Search fields and weights:**
- `name` — weight 1.0 (primary)
- `producer` — weight 0.9
- `image_ocr_text` — weight 0.6

**Scoring:**
```sql
score = greatest(
  similarity(immutable_unaccent(lower(name)), normalized_query) * 1.0,
  similarity(immutable_unaccent(lower(producer)), normalized_query) * 0.9,
  similarity(immutable_unaccent(lower(image_ocr_text)), normalized_query) * 0.6
)
```

**Threshold:** 0.15 minimum score to appear in results.

**Return type:** `(id uuid, name text, producer text, vintage int, image_url text, score float)`

Sorted by score descending, limited to `max_results`.

### New index

Add GIN trigram index on `producer` (normalized):
```sql
CREATE INDEX idx_catalog_wines_producer_trgm_norm
ON product_catalog_wines
USING gin (immutable_unaccent(lower(producer)) gin_trgm_ops);
```

Existing indexes on `name` and `image_ocr_text` already cover those fields.

### Frontend changes

**File:** `mobile-app/src/lib/catalog-search.ts`
- Add `autocompleteCatalog(query, maxResults)` function calling the new RPC

**File:** `mobile-app/src/hooks/useAutocompleteSearch.ts`
- Replace ILIKE-based `searchCatalogWineNames` call with `autocompleteCatalog`
- Change debounce from 300ms to 150ms
- Adapt suggestion mapping to new return shape (now includes producer and score)

**File:** `mobile-app/src/components/autocomplete-input.tsx`
- Display producer alongside wine name in suggestions (e.g., "Tignanello — Antinori")

### What this does NOT change

- The existing `match_catalog_by_text` RPC (used for OCR/camera workflow) stays as-is
- Image matching is out of scope
- No new infrastructure needed — stays in Postgres/Supabase

## Performance

- GIN trigram indexes support the `%` operator for index-accelerated similarity
- Expected response time: 20-50ms for ~20k wines
- 150ms debounce keeps UI responsive without excessive queries

## Migration

One new migration file containing:
1. The producer trigram index
2. The `autocomplete_catalog` function
