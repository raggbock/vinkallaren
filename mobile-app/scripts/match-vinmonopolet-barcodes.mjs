import fs from "node:fs";
import path from "node:path";

const [
  ,
  ,
  inputArg = "./data/catalog-sources/vinmonopolet-wine-batch.json",
  modeArg = "--report",
  outputArg,
] = process.argv;

const inputPath = path.resolve(process.cwd(), inputArg);
const mode = modeArg; // --report, --sql, --apply

if (!fs.existsSync(inputPath)) {
  console.error(`Vinmonopolet batch file not found: ${inputPath}`);
  process.exit(1);
}

const vinmonopoletWines = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (!Array.isArray(vinmonopoletWines) || vinmonopoletWines.length === 0) {
  console.error("Vinmonopolet batch must be a non-empty array.");
  process.exit(1);
}

// ---- Normalization helpers (matching the rest of the codebase) ----

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'") // normalize apostrophes
    .replace(/\s{2,}/g, " ");
}

function buildMatchKey(name, producer) {
  return `${normalizeKeyPart(name)}|${normalizeKeyPart(producer)}`;
}

// Build a fuzzy match key: strip common words, punctuation, vintages
function buildFuzzyKey(name, producer) {
  const norm = (s) =>
    normalizeKeyPart(s)
      .replace(/\b(19|20)\d{2}\b/g, "") // remove years
      .replace(/[''"`\-,.()]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  return `${norm(name)}|${norm(producer)}`;
}

// Strip producer prefix from wine name (common in Vinmonopolet names)
function stripProducerPrefix(name, producer) {
  if (!name || !producer) return name;
  const nameLower = normalizeKeyPart(name);
  const prodLower = normalizeKeyPart(producer);
  if (nameLower.startsWith(prodLower + " ")) {
    const stripped = name.slice(producer.length).trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
}

// ---- SQL helpers ----

function sqlString(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ---- Load catalog wines from Supabase (via direct connection) ----

async function loadCatalogFromSupabase() {
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  console.log("Loading catalog wines from Supabase...");

  // Fetch all wines with name and producer (paginated, 1000 at a time)
  const allWines = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `${url}/rest/v1/product_catalog_wines?select=id,name,producer,country,barcode,systembolaget_product_id&order=id&offset=${offset}&limit=${limit}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.warn(`Supabase fetch failed: ${res.status}`);
      return null;
    }

    const rows = await res.json();
    allWines.push(...rows);

    if (rows.length < limit) break;
    offset += limit;

    if (offset % 10000 === 0) {
      console.log(`  Loaded ${allWines.length} catalog wines...`);
    }
  }

  console.log(`  Loaded ${allWines.length} catalog wines from Supabase`);
  return allWines;
}

// ---- Load catalog from local batch files ----

function loadCatalogFromLocal() {
  const manifestPath = path.resolve(
    process.cwd(),
    "./data/catalog-source-manifest.json"
  );

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  console.log("Loading catalog wines from local batch files...");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const allWines = [];

  for (const source of manifest) {
    for (const file of source.files || []) {
      const filePath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(filePath)) continue;

      try {
        const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.name) {
              allWines.push({
                name: row.name,
                producer: row.producer || null,
                country: row.country || null,
                barcode: row.barcode || null,
                systembolaget_product_id:
                  row.systembolagetProductId || row.systembolaget_product_id || null,
              });
            }
          }
        }
      } catch {
        // skip unparseable files
      }
    }
  }

  console.log(`  Loaded ${allWines.length} catalog wines from local files`);
  return allWines;
}

// ---- Matching ----

function buildCatalogIndex(catalogWines) {
  const exactIndex = new Map(); // matchKey -> wine
  const fuzzyIndex = new Map(); // fuzzyKey -> wine
  const nameOnlyIndex = new Map(); // normalized name -> [wines]

  for (const wine of catalogWines) {
    if (!wine.name) continue;

    const exactKey = buildMatchKey(wine.name, wine.producer);
    if (!exactIndex.has(exactKey)) {
      exactIndex.set(exactKey, wine);
    }

    const fuzzyKey = buildFuzzyKey(wine.name, wine.producer);
    if (!fuzzyIndex.has(fuzzyKey)) {
      fuzzyIndex.set(fuzzyKey, wine);
    }

    const nameKey = normalizeKeyPart(wine.name);
    if (!nameOnlyIndex.has(nameKey)) {
      nameOnlyIndex.set(nameKey, []);
    }
    nameOnlyIndex.get(nameKey).push(wine);
  }

  return { exactIndex, fuzzyIndex, nameOnlyIndex };
}

function findMatch(vmWine, index) {
  const name = vmWine.name || vmWine.rawName;
  const producer = vmWine.producer;

  if (!name) return null;

  // 1. Exact match on name + producer
  if (producer) {
    const key = buildMatchKey(name, producer);
    if (index.exactIndex.has(key)) {
      return { wine: index.exactIndex.get(key), method: "exact" };
    }

    // Try with producer prefix stripped
    const strippedName = stripProducerPrefix(name, producer);
    if (strippedName !== name) {
      const key2 = buildMatchKey(strippedName, producer);
      if (index.exactIndex.has(key2)) {
        return { wine: index.exactIndex.get(key2), method: "exact-stripped" };
      }
    }

    // 2. Fuzzy match on name + producer
    const fuzzyKey = buildFuzzyKey(name, producer);
    if (index.fuzzyIndex.has(fuzzyKey)) {
      return { wine: index.fuzzyIndex.get(fuzzyKey), method: "fuzzy" };
    }

    if (strippedName !== name) {
      const fuzzyKey2 = buildFuzzyKey(strippedName, producer);
      if (index.fuzzyIndex.has(fuzzyKey2)) {
        return { wine: index.fuzzyIndex.get(fuzzyKey2), method: "fuzzy-stripped" };
      }
    }
  }

  // 3. Name-only match (only if name is distinctive enough)
  const nameKey = normalizeKeyPart(name);
  const nameMatches = index.nameOnlyIndex.get(nameKey);
  if (nameMatches?.length === 1) {
    return { wine: nameMatches[0], method: "name-only" };
  }

  return null;
}

// ---- Main ----

console.log(`Loaded ${vinmonopoletWines.length} Vinmonopolet wines\n`);

const withBarcode = vinmonopoletWines.filter((w) => w.barcode);
const withProducer = vinmonopoletWines.filter((w) => w.producer);

console.log(`  - With barcode: ${withBarcode.length}`);
console.log(`  - With producer: ${withProducer.length}\n`);

// Load catalog wines
let catalogWines = await loadCatalogFromSupabase();
if (!catalogWines) {
  catalogWines = loadCatalogFromLocal();
}
if (!catalogWines || catalogWines.length === 0) {
  console.error(
    "Could not load catalog wines. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, " +
      "or ensure local batch files exist."
  );
  process.exit(1);
}

console.log(`\nBuilding match index for ${catalogWines.length} catalog wines...`);
const index = buildCatalogIndex(catalogWines);

// Match Vinmonopolet wines against catalog
const matches = [];
const matchMethods = {};

for (const vmWine of vinmonopoletWines) {
  const result = findMatch(vmWine, index);
  if (result) {
    matches.push({
      vmWine,
      catalogWine: result.wine,
      method: result.method,
    });
    matchMethods[result.method] = (matchMethods[result.method] || 0) + 1;
  }
}

// Filter to matches with barcodes (the primary goal)
const barcodeMatches = matches.filter((m) => m.vmWine.barcode);

// Filter to matches that can enrich catalog (new producer, grape, etc.)
const enrichmentMatches = matches.filter(
  (m) =>
    m.vmWine.barcode ||
    (m.vmWine.grape && !m.catalogWine.grape) ||
    (m.vmWine.producer && !m.catalogWine.producer)
);

console.log(`\n--- Match Results ---`);
console.log(`Total Vinmonopolet wines: ${vinmonopoletWines.length}`);
console.log(`Catalog wines: ${catalogWines.length}`);
console.log(`Matches found: ${matches.length}`);
console.log(`Match methods:`, matchMethods);
console.log(`Matches with barcode: ${barcodeMatches.length}`);
console.log(`Matches with enrichment data: ${enrichmentMatches.length}`);

// ---- Output based on mode ----

if (mode === "--report") {
  // Print sample matches
  console.log(`\n--- Sample Matches ---`);
  for (const m of matches.slice(0, 20)) {
    const vm = m.vmWine;
    const cat = m.catalogWine;
    console.log(
      `  [${m.method}] VM: "${vm.name}" by ${vm.producer || "(unknown)"} ` +
        `→ Catalog: "${cat.name}" by ${cat.producer || "(unknown)"}` +
        (vm.barcode ? ` [EAN: ${vm.barcode}]` : "")
    );
  }

  if (barcodeMatches.length > 0) {
    console.log(`\n--- Barcode Matches ---`);
    for (const m of barcodeMatches.slice(0, 20)) {
      console.log(
        `  "${m.catalogWine.name}" → barcode ${m.vmWine.barcode}`
      );
    }
  }

  // Write match report to JSON
  const reportPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(process.cwd(), "./data/vinmonopolet-match-report.json");

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      vinmonopoletTotal: vinmonopoletWines.length,
      vinmonopoletWithBarcode: withBarcode.length,
      vinmonopoletWithProducer: withProducer.length,
      catalogTotal: catalogWines.length,
      matchesFound: matches.length,
      matchMethods,
      barcodeMatches: barcodeMatches.length,
      enrichmentMatches: enrichmentMatches.length,
    },
    matches: matches.map((m) => ({
      vinmonopolet: {
        name: m.vmWine.name,
        producer: m.vmWine.producer,
        country: m.vmWine.country,
        barcode: m.vmWine.barcode,
        grape: m.vmWine.grape,
        vintage: m.vmWine.vintage,
        vinmonopoletCode: m.vmWine.vinmonopoletCode,
      },
      catalog: {
        name: m.catalogWine.name,
        producer: m.catalogWine.producer,
        country: m.catalogWine.country,
        barcode: m.catalogWine.barcode,
        id: m.catalogWine.id,
        systembolagetProductId: m.catalogWine.systembolaget_product_id,
      },
      method: m.method,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\nWrote match report to ${reportPath}`);
}

if (mode === "--sql") {
  // Generate SQL UPDATE statements for barcode matches
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : null;

  const updates = [];

  for (const m of matches) {
    const setClauses = [];

    if (m.vmWine.barcode && !m.catalogWine.barcode) {
      setClauses.push(`barcode = ${sqlString(m.vmWine.barcode)}`);
    }

    if (setClauses.length === 0) continue;

    // Prefer matching by systembolaget_product_id or id
    let where;
    if (m.catalogWine.id) {
      where = `id = ${sqlString(m.catalogWine.id)}`;
    } else if (m.catalogWine.systembolaget_product_id) {
      where = `systembolaget_product_id = ${sqlString(m.catalogWine.systembolaget_product_id)}`;
    } else {
      where =
        `lower(name) = lower(${sqlString(m.catalogWine.name)})` +
        ` AND coalesce(lower(producer), '') = coalesce(lower(${sqlString(m.catalogWine.producer)}), '')`;
    }

    updates.push(
      `UPDATE public.product_catalog_wines SET ${setClauses.join(", ")} WHERE ${where} AND barcode IS NULL;`
    );
  }

  const sql = updates.join("\n") + "\n";

  if (outputPath) {
    fs.writeFileSync(outputPath, sql, "utf8");
    console.log(
      `\nWrote ${updates.length} UPDATE statements to ${outputPath}`
    );
  } else {
    process.stdout.write(sql);
  }
}

if (mode === "--apply") {
  // Apply barcode updates via Supabase REST API
  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of matches) {
    if (!m.vmWine.barcode || m.catalogWine.barcode) {
      skipped++;
      continue;
    }

    // Update via Supabase REST API
    let filter;
    if (m.catalogWine.id) {
      filter = `id=eq.${m.catalogWine.id}`;
    } else if (m.catalogWine.systembolaget_product_id) {
      filter = `systembolaget_product_id=eq.${encodeURIComponent(m.catalogWine.systembolaget_product_id)}`;
    } else {
      // Name + producer match
      filter =
        `name=ilike.${encodeURIComponent(m.catalogWine.name)}` +
        `&producer=ilike.${encodeURIComponent(m.catalogWine.producer || "")}`;
    }

    try {
      const res = await fetch(
        `${url}/rest/v1/product_catalog_wines?${filter}&barcode=is.null`,
        {
          method: "PATCH",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ barcode: m.vmWine.barcode }),
        }
      );

      if (res.ok) {
        updated++;
      } else {
        console.warn(
          `  Failed to update "${m.catalogWine.name}": ${res.status}`
        );
        failed++;
      }
    } catch (err) {
      console.warn(
        `  Error updating "${m.catalogWine.name}": ${err.message}`
      );
      failed++;
    }

    if ((updated + failed) % 100 === 0) {
      console.log(`  Progress: ${updated} updated, ${failed} failed`);
    }
  }

  console.log(`\n--- Apply Results ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no barcode or already set): ${skipped}`);
  console.log(`Failed: ${failed}`);
}
