import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/vinmonopolet-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

// Vinmonopolet public storefront search API (no auth required).
// The search endpoint returns name, country, district, category but NOT
// producer, grape, vintage, or barcode. Those come from detail pages.
const SEARCH_URL =
  "https://www.vinmonopolet.no/vmpws/v2/vmp/products/search";
const PAGE_SIZE = 100;
const DELAY_MS = 400;

// Wine categories on Vinmonopolet (fetched separately to avoid mixing with
// beer/spirits). Total ~27k wines across these categories.
const WINE_CATEGORIES = [
  "rødvin",        // ~13,500
  "hvitvin",       // ~9,200
  "musserende_vin",// ~2,900
  "rosévin",       // ~750
  "sterkvin",      // ~475
  "perlende_vin",  // ~310
  "fruktvin",      // ~60
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSearchPage(category, page, retries = 3) {
  const params = new URLSearchParams({
    q: `:relevance:mainCategory:${category}`,
    searchType: "product",
    currentPage: String(page),
    pageSize: String(PAGE_SIZE),
  });
  const url = `${SEARCH_URL}?${params}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`  [${res.status}] ${category} page ${page}`);
        if (attempt === retries) return null;
        await sleep(1000 * attempt);
        continue;
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(
          `  Failed ${category} page ${page} after ${retries} attempts: ${err.message}`
        );
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

// Fetch individual product detail page and parse the embedded JSON.
// Each Vinmonopolet product page contains a <script type="application/json">
// block with the full product data including main_producer, content.ingredients,
// and year. Barcodes are NOT currently exposed on the public site.
async function fetchProductDetail(code, retries = 2) {
  const url = `https://www.vinmonopolet.no/p/${code}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html",
        },
      });

      if (!res.ok) {
        if (attempt === retries) return null;
        await sleep(500 * attempt);
        continue;
      }

      const html = await res.text();

      // The product data is embedded in a <script type="application/json"> tag
      // containing { "product": { main_producer, content.ingredients, year, ... } }
      const producerIdx = html.indexOf('"main_producer"');
      if (producerIdx >= 0) {
        const scriptStart = html.lastIndexOf("<script", producerIdx);
        const scriptEnd = html.indexOf("</script>", producerIdx);
        if (scriptStart >= 0 && scriptEnd >= 0) {
          const tagEnd = html.indexOf(">", scriptStart);
          const jsonStr = html.slice(tagEnd + 1, scriptEnd);

          try {
            const data = JSON.parse(jsonStr);
            const p = data.product || data;

            const producer = p.main_producer?.name || null;

            const ingredients = p.content?.ingredients || [];
            const grape =
              ingredients
                .map((i) => i.formattedValue || i.readableValue || i.name)
                .filter(Boolean)
                .join(", ") || null;

            const vintage = p.year ? String(p.year) : null;

            // Check JSON-LD for GTIN/barcode (future-proof)
            let barcode = null;
            const jsonLdMatch = html.match(
              /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
            );
            if (jsonLdMatch) {
              try {
                const ld = JSON.parse(jsonLdMatch[1]);
                barcode = ld.gtin13 || ld.gtin || ld.ean || null;
              } catch {
                // ignore
              }
            }

            return { producer, grape, vintage, barcode };
          } catch {
            // fall through to HTML parsing
          }
        }
      }

      // Fallback: parse from HTML key-value pairs
      return parseFromHtml(html);
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(500 * attempt);
    }
  }
  return null;
}

// Fallback parser for when embedded JSON is missing or unparseable
function parseFromHtml(html) {
  let producer = null;
  let grape = null;
  let vintage = null;
  let barcode = null;

  const prodMatch = html.match(
    /Produsent<\/span>\s*<span>\s*<a[^>]*>([^<]+)<\/a>/i
  );
  if (prodMatch) producer = prodMatch[1].trim();

  const vintMatch = html.match(/Årgang[\s\S]*?<\/span>\s*<span>(\d{4})/i);
  if (vintMatch) vintage = vintMatch[1];

  const eanMatch = html.match(
    /(?:Strekkode|EAN|Barcode|gtin13)[:\s"]*(\d{8,13})/i
  );
  if (eanMatch) barcode = eanMatch[1];

  return { producer, grape, vintage, barcode };
}

// ---- Normalization helpers (matching existing codebase patterns) ----

function normalizeType(mainCategory) {
  if (!mainCategory) return null;
  const name = (mainCategory.name || mainCategory).toLowerCase().trim();
  if (name.includes("rødvin") || name.includes("rød")) return "Rött vin";
  if (name.includes("hvitvin") || name.includes("hvit")) return "Vitt vin";
  if (
    name.includes("rosévin") ||
    name.includes("rosé") ||
    name.includes("rose")
  )
    return "Rosé";
  if (name.includes("musserende") || name.includes("perlende"))
    return "Mousserande";
  if (name.includes("sterkvin") || name.includes("dessert")) return "Sött";
  if (name.includes("fruktvin")) return "Fruktvin";
  return mainCategory.name || null;
}

function normalizeApostrophes(str) {
  return str
    ? str.replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'")
    : str;
}

function collapseSpaces(str) {
  return str ? str.replace(/\s{2,}/g, " ").trim() : str;
}

function stripProducerPrefix(name, producer) {
  if (!name || !producer) return name;
  if (name.toLowerCase().startsWith(producer.toLowerCase() + " ")) {
    const stripped = name.slice(producer.length).trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
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

// ---- Norwegian-to-Swedish country name mapping ----

const COUNTRY_MAP = {
  Spania: "Spanien",
  Frankrike: "Frankrike",
  Italia: "Italien",
  Portugal: "Portugal",
  Tyskland: "Tyskland",
  Chile: "Chile",
  Argentina: "Argentina",
  Australia: "Australien",
  "Sør-Afrika": "Sydafrika",
  "New Zealand": "Nya Zeeland",
  USA: "USA",
  Østerrike: "Österrike",
  Hellas: "Grekland",
  Ungarn: "Ungern",
  Georgia: "Georgien",
  Libanon: "Libanon",
  Kroatia: "Kroatien",
  Slovenia: "Slovenien",
  Sveits: "Schweiz",
  Israel: "Israel",
  Romania: "Rumänien",
  Bulgaria: "Bulgarien",
  Moldova: "Moldavien",
  Marokko: "Marocko",
  Mexico: "Mexiko",
  Brasil: "Brasilien",
  Uruguay: "Uruguay",
  Canada: "Kanada",
  England: "England",
  Kina: "Kina",
  Japan: "Japan",
  India: "Indien",
  Tyrkia: "Turkiet",
};

function mapCountry(norwegianName) {
  if (!norwegianName) return null;
  return COUNTRY_MAP[norwegianName] || norwegianName;
}

// Map a search result to our wine format
function mapSearchResult(p) {
  const rawName = normalizeApostrophes((p.name || "").trim());
  const country = mapCountry(p.main_country?.name || null);

  const regionParts = [];
  if (p.district?.name) regionParts.push(p.district.name);
  if (p.sub_District?.name) regionParts.push(p.sub_District.name);
  const region = regionParts.join(", ") || null;

  const type = normalizeType(p.main_category);

  return {
    vinmonopoletCode: p.code || null,
    rawName,
    name: rawName,
    producer: null,
    country,
    region,
    vintage: null,
    type,
    grape: null,
    barcode: null,
    sourceLabel: "Vinmonopolet",
    sourceUrl: p.url
      ? `https://www.vinmonopolet.no${p.url}`
      : p.code
        ? `https://www.vinmonopolet.no/p/${p.code}`
        : null,
  };
}

// ---- Main ----

console.log("Fetching Vinmonopolet wine catalog...\n");

const merged = new Map();

// Phase 1: Fetch wines by category via search API
for (const category of WINE_CATEGORIES) {
  const firstPage = await fetchSearchPage(category, 0);
  if (!firstPage?.pagination) {
    console.warn(`Could not fetch ${category} — skipping`);
    continue;
  }

  const catTotal = firstPage.pagination.totalResults || 0;
  const catPages = firstPage.pagination.totalPages || 0;
  const sizeBefore = merged.size;

  function addProducts(items) {
    for (const p of items) {
      const wine = mapSearchResult(p);
      if (!wine.name) continue;

      const key = wine.vinmonopoletCode
        ? `vm:${wine.vinmonopoletCode}`
        : wine.name.toLowerCase();

      if (!merged.has(key)) {
        merged.set(key, wine);
      }
    }
  }

  addProducts(firstPage.products || []);

  for (let page = 1; page < catPages; page++) {
    await sleep(DELAY_MS);

    const data = await fetchSearchPage(category, page);
    if (!data?.products?.length) {
      console.warn(`  ${category} page ${page + 1}: empty — stopping`);
      break;
    }

    addProducts(data.products);
  }

  const added = merged.size - sizeBefore;
  console.log(
    `  ${category}: ${catTotal} listed, ${added} new (${merged.size} total)`
  );
}

console.log(`\nPhase 1 complete: ${merged.size} wines from search API`);

// Phase 2: Enrich with detail pages (producer, grape, vintage, barcode).
// Fetching detail pages is slow (~300ms per product). Control via env vars:
//   VINMONOPOLET_MAX_DETAILS=0    skip detail enrichment entirely
//   VINMONOPOLET_MAX_DETAILS=500  fetch first 500 only
//   (unset)                       fetch all
const maxDetailsEnv = process.env.VINMONOPOLET_MAX_DETAILS;
const MAX_DETAILS =
  maxDetailsEnv === "0" ? 0 : Number(maxDetailsEnv) || Infinity;
const DETAIL_DELAY_MS = 300;

if (MAX_DETAILS === 0) {
  console.log("\nPhase 2 skipped (VINMONOPOLET_MAX_DETAILS=0)");

  // Still strip trailing years from names
  for (const wine of merged.values()) {
    stripTrailingYear(wine);
  }
} else {
  const detailCandidates = [...merged.values()]
    .filter((w) => w.vinmonopoletCode)
    .slice(0, MAX_DETAILS);

  console.log(
    `\nPhase 2: Fetching detail pages for ${detailCandidates.length} wines...`
  );

  let detailsFetched = 0;
  let barcodesFound = 0;
  let producersFound = 0;
  let grapesFound = 0;

  // Save progress periodically in case of interruption
  const SAVE_INTERVAL = 1000;

  for (const wine of detailCandidates) {
    const detail = await fetchProductDetail(wine.vinmonopoletCode);
    detailsFetched++;

    if (detail) {
      if (detail.barcode) {
        wine.barcode = detail.barcode;
        barcodesFound++;
      }
      if (detail.producer) {
        wine.producer = detail.producer;
        producersFound++;
        wine.name = collapseSpaces(
          stripProducerPrefix(
            normalizeApostrophes(wine.rawName),
            detail.producer
          )
        );
      }
      if (detail.grape) {
        wine.grape = detail.grape;
        grapesFound++;
      }
      if (detail.vintage && !wine.vintage) {
        wine.vintage = detail.vintage;
      }
    }

    stripTrailingYear(wine);

    if (detailsFetched % 200 === 0) {
      console.log(
        `  ${detailsFetched}/${detailCandidates.length}: ` +
          `${producersFound} producers, ${grapesFound} grapes, ${barcodesFound} barcodes`
      );
    }

    // Save intermediate results
    if (detailsFetched % SAVE_INTERVAL === 0) {
      const intermediate = [...merged.values()].map(
        ({ rawName, ...rest }) => rest
      );
      fs.writeFileSync(
        outputPath,
        `${JSON.stringify(intermediate, null, 2)}\n`,
        "utf8"
      );
    }

    await sleep(DETAIL_DELAY_MS);
  }

  console.log(
    `\nPhase 2 complete: ${producersFound} producers, ${grapesFound} grapes, ` +
      `${barcodesFound} barcodes from ${detailsFetched} detail pages`
  );
}

// Final output
const outputRows = [...merged.values()].map(({ rawName, ...rest }) => rest);

fs.writeFileSync(
  outputPath,
  `${JSON.stringify(outputRows, null, 2)}\n`,
  "utf8"
);

const withProducer = outputRows.filter((w) => w.producer).length;
const withBarcode = outputRows.filter((w) => w.barcode).length;
const withGrape = outputRows.filter((w) => w.grape).length;
const withVintage = outputRows.filter((w) => w.vintage).length;

console.log(`\nDone! Wrote ${outputRows.length} wines to ${outputPath}`);
console.log(`  - With producer: ${withProducer}`);
console.log(`  - With grape: ${withGrape}`);
console.log(`  - With vintage: ${withVintage}`);
console.log(`  - With barcode: ${withBarcode}`);
