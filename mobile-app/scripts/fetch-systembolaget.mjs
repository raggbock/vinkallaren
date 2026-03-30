import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/systembolaget-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

const API_URL =
  "https://api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch/search";
const API_KEY = "8d39a7340ee7439f8b4c1e995c8f3e4a";
const PAGE_SIZE = 100;
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(page, retries = 3) {
  const url = `${API_URL}?page=${page}&size=${PAGE_SIZE}&sortBy=ProductNameBold&sortDirection=Ascending&categoryLevel1=Vin`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "Ocp-Apim-Subscription-Key": API_KEY,
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!res.ok) {
        console.warn(`  [${res.status}] page ${page}`);
        if (attempt === retries) return null;
        await sleep(1000 * attempt);
        continue;
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`  Failed page ${page} after ${retries} attempts: ${err.message}`);
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

function stripTrailingYear(wine) {
  const yearMatch = wine.name && wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!wine.vintage) wine.vintage = yearMatch[1];
    wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
  }
  return wine;
}

function normalizeType(categoryLevel2) {
  if (!categoryLevel2) return null;
  const t = categoryLevel2.toLowerCase().trim();
  if (t.includes("rött")) return "Rött vin";
  if (t.includes("vitt")) return "Vitt vin";
  if (t.includes("rosé") || t.includes("rose")) return "Rosé";
  if (t.includes("mousserande")) return "Mousserande";
  if (t.includes("starkvin") || t.includes("dessert") || t.includes("sött")) return "Sött";
  return categoryLevel2.trim();
}

function stripProducerPrefix(name, producer) {
  if (!name || !producer) return name;
  if (name.toLowerCase().startsWith(producer.toLowerCase() + " ")) {
    const stripped = name.slice(producer.length).trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
}

function collapseSpaces(str) {
  return str ? str.replace(/\s{2,}/g, " ").trim() : str;
}

function normalizeApostrophes(str) {
  return str ? str.replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'") : str;
}

function mapWine(p) {
  const rawName = normalizeApostrophes((p.productNameThin || p.productNameBold || "").trim());
  const producer = normalizeApostrophes((p.producerName || "").trim());
  const name = collapseSpaces(stripProducerPrefix(rawName, producer)) || collapseSpaces(p.productNameBold) || null;

  const region = [p.originLevel1, p.originLevel2]
    .filter(Boolean)
    .join(", ") || null;

  const grape = Array.isArray(p.grapes) && p.grapes.length > 0
    ? p.grapes.join(", ")
    : null;

  return stripTrailingYear({
    name: name || null,
    producer: p.producerName || null,
    country: p.country || null,
    region,
    vintage: p.vintage || null,
    type: normalizeType(p.categoryLevel2),
    grape,
    systembolagetProductId: p.productNumber || null,
    sourceLabel: "Systembolaget",
    sourceUrl: p.productNumber
      ? `https://www.systembolaget.se/${p.productNumber}`
      : null,
  });
}

// ---- Main ----

console.log("Fetching Systembolaget wine catalog via API...\n");

const firstPage = await fetchPage(1);
if (!firstPage) {
  console.error("Could not fetch first page");
  process.exit(1);
}

const total = firstPage.metadata.docCount;
const totalPages = firstPage.metadata.totalPages;
console.log(`Total wines: ${total} (${totalPages} pages of ${PAGE_SIZE})\n`);

const merged = new Map();

function addWines(products) {
  for (const p of products) {
    const wine = mapWine(p);
    if (!wine.name || !wine.producer) continue;

    const key = wine.systembolagetProductId
      ? `sb:${wine.systembolagetProductId}`
      : `${wine.name.toLowerCase()}|${wine.producer.toLowerCase()}|${wine.vintage || ""}`;

    if (!merged.has(key)) {
      merged.set(key, wine);
    }
  }
}

addWines(firstPage.products);
console.log(`Page 1/${totalPages}: ${firstPage.products.length} wines (${merged.size} unique)`);

for (let page = 2; page <= totalPages; page++) {
  await sleep(DELAY_MS);

  const data = await fetchPage(page);
  if (!data || !data.products || data.products.length === 0) {
    console.log(`Page ${page}/${totalPages}: empty — stopping`);
    break;
  }

  addWines(data.products);

  if (page % 25 === 0 || page === totalPages) {
    console.log(`Page ${page}/${totalPages}: ${merged.size} unique total`);
  }
}

const outputRows = [...merged.values()];
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");
console.log(
  `\nDone! Wrote ${outputRows.length} unique wines to ${outputPath}`,
);
