/**
 * OCR accuracy test: run OCR on wine label photos and match against catalog.
 *
 * Usage: node scripts/test-label-scan.mjs [folder]
 * Default folder: ../etiketter
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { supabase } from "./lib/supabase-client.mjs";

const folder = process.argv[2] || path.resolve(import.meta.dirname, "../../etiketter");

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
  /PRODOTTO\s+IN\s+ITALIA/i, /GROWN\s+IN/i,
  /^ALC[\.\s]*\d/i,
  /^(RED|WHITE|ROS[ÉE])\s+WINE$/i,
  /ESTATE\s+BOTTLED/i,
  /DENOMINACI[OÓ]N\s+DE\s+ORIGEN/i, /QUALIT[AÄ]TSWEIN/i,
  /INDICAZIONE\s+GEOGRAFICA/i,
  /EMBOTELLADO\s+POR/i, /ELABORADO\s+POR/i,
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

function normalizeOcrText(text) {
  let n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/[|]/g, "l").replace(/(?<=[a-z])0/g, "o").replace(/(?<=[A-Z])0/g, "O").replace(/1(?=[a-z])/g, "l");
  n = n.replace(/[^\w\s]/g, " ");
  return n.replace(/\s+/g, " ").trim();
}

// ── Catalog search ─────────────────────────────────────────────────

async function searchByText(query, vintage, rawQuery) {
  if (!query || query.length < 3) return [];
  const normalized = normalizeOcrText(query);
  if (normalized.length < 3) return [];
  const params = { query: normalized, max_results: 5 };
  if (vintage) params.query_vintage = parseInt(vintage, 10);

  const rawNormalized = rawQuery ? normalizeOcrText(rawQuery) : "";
  const needsRaw = rawNormalized.length >= 3 && rawNormalized !== normalized;

  const [res1, res2] = await Promise.all([
    supabase.rpc("match_catalog_by_text", params),
    needsRaw ? supabase.rpc("match_catalog_by_text", { ...params, query: rawNormalized }) : { data: [] },
  ]);

  if (res1.error) console.error("  RPC error:", res1.error.message);
  const primary = res1.data ?? [];
  const seenIds = new Set(primary.map(m => m.id));
  for (const m of (res2.data ?? [])) {
    if (!seenIds.has(m.id)) { primary.push(m); seenIds.add(m.id); }
  }
  return primary.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// ── OCR pipeline ───────────────────────────────────────────────────

async function runOcr(worker, buffer) {
  // Get dimensions after auto-rotation
  const rotatedBuf = await sharp(buffer).rotate().toBuffer();
  const meta = await sharp(rotatedBuf).metadata();
  const rw = meta.width ?? 1000;
  const rh = meta.height ?? 1000;

  // 2 crops × 2 preprocessing = 4 OCR runs
  const base = sharp(rotatedBuf);
  const crops = [
    base.clone().resize(1500, null, { withoutEnlargement: true }),
    sharp(rotatedBuf)
      .extract({
        left: Math.round(rw * 0.15), top: Math.round(rh * 0.1),
        width: Math.round(rw * 0.7), height: Math.round(rh * 0.8),
      })
      .resize(1500, null, { withoutEnlargement: true }),
  ];

  let bestScore = -1;
  let bestResult = { name: null, producer: null, vintage: null, searchQuery: "", confidence: 0, rawText: "" };

  for (const crop of crops) {
    const variants = [
      crop.clone().grayscale().normalise().sharpen({ sigma: 1.5 }),
      crop.clone().grayscale().normalise(),
    ];
    for (const v of variants) {
      const buf = await v.toBuffer();
      const { data } = await worker.recognize(buf);
      const wineHits = (data.text.match(WINE_TERMS) ?? []).length;
      const parsed = parseOcrText(data.text);
      const hasName = parsed.name && parsed.name.length > 3 ? 10 : 0;
      const score = data.confidence + wineHits * 8 + hasName;
      if (score > bestScore) {
        bestScore = score;
        bestResult = { ...parsed, confidence: Math.round(data.confidence), rawText: data.text };
      }
    }
  }
  return bestResult;
}

// ── Main ───────────────────────────────────────────────────────────

const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
console.log(`\nTesting ${files.length} images from ${folder}\n`);
console.log("─".repeat(100));

const worker = await Tesseract.createWorker("eng+fra+ita+deu+swe");
const results = [];

for (const file of files) {
  const buffer = fs.readFileSync(path.join(folder, file));
  const t0 = performance.now();

  let ocr = { name: null, producer: null, vintage: null, searchQuery: "", confidence: 0, rawText: "" };
  try { ocr = await runOcr(worker, buffer); } catch (e) { console.error("  OCR error:", e.message); }

  // Build raw search query from all kept lines
  const rawLines = (ocr.rawText || "").split("\n")
    .map(l => cleanOcrLine(l.trim())).filter(l => lineQuality(l) >= 0.4 && l.length >= 3).slice(0, 6);
  const rawSearchQuery = rawLines.join(" ");

  let textMatches = [];
  try { textMatches = await searchByText(ocr.searchQuery, ocr.vintage, rawSearchQuery); } catch {}

  const ms = Math.round(performance.now() - t0);
  const topText = textMatches[0] ? `${textMatches[0].name} (${Math.round(textMatches[0].similarity * 100)}%)` : "-";
  const shortName = file.length > 25 ? file.slice(0, 22) + "..." : file.padEnd(25);

  console.log(`${shortName} | conf: ${String(ocr.confidence).padStart(3)}% | ${ms}ms`);
  console.log(`  OCR:      ${ocr.searchQuery || "(tom)"}`);
  console.log(`  Träff:    ${topText}`);
  console.log("─".repeat(100));

  results.push({ file, ocr, textMatches, ms });
}

await worker.terminate();

// ── Summary ────────────────────────────────────────────────────────

const total = results.length;
const withName = results.filter(r => r.ocr.name).length;
const withMatch = results.filter(r => r.textMatches.length > 0).length;
const highConf = results.filter(r => r.textMatches[0]?.similarity >= 0.5).length;
const avgConf = total > 0 ? Math.round(results.reduce((s, r) => s + r.ocr.confidence, 0) / total) : 0;
const avgMs = total > 0 ? Math.round(results.reduce((s, r) => s + r.ms, 0) / total) : 0;

console.log(`\nSammanfattning (${total} bilder):`);
console.log(`  OCR-namn extraherat:     ${withName}/${total}`);
console.log(`  Katalogträff (any):      ${withMatch}/${total}`);
console.log(`  Stark träff (≥50%):      ${highConf}/${total}`);
console.log(`  Snitt-konfidens:         ${avgConf}%`);
console.log(`  Snitt-tid:               ${avgMs}ms`);
