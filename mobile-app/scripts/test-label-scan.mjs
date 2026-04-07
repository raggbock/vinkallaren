/**
 * OCR accuracy test: fetch random wine label images from the catalog,
 * run OCR + text matching, compare against known wine name.
 *
 * Usage: node scripts/test-label-scan.mjs [count]
 * Default: 20 random wines with images
 */
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { supabase } from "./lib/supabase-client.mjs";

const COUNT = parseInt(process.argv[2] || "20", 10);

// ── OCR helpers ────────────────────────────────────────────────────

function cleanOcrLine(line) {
  return line.split(/\s+/)
    .filter(t => /[a-zA-ZÀ-ÿ]{2,}/.test(t) || /^\d{4}$/.test(t))
    .join(" ").trim();
}

function lineQuality(line) {
  const wc = (line.match(/[a-zA-ZÀ-ÿ]{3,}/g) ?? []).reduce((s, w) => s + w.length, 0);
  return line.length > 0 ? wc / line.length : 0;
}

const NOISE_PATTERNS = [
  /DENOMINAZ/i, /CONTROLLAT[AE]/i, /GARANTIT[AE]/i,
  /PRODUCT\s+OF/i, /IMBOTTIGLIATO/i, /BOTTLED\s+BY/i,
  /\bORIGIN[E]?\b/i, /APPELLATION.*CONTR[OÔ]L[ÉE]+/i,
  /CONTAINS\s+SUL[PF][HI]ITES/i, /MISE\s+EN\s+BOUTEILLE/i,
  /PRODOTTO\s+IN/i, /PRODUCE[D]?\s+OF/i, /GROWN\s+IN/i,
  /ALCOHOL|ALC[\.\s]*\d/i, /^\d+\s*[,.]?\d*\s*%/,
  /VINO\s+(ROSSO|BIANCO|ROSATO)/i, /^(RED|WHITE|ROSE)\s+WINE$/i,
  /ESTATE\s+BOTTLED/i, /WINE\s+OF\b/i, /VIN\s+DE\b/i,
  /PROTECTED\s+DESIGN/i, /GOVERNO\s+ALL/i,
  /ANNATA\b/i, /VENDEMMIA\b/i, /RÉCOLTE\b/i,
];
const WINE_TERMS = /CABERNET|MERLOT|PINOT|CHARDONNAY|SAUVIGNON|SANGIOVESE|NEBBIOLO|RIESLING|SYRAH|SHIRAZ|TEMPRANILLO|BAROLO|BARBERA|BRUNELLO|CHIANTI|PROSECCO|CHAMPAGNE|CREMANT|GRUNER/i;

function parseOcrText(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const vintageRegex = /\b(1[7-9]\d{2}|20[0-2]\d|2030)\b/g;
  const years = [];
  for (const line of lines) {
    let m;
    while ((m = vintageRegex.exec(line)) !== null) years.push(parseInt(m[1], 10));
  }
  const vintage = years.length > 0 ? String(Math.max(...years)) : null;

  const scored = lines
    .filter(l => !/^\d{4}$/.test(l.trim()))
    .map(l => {
      const c = cleanOcrLine(l);
      let q = lineQuality(c);
      if (WINE_TERMS.test(c)) q = Math.min(1.0, q * 1.5);
      return { text: c, quality: q };
    })
    .filter(l => l.quality >= 0.4 && l.text.length >= 3 && !NOISE_PATTERNS.some(p => p.test(l.text)))
    .sort((a, b) => b.quality * Math.sqrt(b.text.length) - a.quality * Math.sqrt(a.text.length));

  const name = scored[0]?.text ?? null;
  const producer = scored[1]?.text && scored[1].text !== name ? scored[1].text : null;
  const searchQuery = [name, producer].filter(Boolean).join(" ");
  return { name, producer, vintage, searchQuery };
}

function normalizeForCompare(text) {
  return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOcrText(text) {
  let n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/[|]/g, "l").replace(/(?<=[a-z])0/g, "o").replace(/(?<=[A-Z])0/g, "O").replace(/1(?=[a-z])/g, "l");
  n = n.replace(/[^\w\s]/g, " ");
  return n.replace(/\s+/g, " ").trim();
}

// ── Catalog search ─────────────────────────────────────────────────

async function searchByText(query, vintage) {
  if (!query || query.length < 3) return [];
  const normalized = normalizeOcrText(query);
  if (normalized.length < 3) return [];
  const params = { query: normalized, max_results: 5 };
  if (vintage) params.query_vintage = parseInt(vintage, 10);
  const { data, error } = await supabase.rpc("match_catalog_by_text", params);
  if (error) return [];
  return data ?? [];
}

// ── Fetch random wines with images ─────────────────────────────────

async function fetchRandomWines(count) {
  const { data, error } = await supabase.rpc("random_catalog_wines_with_images", {
    count_limit: count,
  });
  if (error) {
    console.error("Failed to fetch wines:", error.message);
    return [];
  }
  return data ?? [];
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

// ── OCR pipeline ───────────────────────────────────────────────────

async function runOcr(worker, buffer) {
  const rotated = sharp(buffer).rotate();
  const meta = await rotated.metadata();
  const rw = meta.width ?? 1000;
  const rh = meta.height ?? 1000;

  // 2 crops × 2 preprocessing = 4 variants (fast enough)
  const crops = [
    rotated.clone().resize(1500, null, { withoutEnlargement: true }),
    rotated.clone()
      .extract({
        left: Math.round(rw * 0.15), top: Math.round(rh * 0.1),
        width: Math.round(rw * 0.7), height: Math.round(rh * 0.8),
      })
      .resize(1500, null, { withoutEnlargement: true }),
  ];

  let bestScore = -1;
  let bestResult = { name: null, producer: null, vintage: null, searchQuery: "", confidence: 0 };

  for (const crop of crops) {
    const variants = [
      crop.clone().grayscale().normalise().sharpen({ sigma: 1.5 }),
      crop.clone().grayscale().normalise(),
    ];
    for (const v of variants) {
      const buf = await v.toBuffer();
      const { data } = await worker.recognize(buf);
      // Score: confidence + wine term bonus + name bonus
      const wineHits = (data.text.match(WINE_TERMS) ?? []).length;
      const parsed = parseOcrText(data.text);
      const hasName = parsed.name && parsed.name.length > 3 ? 10 : 0;
      const score = data.confidence + wineHits * 8 + hasName;
      if (score > bestScore) {
        bestScore = score;
        bestResult = { ...parsed, confidence: Math.round(data.confidence) };
      }
    }
  }
  return bestResult;
}

// ── Main ───────────────────────────────────────────────────────────

console.log(`\nFetching ${COUNT} random wines with images from catalog...\n`);
const wines = await fetchRandomWines(COUNT);
console.log(`Got ${wines.length} wines. Running OCR...\n`);
console.log("─".repeat(100));

const worker = await Tesseract.createWorker("eng+fra+ita+deu+swe");
const results = [];

for (const wine of wines) {
  const t0 = performance.now();
  const buffer = await downloadImage(wine.image_url);
  if (!buffer) {
    console.log(`  SKIP: ${wine.name} — image download failed`);
    continue;
  }

  const ocr = await runOcr(worker, buffer);
  const matches = await searchByText(ocr.searchQuery, ocr.vintage);
  const ms = Math.round(performance.now() - t0);

  // Check if correct wine is in top matches
  const expectedNorm = normalizeForCompare(wine.name);
  const topMatch = matches[0];
  const topMatchNorm = topMatch ? normalizeForCompare(topMatch.name) : "";
  const isCorrect = topMatch && topMatch.id === wine.id;
  const isClose = topMatchNorm.includes(expectedNorm) || expectedNorm.includes(topMatchNorm);
  const inTop5 = matches.some(m => m.id === wine.id);

  const icon = isCorrect ? "✓" : isClose ? "~" : inTop5 ? "○" : "✗";
  const shortExpected = wine.name.length > 35 ? wine.name.slice(0, 32) + "..." : wine.name.padEnd(35);
  const topName = topMatch ? `${topMatch.name} (${Math.round(topMatch.similarity * 100)}%)` : "(ingen)";

  console.log(`${icon} ${shortExpected} | conf: ${String(ocr.confidence).padStart(3)}% | ${ms}ms`);
  console.log(`  OCR:     ${ocr.searchQuery || "(tom)"}`);
  console.log(`  Topp:    ${topName}`);
  if (!isCorrect && inTop5) console.log(`  (rätt vin i topp 5)`);
  console.log("─".repeat(100));

  results.push({ wine, ocr, topMatch, isCorrect, isClose, inTop5, ms });
}

await worker.terminate();

// ── Summary ────────────────────────────────────────────────────────

const total = results.length;
const correct = results.filter(r => r.isCorrect).length;
const close = results.filter(r => r.isClose).length;
const top5 = results.filter(r => r.inTop5).length;
const withName = results.filter(r => r.ocr.name).length;
const avgConf = total > 0 ? Math.round(results.reduce((s, r) => s + r.ocr.confidence, 0) / total) : 0;
const avgMs = total > 0 ? Math.round(results.reduce((s, r) => s + r.ms, 0) / total) : 0;

console.log(`\nSammanfattning (${total} bilder):`);
console.log(`  ✓ Exakt rätt (topp 1):  ${correct}/${total} (${Math.round(correct/total*100)}%)`);
console.log(`  ~ Nära (namn overlap):   ${close}/${total} (${Math.round(close/total*100)}%)`);
console.log(`  ○ Rätt i topp 5:         ${top5}/${total} (${Math.round(top5/total*100)}%)`);
console.log(`  OCR-namn extraherat:     ${withName}/${total}`);
console.log(`  Snitt-konfidens:         ${avgConf}%`);
console.log(`  Snitt-tid:               ${avgMs}ms`);
