import Tesseract from "tesseract.js";
import { supabase } from "./lib/supabase-client.mjs";

const [, , partIndexArg = "0", partModArg = "4"] = process.argv;
const PARTITION_INDEX = parseInt(partIndexArg, 10);
const PARTITION_MOD = parseInt(partModArg, 10);
const BATCH_SIZE = 100;
const DELAY_MS = 80;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

console.log(`[P${PARTITION_INDEX}/${PARTITION_MOD}] Initializing Tesseract worker (swe+eng)...`);
const worker = await Tesseract.createWorker("swe+eng");
console.log(`[P${PARTITION_INDEX}/${PARTITION_MOD}] Worker ready.\n`);

let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let totalFailed = 0;

while (true) {
  const { data: wines, error } = await supabase.rpc("get_wines_needing_ocr_partitioned", {
    batch_size: BATCH_SIZE,
    partition_mod: PARTITION_MOD,
    partition_index: PARTITION_INDEX,
  });

  if (error) { console.error(`[P${PARTITION_INDEX}] Fetch error:`, error.message); break; }
  if (!wines || wines.length === 0) break;

  for (const wine of wines) {
    totalProcessed++;
    try {
      const res = await fetch(wine.image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) { totalFailed++; continue; }

      const buffer = Buffer.from(await res.arrayBuffer());
      const { data } = await worker.recognize(buffer);
      const ocrText = data.text?.trim() || "";

      if (!ocrText) { totalSkipped++; continue; }

      const { error: updateError } = await supabase.rpc("set_image_ocr_text", {
        wine_id: wine.id,
        ocr_text: ocrText,
      });

      if (updateError) { totalFailed++; continue; }
      totalUpdated++;

      if (totalUpdated % 50 === 0) {
        console.log(`[P${PARTITION_INDEX}] Processed: ${totalProcessed} | Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`);
      }
      await sleep(DELAY_MS);
    } catch (err) {
      totalFailed++;
    }
  }

  if (wines.length < BATCH_SIZE) break;
}

await worker.terminate();
console.log(`\n[P${PARTITION_INDEX}/${PARTITION_MOD}] Done! Processed: ${totalProcessed} | Updated: ${totalUpdated} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`);
