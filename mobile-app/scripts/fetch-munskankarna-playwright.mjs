import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/munskankarna-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

const API_URL =
  "https://www.munskankarna.se/umbraco/surface/winesearch/listwinebottles/";
const PAGE_SIZE = 100;
const DELAY_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(offset, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        body: `pageIndex=${offset}&pageSize=${PAGE_SIZE}&isAdvancedSearch=true`,
      });

      if (!res.ok) {
        console.warn(`  [${res.status}] offset ${offset}`);
        if (attempt === retries) return null;
        await sleep(1000 * attempt);
        continue;
      }

      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(`  Failed offset ${offset} after ${retries} attempts: ${err.message}`);
        return null;
      }
      await sleep(1000 * attempt);
    }
  }
  return null;
}

function parseGrapes(rawMaterials) {
  if (!rawMaterials) return null;
  try {
    const grapes = JSON.parse(rawMaterials);
    if (!Array.isArray(grapes) || grapes.length === 0) return null;
    return grapes
      .map((g) => {
        const pct = g.percentage ? `${g.percentage}% ` : "";
        return `${pct}${g.name}`;
      })
      .join(", ");
  } catch {
    return null;
  }
}

function normalizeType(categoryName) {
  if (!categoryName) return null;
  const t = categoryName.toLowerCase().trim();
  if (t.includes("rött") || t === "rott") return "Rött vin";
  if (t.includes("vitt")) return "Vitt vin";
  if (t.includes("rosé") || t === "rose") return "Rosé";
  if (t.includes("mousserande") || t.includes("sparkling")) return "Mousserande";
  if (t.includes("dessert") || t.includes("sött")) return "Sött";
  if (t.includes("orange")) return "Orange";
  return categoryName.trim();
}

function stripTrailingYear(wine) {
  const yearMatch = wine.name && wine.name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!wine.vintage) wine.vintage = yearMatch[1];
    wine.name = wine.name.replace(/\s+(18|19|20)\d{2}\s*$/, '');
  }
  return wine;
}

function mapWine(w) {
  const sbLink = w.wineBottleExternalLink;
  const systembolagetProductId =
    sbLink && sbLink.text ? sbLink.text.trim() : null;

  const region = [w.wineBottleRegionName, w.wineBottleSubRegionName]
    .filter(Boolean)
    .join(", ") || null;

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

// ---- Main ----

console.log("Fetching Munskänkarna wine catalog via API...\n");

const firstPage = await fetchPage(0);
if (!firstPage) {
  console.error("Could not fetch first page");
  process.exit(1);
}

const total = firstPage.total;
console.log(`Total wines: ${total}\n`);

const merged = new Map();

function addWines(wines) {
  for (const raw of wines) {
    const wine = mapWine(raw);
    if (!wine.name || !wine.producer) continue;

    const key = wine.systembolagetProductId
      ? `sb:${wine.systembolagetProductId}`
      : `${wine.name.toLowerCase()}|${wine.producer.toLowerCase()}|${wine.vintage || ""}`;

    if (!merged.has(key)) {
      merged.set(key, wine);
    }
  }
}

addWines(firstPage.result);
console.log(`Offset 0: ${firstPage.result.length} wines (${merged.size} unique)`);

for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
  await sleep(DELAY_MS);

  const data = await fetchPage(offset);
  if (!data || !data.result || data.result.length === 0) {
    console.log(`Offset ${offset}: empty — stopping`);
    break;
  }

  addWines(data.result);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (page % 25 === 0 || offset + PAGE_SIZE >= total) {
    console.log(`Offset ${offset} (page ${page}/${totalPages}): ${merged.size} unique total`);
  }
}

const outputRows = [...merged.values()];
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");
console.log(
  `\nDone! Wrote ${outputRows.length} unique wines to ${outputPath}`,
);
