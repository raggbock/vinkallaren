import fs from "node:fs";
import path from "node:path";
import Tesseract from "tesseract.js";
import { supabase } from "./lib/supabase-client.mjs";

const BATCH_SIZE = 100;
const DELAY_MS = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log("Initializing Tesseract worker (swe+eng)...");
const worker = await Tesseract.createWorker("swe+eng");
console.log("Worker ready.\n");

let totalProcessed = 0;
let totalUpdated = 0;
let totalFailed = 0;
let totalSkipped = 0;
const skippedWines = [];
const failedWines = [];

while (true) {
  const { data: wines, error } = await supabase.rpc("get_wines_needing_ocr", {
    batch_size: BATCH_SIZE,
  });

  if (error) {
    console.error("Failed to fetch wines:", error.message);
    break;
  }

  if (!wines || wines.length === 0) break;

  for (const wine of wines) {
    totalProcessed++;

    try {
      const res = await fetch(wine.image_url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!res.ok) {
        totalFailed++;
        failedWines.push({ id: wine.id, name: wine.name, image_url: wine.image_url, reason: `HTTP ${res.status}` });
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const { data } = await worker.recognize(buffer);
      const ocrText = data.text?.trim() || "";

      if (!ocrText) {
        totalSkipped++;
        skippedWines.push({ id: wine.id, name: wine.name, image_url: wine.image_url, reason: "no text extracted" });
        continue;
      }

      const { error: updateError } = await supabase.rpc("set_image_ocr_text", {
        wine_id: wine.id,
        ocr_text: ocrText,
      });

      if (updateError) {
        totalFailed++;
        continue;
      }

      totalUpdated++;

      if (totalUpdated % 50 === 0) {
        console.log(
          `Processed: ${totalProcessed} | Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`
        );
      }

      await sleep(DELAY_MS);
    } catch (err) {
      totalFailed++;
      failedWines.push({ id: wine.id, name: wine.name, image_url: wine.image_url, reason: err?.message || "unknown error" });
    }
  }

  if (wines.length < BATCH_SIZE) break;
}

await worker.terminate();

if (skippedWines.length || failedWines.length) {
  const outPath = path.resolve(process.cwd(), "data/catalog-sources/ocr-unprocessable.json");
  fs.writeFileSync(outPath, JSON.stringify({ skipped: skippedWines, failed: failedWines }, null, 2));
  console.log(`\nWrote ${skippedWines.length + failedWines.length} unprocessable entries to ${outPath}`);
}

console.log(`\nDone!`);
console.log(`  Processed: ${totalProcessed}`);
console.log(`  Updated with OCR text: ${totalUpdated}`);
console.log(`  Skipped (no text found): ${totalSkipped}`);
console.log(`  Failed: ${totalFailed}`);
