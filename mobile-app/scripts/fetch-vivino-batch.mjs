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

  const rawImageUrl = v.image?.variations?.bottle_medium || v.image?.location || null;
  const imageUrl = rawImageUrl
    ? (rawImageUrl.startsWith("//") ? `https:${rawImageUrl}` : rawImageUrl)
    : null;

  return stripTrailingYear({
    name,
    producer,
    country,
    region,
    vintage,
    type: typeLabel,
    grape: grapes,
    imageUrl,
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

    let stalePages = 0;
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

      const sizeBefore = merged.size;
      addMatches(data.explore_vintage.matches);

      if (merged.size === sizeBefore) {
        stalePages++;
        if (stalePages >= 3) {
          console.log(
            `  ${countryCode}/${typeLabel} page ${page}: 3 consecutive stale pages — moving on`,
          );
          break;
        }
      } else {
        stalePages = 0;
      }

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
