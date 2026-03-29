# Vivino Wine Catalog Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import ~35-40k wines from Vivino (Italy, France, USA) into the product catalog, with cross-source deduplication on name+producer+vintage.

**Architecture:** A cleanup migration removes vintless/producerless wines and adds a composite unique index. A Node.js scraper fetches wines from Vivino's internal JSON API by country and type. An import script pushes them to Supabase via the existing `import_catalog_wines` RPC, with the unique index handling cross-source dedup automatically.

**Tech Stack:** Node.js (fetch), Supabase (Postgres), existing `import_catalog_wines` RPC

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260329_vivino_cleanup.sql` | Create | Delete wines without vintage/producer, add composite unique index |
| `scripts/fetch-vivino-batch.mjs` | Create | Scrape Vivino API by country+type, output JSON batch |
| `scripts/import-vivino-rpc.mjs` | Create | Read batch JSON, normalize, call RPC in batches |
| `scripts/import-munskankarna-rpc.mjs` | Modify | Add vintage/producer filter before import |
| `scripts/import-systembolaget-rpc.mjs` | Modify | Add vintage/producer filter before import |
| `data/catalog-source-manifest.json` | Modify | Add Vivino source entry |
| `package.json` | Modify | Add vivino fetch/rpc npm scripts |

---

### Task 1: Cleanup migration — remove vintless wines, add unique index

**Files:**
- Create: `mobile-app/supabase/migrations/20260329_vivino_cleanup.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260329_vivino_cleanup.sql`:

```sql
-- Remove catalog wines without vintage or producer (no longer allowed)
DELETE FROM product_catalog_wines WHERE vintage IS NULL OR producer IS NULL;

-- Composite unique index for cross-source dedup.
-- The import_catalog_wines RPC uses ON CONFLICT DO NOTHING,
-- which will respect this index automatically.
CREATE UNIQUE INDEX product_catalog_wines_name_producer_vintage_uidx
  ON product_catalog_wines (name, producer, vintage);
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` or the dashboard SQL editor. Verify:

```sql
SELECT count(*) FROM product_catalog_wines WHERE vintage IS NULL OR producer IS NULL;
-- Expected: 0

SELECT indexname FROM pg_indexes
WHERE tablename = 'product_catalog_wines' AND indexname LIKE '%name_producer_vintage%';
-- Expected: product_catalog_wines_name_producer_vintage_uidx
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260329_vivino_cleanup.sql
git commit -m "feat: remove vintless wines and add name+producer+vintage unique index"
```

---

### Task 2: Update existing import scripts to skip wines without vintage/producer

**Files:**
- Modify: `mobile-app/scripts/import-munskankarna-rpc.mjs` (line 48, the `.map()` chain)
- Modify: `mobile-app/scripts/import-systembolaget-rpc.mjs` (line 63, the `.filter().map()` chain)

These scripts currently don't filter out wines missing vintage or producer. With the new unique index, such wines would fail on insert (vintage is part of the unique key). Add a filter step.

- [ ] **Step 1: Update Munskänkarna import**

In `scripts/import-munskankarna-rpc.mjs`, the `normalized` array is built starting at line 48. After the `.map()`, add a `.filter()`:

Change:

```js
const normalized = wines.map((w) => {
```

To:

```js
const normalized = wines.filter((w) => {
  // Skip wines without name, producer, or vintage — required by unique index
  if (!w.name || !w.producer) return false;
  const v = w.vintage && /^\d{4}$/.test(w.vintage) ? w.vintage : null;
  if (!v) {
    const yearMatch = w.name && w.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
    if (!yearMatch) return false;
  }
  return true;
}).map((w) => {
```

- [ ] **Step 2: Update Systembolaget import**

In `scripts/import-systembolaget-rpc.mjs`, the `.filter().map()` chain starts at line 63. Add vintage/producer check to the existing filter:

Change the filter function body (lines 64-69) to:

```js
  .filter((w) => {
    // Skip wines whose SB-ID already exists in DB
    if (w.systembolagetProductId && existingIds.has(w.systembolagetProductId)) {
      return false;
    }
    // Skip wines without producer or vintage — required by unique index
    if (!w.name || !w.producer) return false;
    const hasVintage = (w.vintage && /^\d{4}$/.test(String(w.vintage))) ||
      (w.name && w.name.match(/\s+((?:18|19|20)\d{2})\s*$/));
    if (!hasVintage) return false;
    return true;
  })
```

- [ ] **Step 3: Commit**

```bash
git add scripts/import-munskankarna-rpc.mjs scripts/import-systembolaget-rpc.mjs
git commit -m "feat: skip wines without vintage/producer in existing import scripts"
```

---

### Task 3: Vivino scraper

**Files:**
- Create: `mobile-app/scripts/fetch-vivino-batch.mjs`

- [ ] **Step 1: Create the scraper**

Create `scripts/fetch-vivino-batch.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/vivino-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

const API_URL = "https://www.vivino.com/api/explore/explore";
const PER_PAGE = 50;
const DELAY_MS = 400;

const COUNTRIES = ["it", "fr", "us"];
const WINE_TYPES = [
  { id: 1, label: "Rött" },
  { id: 2, label: "Vitt" },
  { id: 3, label: "Mousserande" },
  { id: 4, label: "Rosé" },
  { id: 7, label: "Sött" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(countryCode, typeId, page, retries = 3) {
  const params = new URLSearchParams({
    "country_codes[]": countryCode,
    "wine_type_ids[]": String(typeId),
    page: String(page),
    per_page: String(PER_PAGE),
    language: "en",
  });

  const url = `${API_URL}?${params}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!res.ok) {
        console.warn(`  [${res.status}] ${countryCode}/${typeId} page ${page}`);
        if (attempt === retries) return null;
        await sleep(1000 * attempt);
        continue;
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(
          `  Failed ${countryCode}/${typeId} page ${page} after ${retries} attempts: ${err.message}`,
        );
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

function stripTrailingYear(wine) {
  const yearMatch =
    wine.name && wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!wine.vintage) wine.vintage = yearMatch[1];
    wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, "");
  }
  return wine;
}

function mapWine(match, typeLabel) {
  const v = match.vintage;
  const w = v.wine;

  // Skip wines without a year
  if (!v.year) return null;

  const wineryName = w.winery?.name || null;
  const wineName = w.name || null;
  const name = [wineryName, wineName].filter(Boolean).join(" ").trim() || null;
  const producer = wineryName;
  const country = w.region?.country?.name || null;
  const region = w.region?.name_en || null;
  const vintage = String(v.year);

  const grapes =
    Array.isArray(w.style?.grapes) && w.style.grapes.length > 0
      ? w.style.grapes.map((g) => g.name).join(", ")
      : null;

  if (!name || !producer) return null;

  return stripTrailingYear({
    name,
    producer,
    country,
    region,
    vintage,
    type: typeLabel,
    grape: grapes,
    sourceLabel: "Vivino",
  });
}

// ---- Main ----

console.log("Fetching Vivino wine catalog via API...\n");

const merged = new Map();

for (const countryCode of COUNTRIES) {
  for (const { id: typeId, label: typeLabel } of WINE_TYPES) {
    // Fetch first page to get total count
    const firstData = await fetchPage(countryCode, typeId, 1);
    if (!firstData || !firstData.explore_vintage) {
      console.log(`${countryCode}/${typeLabel}: no data — skipping`);
      continue;
    }

    const total = firstData.explore_vintage.records_matched;
    const totalPages = Math.ceil(total / PER_PAGE);
    console.log(
      `${countryCode}/${typeLabel}: ${total} wines (${totalPages} pages)`,
    );

    function addMatches(matches) {
      for (const match of matches) {
        const wine = mapWine(match, typeLabel);
        if (!wine) continue;

        const key = `${wine.name.toLowerCase()}|${wine.producer.toLowerCase()}|${wine.vintage}`;
        if (!merged.has(key)) {
          merged.set(key, wine);
        }
      }
    }

    addMatches(firstData.explore_vintage.matches || []);

    for (let page = 2; page <= totalPages; page++) {
      await sleep(DELAY_MS);

      const data = await fetchPage(countryCode, typeId, page);
      if (
        !data ||
        !data.explore_vintage ||
        !data.explore_vintage.matches ||
        data.explore_vintage.matches.length === 0
      ) {
        console.log(
          `  ${countryCode}/${typeLabel} page ${page}: empty — stopping`,
        );
        break;
      }

      addMatches(data.explore_vintage.matches);

      if (page % 25 === 0 || page === totalPages) {
        console.log(
          `  Page ${page}/${totalPages}: ${merged.size} unique total`,
        );
      }
    }
  }
}

const outputRows = [...merged.values()];
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(outputRows, null, 2)}\n`,
  "utf8",
);
console.log(
  `\nDone! Wrote ${outputRows.length} unique wines to ${outputPath}`,
);
```

- [ ] **Step 2: Test with a small run**

Run with a single page to verify the API works and output is correct:

```bash
cd mobile-app
node -e "
import('./scripts/fetch-vivino-batch.mjs')
" 2>&1 | head -20
```

Or modify COUNTRIES temporarily to `['us']` and run — USA has only ~1,100 wines so it's fast.

- [ ] **Step 3: Run the full scrape**

```bash
cd mobile-app
node ./scripts/fetch-vivino-batch.mjs ./data/catalog-sources/vivino-wine-batch.json
```

Expected: ~35-40k unique wines, ~6-10 minutes runtime.

- [ ] **Step 4: Spot-check the output**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('data/catalog-sources/vivino-wine-batch.json','utf8'));
console.log('Total:', d.length);
console.log('Sample:', JSON.stringify(d[0], null, 2));
const types = {}; d.forEach(w => { types[w.type||'null'] = (types[w.type||'null']||0)+1; });
console.log('Types:', types);
const countries = {}; d.forEach(w => { countries[w.country||'null'] = (countries[w.country||'null']||0)+1; });
console.log('Countries:', countries);
const withVintage = d.filter(w=>w.vintage).length;
console.log('With vintage:', withVintage, '/', d.length);
"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-vivino-batch.mjs data/catalog-sources/vivino-wine-batch.json
git commit -m "feat: add Vivino scraper for Italy, France, USA wines"
```

---

### Task 4: Vivino import script

**Files:**
- Create: `mobile-app/scripts/import-vivino-rpc.mjs`

- [ ] **Step 1: Create the import script**

Create `scripts/import-vivino-rpc.mjs`:

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
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const [
  ,
  ,
  inputArg = "./data/catalog-sources/vivino-wine-batch.json",
] = process.argv;
const inputPath = path.resolve(process.cwd(), inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
console.log(`Loaded ${wines.length} wines from ${inputPath}`);

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
    // Skip wines without name, producer, or vintage — required by unique index
    if (!w.name || !w.producer) return false;
    if (!w.vintage || !/^\d{4}$/.test(String(w.vintage))) return false;
    return true;
  })
  .map((w) => {
    let name = w.name;
    let vintage =
      w.vintage && /^\d{4}$/.test(String(w.vintage))
        ? String(w.vintage)
        : null;

    const yearMatch = name && name.match(/\s+((?:18|19|20)\d{2})\s*$/);
    if (yearMatch) {
      if (!vintage) vintage = yearMatch[1];
      name = name.replace(/\s+(18|19|20)\d{2}\s*$/, "");
    }

    return {
      name,
      producer: w.producer || null,
      country: w.country || null,
      region: w.region || null,
      type: normalizeType(w.type),
      vintage,
      grape: w.grape || null,
      systembolagetProductId: null,
      sourceLabel: w.sourceLabel || "Vivino",
      sourceConfidence: "catalog",
    };
  });

console.log(
  `${wines.length - normalized.length} wines skipped (missing name/producer/vintage)`,
);
console.log(`${normalized.length} wines to import`);

const BATCH_SIZE = 200;
let totalImported = 0;

for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
  const batch = normalized.slice(i, i + BATCH_SIZE);

  const { data, error } = await supabase.rpc("import_catalog_wines", {
    wines: batch,
  });

  if (error) {
    console.error(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
      error.message,
    );
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

- [ ] **Step 2: Commit**

```bash
git add scripts/import-vivino-rpc.mjs
git commit -m "feat: add Vivino import script with RPC batch import"
```

---

### Task 5: Update manifest and npm scripts

**Files:**
- Modify: `mobile-app/data/catalog-source-manifest.json`
- Modify: `mobile-app/package.json`

- [ ] **Step 1: Add Vivino to the manifest**

Add a new entry at the end of the array in `data/catalog-source-manifest.json`:

```json
{
  "source": "Vivino",
  "priority": 6,
  "files": [
    "./data/catalog-sources/vivino-wine-batch.json"
  ]
}
```

- [ ] **Step 2: Add npm scripts to package.json**

Add after the `catalog:systembolaget:rpc` line in the `scripts` section:

```json
"catalog:vivino:fetch": "node ./scripts/fetch-vivino-batch.mjs ./data/catalog-sources/vivino-wine-batch.json",
"catalog:vivino:rpc": "node ./scripts/import-vivino-rpc.mjs ./data/catalog-sources/vivino-wine-batch.json",
```

- [ ] **Step 3: Commit**

```bash
git add data/catalog-source-manifest.json package.json
git commit -m "feat: add Vivino to catalog source manifest and npm scripts"
```

---

### Task 6: Run the import and verify

**Files:** None (execution only)

- [ ] **Step 1: Apply the migration (Task 1)**

If not already done, apply `supabase/migrations/20260329_vivino_cleanup.sql` via Supabase MCP or dashboard.

- [ ] **Step 2: Run the Vivino import**

```bash
cd mobile-app
npm run catalog:vivino:rpc
```

Expected output: thousands of new wines imported, some duplicates skipped (wines already present from Systembolaget or Munskänkarna).

- [ ] **Step 3: Verify in database**

```sql
SELECT source_label, count(*) FROM product_catalog_wines GROUP BY source_label ORDER BY count(*) DESC;
```

Expected: Vivino should be the largest source with ~30-35k wines.
