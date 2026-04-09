# Autocomplete Search Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ILIKE-based autocomplete with trigram fuzzy search across name, producer, and OCR text fields.

**Architecture:** New Supabase RPC function `autocomplete_catalog` using pg_trgm similarity across three fields with weighted scoring. Frontend swaps the ILIKE call for the new RPC and reduces debounce to 150ms.

**Tech Stack:** PostgreSQL (pg_trgm), Supabase RPC, TypeScript/React Native

---

### Task 1: Add producer trigram index and `autocomplete_catalog` RPC

**Files:**
- Create: `mobile-app/supabase/migrations/20260409100000_autocomplete_catalog.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- GIN trigram index on normalized producer for autocomplete
create index if not exists idx_catalog_wines_producer_trgm_norm
  on product_catalog_wines using gin (public.immutable_unaccent(lower(producer)) gin_trgm_ops);

-- Autocomplete: fuzzy search across name, producer, and OCR text
create or replace function autocomplete_catalog(query text, max_results int default 20)
returns table(id uuid, name text, producer text, vintage int, image_url text, score real)
as $$
begin
  if length(trim(query)) < 2 then
    return;
  end if;

  perform set_config('pg_trgm.similarity_threshold', '0.15', true);

  return query
  select w.id, w.name, w.producer, w.vintage, w.image_url,
         greatest(
           similarity(public.immutable_unaccent(lower(w.name)), public.immutable_unaccent(lower(query))),
           coalesce(similarity(public.immutable_unaccent(lower(w.producer)), public.immutable_unaccent(lower(query))), 0) * 0.9,
           coalesce(similarity(public.immutable_unaccent(lower(w.image_ocr_text)), public.immutable_unaccent(lower(query))), 0) * 0.6
         )::real as score
  from product_catalog_wines w
  where public.immutable_unaccent(lower(w.name)) % public.immutable_unaccent(lower(query))
     or public.immutable_unaccent(lower(w.producer)) % public.immutable_unaccent(lower(query))
     or public.immutable_unaccent(lower(w.image_ocr_text)) % public.immutable_unaccent(lower(query))
  order by score desc
  limit max_results;
end;
$$ language plpgsql stable;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run the SQL above via the Supabase MCP `execute_sql` tool against project `gonspypbhqvfvpgwsdtu`.

- [ ] **Step 3: Verify the function exists**

Run via Supabase MCP:
```sql
select autocomplete_catalog('chateau', 5);
```
Expected: Returns rows with id, name, producer, vintage, image_url, score columns. Results should include wines with "château" in name despite missing accent.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/supabase/migrations/20260409100000_autocomplete_catalog.sql
git commit -m "feat: add autocomplete_catalog RPC with trigram search"
```

---

### Task 2: Replace ILIKE autocomplete with new RPC in catalog-search.ts

**Files:**
- Modify: `mobile-app/src/lib/catalog-search.ts:8-35`

- [ ] **Step 1: Replace `searchCatalogWineNames` function body**

Replace the entire `searchCatalogWineNames` function (lines 8–35) with:

```typescript
export async function searchCatalogWineNames(
  query: string, offset = 0,
): Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { suggestions: [], hasMore: false, nextOffset: offset };

  const pageSize = 20;
  const { data, error } = await supabase.rpc("autocomplete_catalog", {
    query: trimmed,
    max_results: pageSize + 1,
  });
  if (error) return { suggestions: [], hasMore: false, nextOffset: offset };

  const rows = (data ?? []) as { id: string; name: string; producer: string | null; vintage: number | null; image_url: string | null; score: number }[];
  const hasMore = rows.length > pageSize;
  const results: Suggestion[] = rows.slice(0, pageSize).map((row) => ({
    name: row.name,
    parentName: row.producer ?? null,
  }));

  return { suggestions: results, hasMore, nextOffset: offset + results.length };
}
```

Note: The function signature and return type stay identical — all callers (`useCellarData`, `App.tsx`, components) continue working unchanged. The `offset` parameter is accepted but not used by the RPC (trigram results are score-ranked, not paginated). The `hasMore` flag uses the N+1 trick.

- [ ] **Step 2: Remove unused `BATCH_SIZE` constant**

Delete line 6:
```typescript
const BATCH_SIZE = 50;
```

- [ ] **Step 3: Verify the app compiles**

Run:
```bash
cd mobile-app && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add mobile-app/src/lib/catalog-search.ts
git commit -m "feat: switch autocomplete to trigram RPC"
```

---

### Task 3: Reduce debounce to 150ms

**Files:**
- Modify: `mobile-app/src/hooks/useAutocompleteSearch.ts:9`

- [ ] **Step 1: Change the debounce constant**

Change line 9 from:
```typescript
const SEARCH_DEBOUNCE_MS = 300;
```
to:
```typescript
const SEARCH_DEBOUNCE_MS = 150;
```

- [ ] **Step 2: Verify the app compiles**

Run:
```bash
cd mobile-app && npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/hooks/useAutocompleteSearch.ts
git commit -m "perf: reduce autocomplete debounce to 150ms"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Test fuzzy name search**

Open the app, go to "Lägg till vin", type "bordo" in the name field.
Expected: Results include wines from Bordeaux region or with Bordeaux in the name.

- [ ] **Step 2: Test producer search**

Type "antinori" in the name field.
Expected: Results include wines by Antinori (shown as "Wine Name (Antinori)").

- [ ] **Step 3: Test accent-insensitive search**

Type "chateau" (no accent) in the name field.
Expected: Results include "Château ..." wines.

- [ ] **Step 4: Test short query rejection**

Type a single character "a".
Expected: No suggestions shown (minimum 2 chars in RPC + 4 char minimum in UI component).

- [ ] **Step 5: Test responsiveness**

Type and observe debounce. Results should appear noticeably faster than before (~150ms vs 300ms).
