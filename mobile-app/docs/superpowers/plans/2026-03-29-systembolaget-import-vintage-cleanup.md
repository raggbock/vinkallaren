# Systembolaget Import + Vintage Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up vintage data in wine catalog (strip years from names, populate vintage field), add Systembolaget as a catalog source, and add a vintage picker popup when a wine name has multiple vintages.

**Architecture:** Four independent workstreams executed sequentially: (1) DB migration to fix vintage constraint and clean existing data, (2) scraper fixes to prevent future dirty data, (3) new Systembolaget scraper + import, (4) UI changes for vintage-aware wine selection.

**Tech Stack:** Supabase (Postgres), Node.js scripts (fetch), React Native (Expo), TypeScript

---

### Task 1: Update vintage check constraint and clean existing data

**Files:**
- Create: `supabase/migrations/20260329_vintage_cleanup.sql`

This migration does three things: widen the vintage constraint from 1900 to 1800, extract trailing years from wine names into the vintage field, and strip the years from names.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260329_vintage_cleanup.sql`:

```sql
-- Step 1: Widen vintage constraint from 1900-2100 to 1800-2100
ALTER TABLE product_catalog_wines
  DROP CONSTRAINT product_catalog_wines_vintage_check;

ALTER TABLE product_catalog_wines
  ADD CONSTRAINT product_catalog_wines_vintage_check
  CHECK (vintage IS NULL OR vintage BETWEEN 1800 AND 2100);

-- Step 2: Extract trailing year from name into vintage (if vintage is null),
-- then strip the year from name.
UPDATE product_catalog_wines
SET
  vintage = CASE
    WHEN vintage IS NULL
    THEN (regexp_match(name, '\m((?:18|19|20)\d{2})\s*$'))[1]::integer
    ELSE vintage
  END,
  name = trim(regexp_replace(name, '\s+(18|19|20)\d{2}\s*$', ''))
WHERE name ~ '\m(18|19|20)\d{2}\s*$';
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP `apply_migration` or via the dashboard SQL editor. Verify by running:

```sql
-- Should return 0 rows (no names ending with a year)
SELECT name, vintage FROM product_catalog_wines
WHERE name ~ '\m(18|19|20)\d{2}\s*$'
LIMIT 10;
```

- [ ] **Step 3: Verify vintage constraint widened**

```sql
-- Should succeed (was blocked before)
SELECT count(*) FROM product_catalog_wines WHERE vintage < 1900 AND vintage >= 1800;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260329_vintage_cleanup.sql
git commit -m "feat: widen vintage constraint to 1800 and clean years from wine names"
```

---

### Task 2: Add vintage stripping to Munskankarna scraper

**Files:**
- Modify: `mobile-app/scripts/fetch-munskankarna-playwright.mjs` (the `mapWine` function, around line 78-101)

The Munskankarna API provides vintage in `wineBottleYearName`, but `wineBottleName` may still contain a trailing year. Strip it.

- [ ] **Step 1: Add `stripTrailingYear` helper and apply in `mapWine`**

Add this function before `mapWine` in `fetch-munskankarna-playwright.mjs`:

```js
function stripTrailingYear(wine) {
  const yearMatch = wine.name && wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!wine.vintage) wine.vintage = yearMatch[1];
    wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
  }
  return wine;
}
```

Then in `mapWine`, change the return to wrap through it:

```js
function mapWine(w) {
  // ... existing code building the wine object ...
  return stripTrailingYear({
    name: w.wineBottleName || null,
    producer: w.wineBottleProducerName || null,
    country: w.wineBottleCountryName || null,
    region,
    vintage: w.wineBottleYearName || null,
    type: normalizeType(w.wineBottleCategoryName),
    grape: parseGrapes(w.wineBottleRawMaterials),
    systembolagetProductId,
    sourceLabel: "Munskänkarna",
    sourceUrl: w.wineBottleUrl
      ? `https://www.munskankarna.se${w.wineBottleUrl}`
      : null,
  });
}
```

- [ ] **Step 2: Verify with a quick test**

```bash
cd mobile-app
timeout 20 node ./scripts/fetch-munskankarna-playwright.mjs /dev/null 2>&1 || true
```

Should run without errors. Check that the first page output doesn't have years in names.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-munskankarna-playwright.mjs
git commit -m "feat: strip trailing years from wine names in Munskankarna scraper"
```

---

### Task 3: Add vintage stripping to Winefinder scraper

**Files:**
- Modify: `mobile-app/scripts/fetch-winefinder-red-batch.mjs`

Check if the Winefinder scraper puts years in wine names. If so, add the same `stripTrailingYear` helper and apply it after building each wine object. If names are already clean, skip this task.

- [ ] **Step 1: Check existing output**

```bash
cd mobile-app
node -e "
const wines = JSON.parse(require('fs').readFileSync('./data/catalog-sources/winefinder-red-batch.json','utf8'));
const withYear = wines.filter(w => w.name && /\s+(18|19|20)\d{2}\s*$/.test(w.name));
console.log('Wines with year in name:', withYear.length, '/', wines.length);
if (withYear.length > 0) console.log('Examples:', withYear.slice(0,3).map(w => w.name));
"
```

- [ ] **Step 2: If wines have years in names, add `stripTrailingYear`**

Add the same helper function from Task 2 and apply it to each wine object before pushing to the output array. The exact location depends on the scraper structure — find where the wine object is built and wrap it.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add scripts/fetch-winefinder-red-batch.mjs
git commit -m "feat: strip trailing years from wine names in Winefinder scraper"
```

---

### Task 4: Add vintage stripping to import pipeline

**Files:**
- Modify: `mobile-app/scripts/import-munskankarna-rpc.mjs` (around line 48-59)

The RPC import script should also strip years from names as a safety net, in case the JSON file has dirty data.

- [ ] **Step 1: Add year stripping to normalization**

In `import-munskankarna-rpc.mjs`, update the `normalized` mapping (around line 48) to strip trailing years from names:

```js
const normalized = wines.map((w) => {
  let name = w.name;
  let vintage = w.vintage && /^\d{4}$/.test(w.vintage) ? w.vintage : null;

  // Strip trailing year from name, populate vintage if missing
  const yearMatch = name && name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!vintage) vintage = yearMatch[1];
    name = name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
  }

  return {
    name,
    producer: w.producer || null,
    country: w.country || null,
    region: w.region || null,
    type: normalizeType(w.type),
    vintage,
    grape: w.grape || null,
    systembolagetProductId: w.systembolagetProductId || null,
    sourceLabel: w.sourceLabel || "Munskänkarna",
    sourceConfidence: "catalog",
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/import-munskankarna-rpc.mjs
git commit -m "feat: strip trailing years from names in RPC import script"
```

---

### Task 5: Build Systembolaget scraper

**Files:**
- Create: `mobile-app/scripts/fetch-systembolaget.mjs`

This is the most investigative task. Systembolaget.se has a product search — we need to find the underlying API (same approach as Munskankarna).

- [ ] **Step 1: Investigate Systembolaget's search API**

Navigate to `https://www.systembolaget.se/sortiment/vin/` using Playwright MCP tools. Accept cookies, then check network requests for JSON API endpoints. Look for:
- A product listing/search endpoint that returns JSON
- Pagination mechanism (pageIndex, offset, page, etc.)
- How to filter by category (vin only)

Document the API URL, required headers, pagination params, and response structure.

- [ ] **Step 2: Write the scraper**

Create `mobile-app/scripts/fetch-systembolaget.mjs` following the same pattern as `fetch-munskankarna-playwright.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/systembolaget-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

// API_URL and pagination params discovered in Step 1
const API_URL = "..."; // fill in from investigation
const PAGE_SIZE = 100;
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset, retries = 3) {
  // Implementation based on discovered API
  // Must include wine-only filter
}

function stripTrailingYear(wine) {
  const yearMatch = wine.name && wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!wine.vintage) wine.vintage = yearMatch[1];
    wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
  }
  return wine;
}

function normalizeType(categoryName) {
  if (!categoryName) return null;
  const t = categoryName.toLowerCase().trim();
  if (t.includes("rött") || t.includes("rott")) return "Rött vin";
  if (t.includes("vitt")) return "Vitt vin";
  if (t.includes("rosé") || t.includes("rose")) return "Rosé";
  if (t.includes("mousserande") || t.includes("sparkling")) return "Mousserande";
  if (t.includes("dessert") || t.includes("sött")) return "Sött";
  if (t.includes("orange")) return "Orange";
  return categoryName.trim();
}

function mapWine(item) {
  // Map from Systembolaget's response format to our standard format
  // Exact field mapping depends on API response structure from Step 1
  return stripTrailingYear({
    name: "...",           // product name
    producer: "...",       // producer/brand
    country: "...",        // country
    region: "...",         // region
    vintage: "...",        // year if available
    type: normalizeType("..."), // category
    grape: "...",          // grape variety if available
    systembolagetProductId: "...", // article number
    sourceLabel: "Systembolaget",
    sourceUrl: "...",      // product page URL
  });
}

// Main
console.log("Fetching Systembolaget wine catalog via API...\n");

const merged = new Map();
// Paginate through all results, same pattern as Munskankarna scraper
// ...

const outputRows = [...merged.values()];
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");
console.log(`\nDone! Wrote ${outputRows.length} unique wines to ${outputPath}`);
```

**Note:** The exact API URL, headers, pagination, and field mapping MUST be filled in based on Step 1 investigation. Do not guess — inspect the actual network traffic.

- [ ] **Step 3: Run the scraper**

```bash
cd mobile-app
node scripts/fetch-systembolaget.mjs
```

Verify output file has thousands of wines with correct fields.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-systembolaget.mjs
git commit -m "feat: add Systembolaget wine catalog scraper"
```

---

### Task 6: Import Systembolaget wines to database

**Files:**
- Create: `mobile-app/scripts/import-systembolaget-rpc.mjs`
- Modify: `mobile-app/data/catalog-source-manifest.json`
- Modify: `mobile-app/package.json`

- [ ] **Step 1: Create the import script**

Create `mobile-app/scripts/import-systembolaget-rpc.mjs`. Same structure as `import-munskankarna-rpc.mjs` but with deduplication against existing SB-IDs:

```js
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Parse .env manually to avoid dotenv dependency
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const [, , inputArg = "./data/catalog-sources/systembolaget-wine-batch.json"] =
  process.argv;
const inputPath = path.resolve(process.cwd(), inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
console.log(`Loaded ${wines.length} wines from ${inputPath}`);

// Fetch existing systembolaget IDs to skip duplicates
console.log("Fetching existing Systembolaget IDs from database...");
const { data: existingRows, error: fetchError } = await supabase
  .from("product_catalog_wines")
  .select("systembolaget_product_id")
  .not("systembolaget_product_id", "is", null);

if (fetchError) {
  console.error("Failed to fetch existing IDs:", fetchError.message);
  process.exit(1);
}

const existingIds = new Set(existingRows.map((r) => r.systembolaget_product_id));
console.log(`Found ${existingIds.size} existing Systembolaget IDs in database`);

function normalizeType(value) {
  if (!value) return null;
  const t = String(value).trim();
  if (/^rött/i.test(t) || /rött vin/i.test(t)) return "Rött";
  if (/^vitt/i.test(t) || /vitt vin/i.test(t)) return "Vitt";
  if (/mousserande/i.test(t)) return "Mousserande";
  if (/^sött/i.test(t) || /dessert/i.test(t)) return "Sött";
  if (/rosé|rose/i.test(t)) return "Rosé";
  if (/orange/i.test(t)) return "Orange";
  return t;
}

const normalized = wines
  .filter((w) => {
    // Skip wines whose SB-ID already exists in DB
    if (w.systembolagetProductId && existingIds.has(w.systembolagetProductId)) {
      return false;
    }
    return true;
  })
  .map((w) => {
    let name = w.name;
    let vintage = w.vintage && /^\d{4}$/.test(String(w.vintage)) ? String(w.vintage) : null;

    const yearMatch = name && name.match(/\s+((?:18|19|20)\d{2})\s*$/);
    if (yearMatch) {
      if (!vintage) vintage = yearMatch[1];
      name = name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
    }

    return {
      name,
      producer: w.producer || null,
      country: w.country || null,
      region: w.region || null,
      type: normalizeType(w.type),
      vintage,
      grape: w.grape || null,
      systembolagetProductId: w.systembolagetProductId || null,
      sourceLabel: w.sourceLabel || "Systembolaget",
      sourceConfidence: "catalog",
    };
  });

console.log(`${wines.length - normalized.length} wines skipped (SB-ID already in DB)`);
console.log(`${normalized.length} new wines to import`);

const BATCH_SIZE = 200;
let totalImported = 0;

for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
  const batch = normalized.slice(i, i + BATCH_SIZE);

  const { data, error } = await supabase.rpc("import_catalog_wines", {
    wines: batch,
  });

  if (error) {
    console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
    continue;
  }

  const inserted = data ?? 0;
  totalImported += inserted;

  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(normalized.length / BATCH_SIZE);
  if (batchNum % 10 === 0 || batchNum === totalBatches) {
    console.log(
      `Batch ${batchNum}/${totalBatches}: +${inserted} (${totalImported} total new)`,
    );
  }
}

console.log(`\nDone! Imported ${totalImported} new wines into database.`);
```

- [ ] **Step 2: Update catalog-source-manifest.json**

Add Systembolaget source. It should have priority 1 (highest) since SB data is authoritative:

```json
{
  "source": "Systembolaget",
  "priority": 1,
  "files": [
    "./data/wine-name-seeds.json",
    "./data/systembolaget-wine-name-batch.json",
    "./data/systembolaget-wine-name-batch-2.json",
    "./data/catalog-sources/systembolaget-wine-batch.json"
  ]
}
```

Update the existing Systembolaget entry in `catalog-source-manifest.json` to add the new batch file to its `files` array.

- [ ] **Step 3: Add npm scripts to package.json**

Add these scripts to `package.json`:

```json
"catalog:systembolaget:fetch": "node ./scripts/fetch-systembolaget.mjs ./data/catalog-sources/systembolaget-wine-batch.json",
"catalog:systembolaget:rpc": "node ./scripts/import-systembolaget-rpc.mjs ./data/catalog-sources/systembolaget-wine-batch.json"
```

- [ ] **Step 4: Run the import**

```bash
cd mobile-app
npm run catalog:systembolaget:rpc
```

Verify the output shows new wines imported and duplicates skipped.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-systembolaget-rpc.mjs data/catalog-source-manifest.json package.json
git commit -m "feat: add Systembolaget import pipeline with SB-ID deduplication"
```

---

### Task 7: Deduplicate wine names in autocomplete dropdown

**Files:**
- Modify: `mobile-app/App.tsx` (lines 428-446, the `catalogWineNameReferenceRows`, `catalogNameEntryByName`, and `wineNameOptions` useMemo blocks)

Currently every catalog entry (including duplicates with different vintages) appears as a separate autocomplete option. We need to deduplicate by name.

- [ ] **Step 1: Build a `catalogEntriesByName` map (name → entry[])**

In `App.tsx`, add a new `useMemo` after `catalogNameEntryByName` (around line 446):

```tsx
const catalogEntriesByName = useMemo(() => {
  const map = new Map<string, ProductCatalogWineRow[]>();
  for (const entry of catalogNameEntries) {
    const key = normalizeLookupValue(entry.name);
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}, [catalogNameEntries]);
```

- [ ] **Step 2: Deduplicate `catalogWineNameReferenceRows`**

Change the `catalogWineNameReferenceRows` useMemo (line 428) to deduplicate by name, keeping only the best-scoring entry per name:

```tsx
const catalogWineNameReferenceRows = useMemo(() => {
  // Deduplicate: one reference row per unique wine name
  const bestByName = new Map<string, ProductCatalogWineRow>();
  for (const entry of catalogNameEntries) {
    const key = normalizeLookupValue(entry.name);
    const existing = bestByName.get(key);
    if (!existing || scoreCatalogCompleteness(entry) > scoreCatalogCompleteness(existing)) {
      bestByName.set(key, entry);
    }
  }
  return toWineNameReferenceRows([...bestByName.values()], "catalog-wine-name");
}, [catalogNameEntries]);
```

- [ ] **Step 3: Verify dropdown shows unique names**

Run the app. Search for a wine that has multiple vintages (e.g. "Barbaresco"). It should appear once in the dropdown, not once per vintage.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: deduplicate wine names in autocomplete dropdown"
```

---

### Task 8: Add vintage picker popup

**Files:**
- Modify: `mobile-app/src/components/cellar-workflows.tsx` (add VintagePickerModal component, around line 177)
- Modify: `mobile-app/App.tsx` (update `handleWineNameSelected` at line 501, add state for popup)

When a wine name has multiple vintages in the catalog, show a modal to let the user choose.

- [ ] **Step 1: Create VintagePickerModal component**

Add this component in `cellar-workflows.tsx` before the `AddWinePanel` function (before line 180):

```tsx
export function VintagePickerModal({
  visible,
  wineName,
  vintages,
  onSelectVintage,
  onAddNew,
  onClose,
  styles,
}: {
  visible: boolean;
  wineName: string;
  vintages: { year: string; entry: ProductCatalogWineRow }[];
  onSelectVintage: (entry: ProductCatalogWineRow) => void;
  onAddNew: () => void;
  onClose: () => void;
  styles: SharedStyles;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 20, width: "80%", maxHeight: "60%" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>{wineName}</Text>
          <Text style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>Välj årtal:</Text>
          <ScrollView>
            {vintages.map(({ year, entry }) => (
              <Pressable
                key={entry.id}
                onPress={() => onSelectVintage(entry)}
                style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }}
              >
                <Text style={{ fontSize: 16 }}>{year}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={onAddNew}
            style={{ marginTop: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#f0f0f0", borderRadius: 8 }}
          >
            <Text style={{ fontSize: 16, color: "#333" }}>Lägg till nytt</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

Add the needed imports at the top of `cellar-workflows.tsx` if not already present: `Modal`, `ScrollView`, `Pressable` from `react-native`, and `ProductCatalogWineRow` from the types.

- [ ] **Step 2: Add vintage picker state to App.tsx**

Add state variables near the other wine-related state (around line 421):

```tsx
const [vintagePickerVisible, setVintagePickerVisible] = useState(false);
const [vintagePickerWineName, setVintagePickerWineName] = useState("");
const [vintagePickerOptions, setVintagePickerOptions] = useState<{ year: string; entry: ProductCatalogWineRow }[]>([]);
```

- [ ] **Step 3: Update `handleWineNameSelected` to check for multiple vintages**

Replace the `handleWineNameSelected` function (lines 501-523) with:

```tsx
function handleWineNameSelected(name: string) {
  const entries = catalogEntriesByName.get(normalizeLookupValue(name)) ?? [];

  if (entries.length === 0) {
    setSelectedCatalogNameEntry(null);
    setDraft((current) => ({ ...current, name }));
    return;
  }

  // Collect unique vintages
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
    // Single vintage or no vintage — auto-fill as before
    const bestEntry = entries.reduce((best, e) =>
      scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best
    );
    applySelectedCatalogEntry(bestEntry);
    return;
  }

  // Multiple vintages — show picker
  setVintagePickerWineName(entries[0].name);
  setVintagePickerOptions(uniqueVintages);
  setVintagePickerVisible(true);
  // Set the name in draft immediately so the user sees it
  setDraft((current) => ({ ...current, name: entries[0].name }));
}

function applySelectedCatalogEntry(entry: ProductCatalogWineRow) {
  setSelectedCatalogNameEntry(entry);
  setDraft((current) => ({
    ...current,
    name: entry.name,
    producer: entry.producer ?? "",
    country: entry.country ?? "",
    region: entry.region ?? "",
    grape: entry.grape ?? "",
    vintage: entry.vintage ? String(entry.vintage) : "",
    type: entry.type ?? current.type,
    barcode: entry.barcode ?? "",
    systembolagetProductId: entry.systembolaget_product_id ?? "",
    foodPairings: entry.food_pairings.join(", "),
  }));
}

function handleVintageSelected(entry: ProductCatalogWineRow) {
  setVintagePickerVisible(false);
  applySelectedCatalogEntry(entry);
}

function handleVintageAddNew() {
  setVintagePickerVisible(false);
  // Fill from best entry but leave vintage empty
  const entries = catalogEntriesByName.get(normalizeLookupValue(vintagePickerWineName)) ?? [];
  if (entries.length > 0) {
    const bestEntry = entries.reduce((best, e) =>
      scoreCatalogCompleteness(e) > scoreCatalogCompleteness(best) ? e : best
    );
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
```

- [ ] **Step 4: Render the VintagePickerModal**

In the App.tsx JSX, add the modal near the other modals (find where other `<Modal>` components are rendered):

```tsx
<VintagePickerModal
  visible={vintagePickerVisible}
  wineName={vintagePickerWineName}
  vintages={vintagePickerOptions}
  onSelectVintage={handleVintageSelected}
  onAddNew={handleVintageAddNew}
  onClose={() => setVintagePickerVisible(false)}
  styles={styles}
/>
```

Add `VintagePickerModal` to the imports from `cellar-workflows.tsx`.

- [ ] **Step 5: Test the full flow**

1. Run the app
2. Start adding a wine
3. Type a wine name that has multiple vintages (e.g. "Barbaresco")
4. Select it from the dropdown
5. Verify the vintage picker popup appears with year options
6. Select a vintage — verify all fields fill in
7. Try again and click "Lagg till nytt" — verify vintage is empty

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/components/cellar-workflows.tsx
git commit -m "feat: add vintage picker popup for wines with multiple vintages"
```

---

### Task 9: Increase catalog query limit

**Files:**
- Modify: `mobile-app/App.tsx` (line 729)

The current `fetchCatalogNameEntries()` has `limit(5000)`. With Systembolaget + Munskankarna we may have 15,000+ wines. Increase the limit or paginate.

- [ ] **Step 1: Increase limit**

In `App.tsx`, change the `fetchCatalogNameEntries` function (line 729):

```tsx
async function fetchCatalogNameEntries() {
  const allEntries: ProductCatalogWineRow[] = [];
  let offset = 0;
  const pageSize = 5000;

  while (true) {
    const { data, error } = await supabase
      .from("product_catalog_wines")
      .select("*")
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) return;

    allEntries.push(...(data as ProductCatalogWineRow[]));

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  setCatalogNameEntries(allEntries);
}
```

- [ ] **Step 2: Commit**

```bash
git add App.tsx
git commit -m "feat: paginate catalog name entries to support 15k+ wines"
```
