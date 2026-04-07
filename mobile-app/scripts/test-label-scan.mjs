/**
 * Batch test: run OCR + pHash on all images in a folder.
 * Usage: node scripts/test-label-scan.mjs [folder]
 * Default folder: ../etiketter
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { supabase } from "./lib/supabase-client.mjs";

const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;
const folder = process.argv[2] || path.resolve(import.meta.dirname, "../../etiketter");

// ── dHash ───────────────────────────────────────────────────────────

function computeDHash(grayPixels) {
  let hash = "";
  let bits = 0;
  let bitCount = 0;
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH - 1; x++) {
      const idx = y * DHASH_WIDTH + x;
      bits = (bits << 1) | (grayPixels[idx] > grayPixels[idx + 1] ? 1 : 0);
      bitCount++;
      if (bitCount === 4) {
        hash += bits.toString(16);
        bits = 0;
        bitCount = 0;
      }
    }
  }
  return hash;
}

async function hashImage(buffer, cropLabel) {
  let pipeline = sharp(buffer).rotate();  // Auto-rotate EXIF
  const meta = await sharp(buffer).rotate().metadata();
  const w = meta.width ?? 100;
  const h = meta.height ?? 100;

  if (cropLabel === "center") {
    const cx = Math.round(w * 0.2), cy = Math.round(h * 0.2);
    const cw = Math.round(w * 0.6), ch = Math.round(h * 0.6);
    pipeline = pipeline.extract({ left: cx, top: cy, width: cw, height: ch });
  } else if (cropLabel === "lower") {
    const ly = Math.round(h * 0.4), lh = Math.round(h * 0.6);
    pipeline = pipeline.extract({ left: 0, top: ly, width: w, height: lh });
  }

  const { data: pixels } = await pipeline
    .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return computeDHash([...pixels]);
}

// ── OCR ─────────────────────────────────────────────────────────────

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

// ── Catalog search ──────────────────────────────────────────────────

function normalizeOcrText(text) {
  let n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/[|]/g, "l").replace(/(?<=[a-z])0/g, "o").replace(/(?<=[A-Z])0/g, "O").replace(/1(?=[a-z])/g, "l");
  n = n.replace(/[^\w\s]/g, " ");
  return n.replace(/\s+/g, " ").trim();
}

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

  if (res1.error) console.error("  RPC error:", res1.error.message, res1.error.details);
  if (!res1.data?.length && normalized.length >= 3) console.log(`  [debug] query="${normalized}" → 0 results`);
  const primary = res1.data ?? [];
  const seenIds = new Set(primary.map(m => m.id));
  for (const m of (res2.data ?? [])) {
    if (!seenIds.has(m.id)) { primary.push(m); seenIds.add(m.id); }
  }
  return primary.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

async function searchByImage(hashes) {
  const results = await Promise.all(
    hashes.map(h => supabase.rpc("match_catalog_by_image", { query_hash: h.hash, max_results: 3 }))
  );
  const best = new Map();
  for (const res of results) {
    for (const m of (res.data ?? [])) {
      const existing = best.get(m.id);
      if (!existing || m.hash_distance < existing.hash_distance) best.set(m.id, m);
    }
  }
  return [...best.values()].sort((a, b) => a.hash_distance - b.hash_distance).slice(0, 3);
}

// ── Main ────────────────────────────────────────────────────────────

const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();
console.log(`\nTesting ${files.length} images from ${folder}\n`);
console.log("─".repeat(100));

const worker = await Tesseract.createWorker("swe+eng");
const results = [];

for (const file of files) {
  const filePath = path.join(folder, file);
  const buffer = fs.readFileSync(filePath);
  const t0 = performance.now();

  // OCR with grayscale preprocessing via sharp
  let ocrResult = { name: null, producer: null, vintage: null, searchQuery: "", confidence: 0, rawText: "" };
  try {
    const rotated = sharp(buffer).rotate();
    const meta = await sharp(buffer).rotate().metadata();
    const rw = meta.width ?? 1000;
    const rh = meta.height ?? 1000;

    // Try full image and center crop (label is usually in the middle)
    const crops = [
      { label: "full", pipeline: rotated.clone().resize(1500, null, { withoutEnlargement: true }) },
      { label: "center", pipeline: rotated.clone()
        .extract({
          left: Math.round(rw * 0.15), top: Math.round(rh * 0.1),
          width: Math.round(rw * 0.7), height: Math.round(rh * 0.8),
        })
        .resize(1500, null, { withoutEnlargement: true })
      },
    ];

    let bestConf = 0;
    let bestRawText = "";
    for (const crop of crops) {
      const preprocessed = await crop.pipeline.grayscale().normalise().toBuffer();
      const { data } = await worker.recognize(preprocessed);
      if (data.confidence > bestConf) {
        bestConf = data.confidence;
        bestRawText = data.text;
        const parsed = parseOcrText(data.text);
        ocrResult = { ...parsed, confidence: Math.round(data.confidence), rawText: bestRawText };
      }
    }
  } catch { /* OCR failed */ }

  // pHash (3 crops)
  let hashes = [];
  try {
    hashes = await Promise.all([
      hashImage(buffer, "full").then(hash => ({ label: "full", hash })),
      hashImage(buffer, "center").then(hash => ({ label: "center", hash })),
      hashImage(buffer, "lower").then(hash => ({ label: "lower", hash })),
    ]);
  } catch { /* hash failed */ }

  // Catalog search
  let textMatches = [];
  let imageMatches = [];
  let rawSearchQuery = "";
  try {
    // Build raw search query from all kept lines
    const rawSearchLines = (ocrResult.rawText || "").split("\n")
      .map(l => cleanOcrLine(l.trim())).filter(l => lineQuality(l) >= 0.4 && l.length >= 3).slice(0, 6);
    rawSearchQuery = rawSearchLines.join(" ");

    [textMatches, imageMatches] = await Promise.all([
      searchByText(ocrResult.searchQuery, ocrResult.vintage, rawSearchQuery),
      hashes.length > 0 ? searchByImage(hashes) : Promise.resolve([]),
    ]);
  } catch { /* search failed */ }

  const ms = Math.round(performance.now() - t0);

  // Format output
  const shortName = file.length > 25 ? file.slice(0, 22) + "..." : file.padEnd(25);
  const ocrName = (ocrResult.name || "(inget)").slice(0, 30).padEnd(30);
  const topText = textMatches[0] ? `${textMatches[0].name} (${Math.round(textMatches[0].similarity * 100)}%)` : "-";
  const topImage = imageMatches[0] ? `${imageMatches[0].name} (d=${imageMatches[0].hash_distance})` : "-";

  // Show all kept OCR lines (quality filter)
  const allKept = (ocrResult.rawText || "").split("\n")
    .map(l => l.trim()).filter(Boolean)
    .map(l => { const c = cleanOcrLine(l); return { text: c, q: lineQuality(c) }; })
    .filter(l => l.q >= 0.4 && l.text.length >= 3)
    .sort((a, b) => b.q * Math.sqrt(b.text.length) - a.q * Math.sqrt(a.text.length))
    .slice(0, 5);

  console.log(`${shortName} | conf: ${String(ocrResult.confidence).padStart(3)}% | ${ms}ms`);
  console.log(`  OCR namn:  ${ocrResult.name || "(inget)"}`);
  console.log(`  Sökfråga:  ${ocrResult.searchQuery || "(tom)"}`);
  if (allKept.length > 0) {
    console.log(`  Alla behållna rader:`);
    allKept.forEach(l => console.log(`    [${Math.round(l.q * 100)}%] ${l.text}`));
  }
  console.log(`  Rå sökning: "${rawSearchQuery?.slice(0, 60) ?? ''}"`)
  console.log(`  Text-träff: ${topText}`);
  console.log(`  Bild-träff: ${topImage}`);
  console.log("─".repeat(100));

  results.push({ file, ocrResult, hashes, textMatches, imageMatches, ms });
}

await worker.terminate();

// Summary
const withOcrName = results.filter(r => r.ocrResult.name).length;
const withTextMatch = results.filter(r => r.textMatches.length > 0).length;
const withImageMatch = results.filter(r => r.imageMatches.length > 0).length;
const avgConf = Math.round(results.reduce((s, r) => s + r.ocrResult.confidence, 0) / results.length);
const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);

console.log(`\nSammanfattning (${results.length} bilder):`);
console.log(`  OCR-namn extraherat: ${withOcrName}/${results.length}`);
console.log(`  Katalogträff (text): ${withTextMatch}/${results.length}`);
console.log(`  Katalogträff (bild): ${withImageMatch}/${results.length}`);
console.log(`  Snitt-konfidens: ${avgConf}%`);
console.log(`  Snitt-tid: ${avgMs}ms`);
