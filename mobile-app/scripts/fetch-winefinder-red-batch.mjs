import fs from "node:fs";
import path from "node:path";

const [, , pagesArg = "5", outputArg = "./data/catalog-sources/winefinder-red-batch.json"] = process.argv;

const pageCount = Number.parseInt(pagesArg, 10);
const outputPath = path.resolve(process.cwd(), outputArg);

if (!Number.isInteger(pageCount) || pageCount <= 0) {
  console.error("Page count must be a positive integer.");
  process.exit(1);
}

function buildUrl(pageIndex) {
  const params = new URLSearchParams({
    get: "SearchList",
    loadIndex: String(pageIndex),
    sStyle: "image",
    sExtType: "0",
    sStaticResult: "0",
    sKvalitetsgaranti: "",
    sBottles: "",
    sNonAlcohol: "",
    sCampain: "",
    sLowered: "",
    sNewWines: "",
    sWoodenbox: "",
    sProducentID: "",
    sBestsellers: "",
    sPointRange: "",
    sYears: "",
    sDrink: "",
    SupplierId: "",
    sType: "2",
    sPoint: "0",
    sKeyword: "",
    sPage: "1",
    sIndex: String(pageIndex),
    customStartIndex: "-1",
    pageSize: "32",
    sProdTypeId: "0",
    sObjectsPerRow: "4",
    oType: "popular",
    oDirection: "ASC",
    showFastDelivery: "True",
    showBaseWines: "True",
    temporarilyShowBaseWines: "false",
    hideAtlasBox: pageIndex === 0 ? "False" : "true",
    groupFastDelivery: "True",
    groupBaseWines: "True",
    extCountry: "",
    extDistrict: "",
    extRegion: "",
    extKaraktar: "",
    extGrape: "",
    extEco: "",
    sExtLink: "true",
    sPriceRange: "60-3000",
    bBuyFromList: "false",
    sRecipie: "",
    extGoodWith: "",
    postalnr: "0",
  });

  return `https://www.winefinder.se/ArticlesAjax.ashx?${params.toString()}`;
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&auml;/g, "ä")
    .replace(/&Auml;/g, "Ä")
    .replace(/&aring;/g, "å")
    .replace(/&Aring;/g, "Å")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&egrave;/g, "è")
    .replace(/&ccedil;/g, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ecirc;/g, "ê")
    .replace(/&rsquo;/g, "'")
    .replace(/&#246;/g, "ö")
    .replace(/&#228;/g, "ä")
    .replace(/&#229;/g, "å")
    .replace(/&#233;/g, "é")
    .replace(/&#232;/g, "è")
    .replace(/&#231;/g, "ç")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#038;/g, "&");
}

function fixMojibake(value) {
  if (!/[ÃÂ]/.test(value)) {
    return value;
  }

  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function stripTags(value) {
  return fixMojibake(decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
}

function normalizeText(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

function extractVintage(name) {
  const match = name.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function stripTrailingYear(name) {
  return name.replace(/\s+(18|19|20)\d{2}\s*$/, "").trim();
}

function parseProductCards(html) {
  const cards = [...html.matchAll(/<div class='item-4 js-product'>([\s\S]*?)<div><\/div><\/article><\/div>/g)];

  return cards
    .map(([, block]) => {
      const producerMatch = block.match(/<h4><a[\s\S]*?>([\s\S]*?)<\/a><\/h4>/i);
      const nameMatch = block.match(/<h3><a[\s\S]*?href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a><\/h3>/i);
      const locationMatch = block.match(/fa-map-marker'><\/i>([\s\S]*?)<\/a><\/li>/i);

      if (!producerMatch || !nameMatch || !locationMatch) {
        return null;
      }

      const producer = normalizeText(stripTags(producerMatch[1]));
      const rawName = normalizeText(stripTags(nameMatch[2]));
      const name = stripTrailingYear(rawName);
      const href = nameMatch[1].startsWith("http") ? nameMatch[1] : `https://www.winefinder.se${nameMatch[1]}`;
      const location = normalizeText(stripTags(locationMatch[1]));
      const [country, ...regionParts] = location.split(",").map((part) => part.trim()).filter(Boolean);
      const region = regionParts.length > 0 ? regionParts.join(", ") : null;

      if (!name || !producer || !country) {
        return null;
      }

      return {
        name,
        producer,
        country,
        region,
        vintage: extractVintage(rawName),
        type: "Rott vin",
        sourceLabel: "Winefinder",
        sourceUrl: href,
      };
    })
    .filter(Boolean);
}

const merged = new Map();

for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
  const response = await fetch(buildUrl(pageIndex), {
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "application/json, text/javascript, */*; q=0.01",
      referer: "https://www.winefinder.se/vinbutik/roda-viner",
      "x-requested-with": "XMLHttpRequest",
    },
  });

  if (!response.ok) {
    console.error(`Winefinder request failed for page ${pageIndex}: ${response.status}`);
    process.exit(1);
  }

  const payload = await response.json();
  const rows = parseProductCards(payload.HTML ?? "");

  for (const row of rows) {
    const key = `${row.name.toLowerCase()}|${row.producer.toLowerCase()}`;

    if (!merged.has(key)) {
      merged.set(key, row);
    }
  }
}

const outputRows = [...merged.values()];
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputRows.length} Winefinder red wines to ${outputPath}`);
