import fs from "node:fs";
import path from "node:path";

const [, , outputArg = "./data/catalog-sources/munskankarna-wine-batch.json"] = process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

const COUNTRY_SLUGS = [
  "argentina", "australien", "chile", "frankrike", "grekland",
  "italien", "portugal", "spanien", "sydafrika", "tyskland",
  "usa", "nya-zeeland", "osterrike", "ungern", "georgien",
  "libanon", "slovenien", "kroatien", "israel", "schweiz",
];

const BASE_URL = "https://www.munskankarna.se/sv/vinlocus/land";

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
    .replace(/&eacute;/g, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&egrave;/g, "è")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ocirc;/g, "ô")
    .replace(/&ecirc;/g, "ê")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractVintage(name) {
  const match = name.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function normalizeType(typeText) {
  if (!typeText) return null;
  const t = typeText.toLowerCase().trim();
  if (t.includes("rött") || t.includes("rott")) return "Rött vin";
  if (t.includes("vitt")) return "Vitt vin";
  if (t.includes("rosé") || t.includes("rose")) return "Rosé";
  if (t.includes("mousserande") || t.includes("sparkling")) return "Mousserande";
  if (t.includes("dessert") || t.includes("sött")) return "Sött";
  if (t.includes("orange")) return "Orange";
  return typeText.trim();
}

function parseWineCards(html, countrySlug) {
  // Cards are <li class="medium-3 groupedlist">...</li>
  const cards = [...html.matchAll(/<li[^>]*\bgroupedlist\b[^>]*>([\s\S]*?)<\/li>/g)];

  return cards
    .map(([, block]) => {
      // Name: <h3><a href="..."><span>Wine Name</span>...</a></h3>
      const nameMatch = block.match(/<h3>\s*<a[^>]*href="([^"]*)"[^>]*>\s*<span>([\s\S]*?)<\/span>/i);
      if (!nameMatch) return null;

      const href = nameMatch[1];
      const name = stripTags(nameMatch[2]).trim();
      if (!name) return null;

      // Producer: <strong>Producent: </strong><span>...</span>
      const producerMatch = block.match(/<strong>Producent:\s*<\/strong>\s*<span>([\s\S]*?)<\/span>/i);
      const producer = producerMatch ? stripTags(producerMatch[1]).trim() : null;

      // Origin: <div class="c-wine-info__faded"> with country/region links and trailing text
      const originMatch = block.match(/class="c-wine-info__faded">([\s\S]*?)<\/div>/i);
      let country = null;
      let region = null;
      if (originMatch) {
        const originLinks = [...originMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/g)];
        const parts = originLinks.map(([, text]) => stripTags(text).trim()).filter(Boolean);
        country = parts[0] || null;
        region = parts.slice(1).join(", ") || null;
      }

      // Type: <span class="tooltiptext">Rött vin</span>
      const typeMatch = block.match(/class="tooltiptext">([\s\S]*?)<\/span>/i);
      const type = typeMatch ? normalizeType(stripTags(typeMatch[1])) : null;

      // Systembolaget: <strong>Systembolaget:</strong> ... <span>95826</span>
      const sbMatch = block.match(/<strong>Systembolaget:<\/strong>[\s\S]*?<a[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      const systembolagetProductId = sbMatch ? stripTags(sbMatch[1]).trim() : null;

      // Grapes: <strong>Druvor:</strong> text with possible <a> links
      const grapeMatch = block.match(/<strong>Druvor:<\/strong>([\s\S]*?)<\/p>/i);
      const grape = grapeMatch ? stripTags(grapeMatch[1]).trim() : null;

      const vintage = extractVintage(name);

      const sourceUrl = href
        ? (href.startsWith("http") ? href : `https://www.munskankarna.se${href}`)
        : `${BASE_URL}/${countrySlug}`;

      return {
        name: vintage ? name.replace(/\s+\d{4}$/, "").trim() : name,
        producer,
        country,
        region,
        vintage,
        type,
        grape: grape || null,
        systembolagetProductId,
        sourceLabel: "Munskänkarna",
        sourceUrl,
      };
    })
    .filter(Boolean)
    .filter((wine) => wine.name && wine.producer);
}

const merged = new Map();
let totalFetched = 0;

for (const slug of COUNTRY_SLUGS) {
  const url = `${BASE_URL}/${slug}`;

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        accept: "text/html",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      continue;
    }

    const html = await response.text();
    const wines = parseWineCards(html, slug);

    for (const wine of wines) {
      const key = wine.systembolagetProductId
        ? `sb:${wine.systembolagetProductId}`
        : `${wine.name.toLowerCase()}|${(wine.producer || "").toLowerCase()}`;

      if (!merged.has(key)) {
        merged.set(key, wine);
      }
    }

    totalFetched += wines.length;
    console.log(`${slug}: ${wines.length} wines`);
  } catch (error) {
    console.warn(`Error fetching ${url}: ${error.message}`);
  }

  // polite delay between requests
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const outputRows = [...merged.values()];
fs.writeFileSync(outputPath, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");
console.log(`\nWrote ${outputRows.length} unique wines (${totalFetched} total fetched) to ${outputPath}`);
