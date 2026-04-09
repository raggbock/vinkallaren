# Wine Label Scanner (Phase 1)

## Goal

Add on-device wine label scanning to the existing barcode scanner flow. User takes a photo of a wine label, OCR extracts text on-device, and the app fuzzy-matches the result against the product catalog. No cloud APIs, no cost.

## Architecture

The feature hooks into the existing `BarcodeScannerModal`. When the barcode scanner is open and the user can't get a barcode read, they tap a "Fotografera etiketten" button. This captures a photo, runs on-device OCR via `@react-native-ml-kit/text-recognition` (Google ML Kit on Android, Apple Vision on iOS), parses the OCR output to extract wine name/producer/vintage, and queries Supabase using `pg_trgm` trigram similarity to find catalog matches.

If matches are found, a picker modal shows the top results for the user to choose from. The selected wine fills the form exactly like an existing catalog match does today. If no match is found, the OCR text is placed in the name field as a starting point. In both cases, the wine is saved to the user's cellar and the shared catalog via the existing `saveWine()` + `cacheCatalogEntry()` flow.

New wines that don't exist in the catalog are added without verification (phase 1 — small user base).

## New Dependency

`@react-native-ml-kit/text-recognition` — wraps Google ML Kit (Android) and Apple Vision (iOS) for on-device text recognition. Requires Expo dev client (not Expo Go). Free, no API keys.

## Database Changes

### Enable pg_trgm extension

```sql
create extension if not exists pg_trgm;
```

### Create trigram index

```sql
create index if not exists idx_catalog_wines_name_trgm
  on product_catalog_wines using gin (name gin_trgm_ops);
```

### RPC function

```sql
create or replace function match_catalog_by_text(query text, max_results int default 5)
returns table(id uuid, name text, producer text, vintage int, similarity real)
as $$
  select id, name, producer, vintage,
         similarity(name, query) as similarity
  from product_catalog_wines
  where similarity(name, query) > 0.2
  order by similarity desc
  limit max_results;
$$ language sql stable;
```

## User Flow

```
Barcode scanner is open (BarcodeScannerModal)
    |
User taps "Fotografera etiketten" button
    |
expo-image-picker captures photo (camera, with editing)
    |
@react-native-ml-kit/text-recognition runs OCR on-device (~200ms)
    |
parseWineLabel() extracts candidates: name, producer, vintage
    |
match_catalog_by_text RPC called with extracted name (+ producer if found)
    |
+-- Matches found --> LabelMatchPickerModal shows top 3-5 results
|                     User selects one --> form fills in (existing catalog flow)
|
+-- No matches --> Name field prefilled with OCR text, user corrects manually
|
+-- OCR failed --> Error message, user retries or enters manually
```

## New Files

| File | Responsibility |
|------|---------------|
| `src/lib/label-ocr.ts` | OCR invocation via ML Kit + wine label text parsing |
| `src/components/label-match-picker.tsx` | Modal showing top catalog matches for user selection |
| `supabase/migrations/YYYYMMDD_add_trgm_catalog_search.sql` | Enable pg_trgm, create index, create RPC function |

## Modified Files

| File | Change |
|------|--------|
| `src/components/cellar-workflows.tsx` | Add "Fotografera etiketten" button in BarcodeScannerModal |
| `App.tsx` | New state + handler: photo → OCR → match → picker → fill form |
| `src/hooks/useCellarData.ts` | New function `matchCatalogByText()` calling the RPC |
| `package.json` | Add `@react-native-ml-kit/text-recognition` |

## `label-ocr.ts` — API

```typescript
// Run ML Kit OCR on an image, return raw text blocks
function recognizeLabel(imageUri: string): Promise<TextBlock[]>

// Parse wine label text into structured candidates
function parseWineLabel(blocks: TextBlock[]): LabelParseResult

type LabelParseResult = {
  rawText: string;
  name: string | null;       // longest text line (likely wine name)
  producer: string | null;   // second longest text line
  vintage: string | null;    // 4-digit year 1700-2030, latest if multiple
  searchQuery: string;       // combined name + producer for trigram search
}
```

### Parsing strategy

1. **Vintage**: Find all 4-digit numbers in range 1700-2030. If multiple, pick the latest (most likely vintage vs postal code or similar).
2. **Wine name**: Longest text line that isn't purely a year. ML Kit returns blocks roughly by size — labels put the wine name largest.
3. **Producer**: Second longest text line, if sufficiently different from the wine name.
4. **Search query**: Concatenate name + producer for the trigram RPC call. If only name found, use that alone.

No advanced heuristics in phase 1. Trigram similarity handles accents, minor OCR errors, and partial matches.

## `label-match-picker.tsx` — UI

A half-height modal showing catalog matches:

- **Header**: "Möjliga matchningar"
- **Subtext**: "Resultatet baseras på etikettfoto och kan vara felaktigt. Kontrollera att vinet stämmer."
- **List**: Top 3-5 matches, each showing name + producer + vintage + similarity indicator
- **Best match pre-selected** (highest similarity score)
- **"Ingen av dessa" button**: Closes picker, prefills name field with OCR text instead
- **"Välj" button**: Confirms selection, fills form via existing catalog match flow

## User-Facing Messages

| Scenario | Message |
|----------|---------|
| Matches found | "Möjliga matchningar" + "Resultatet baseras på etikettfoto och kan vara felaktigt. Kontrollera att vinet stämmer." |
| No matches | "Inga matchningar hittades. Texten från etiketten har fyllts i — korrigera vid behov." |
| OCR failure | "Kunde inte läsa etiketten. Försök igen med bättre belysning." |

## Integration with Existing Code

### BarcodeScannerModal changes

Add a "Fotografera etiketten" button at the bottom of the camera view. Tapping it:
1. Closes the camera preview momentarily
2. Opens `expo-image-picker` camera capture (with editing enabled)
3. On photo taken: runs OCR → match → shows picker or fills form
4. On cancel: returns to barcode scanner

### App.tsx state additions

- `labelMatchResults: CatalogMatch[]` — results from trigram search
- `labelMatchPickerVisible: boolean` — controls picker modal visibility
- `labelOcrText: string | null` — raw parsed text for fallback prefill

### Save flow

No changes. The existing `saveWine()` + `cacheCatalogEntry()` handles everything. A label-scanned wine goes through the same path as a barcode-scanned or manually entered wine.

## Out of Scope (Phase 1)

- Cloud-based fallback (GPT-4o, self-hosted VLM) for difficult labels
- Label image storage or visual matching
- Crowd-sourced label verification
- Multi-language OCR optimization
- Live camera OCR (we use photo capture, not real-time frame processing)
