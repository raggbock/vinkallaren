import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import Tesseract from "tesseract.js";

// Parse .env manually
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BATCH_SIZE = 100;
const DELAY_MS = 100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Create a persistent Tesseract worker for speed
console.log("Initializing Tesseract worker (swe+eng)...");
const worker = await Tesseract.createWorker("swe+eng");
console.log("Worker ready.\n");

let offset = 0;
let totalProcessed = 0;
let totalUpdated = 0;
let totalFailed = 0;
let totalSkipped = 0;

while (true) {
  // Fetch wines that have an image but no OCR text yet (via security definer RPC)
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
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Run OCR on the image buffer
      const { data } = await worker.recognize(buffer);
      const ocrText = data.text?.trim() || "";

      if (!ocrText) {
        totalSkipped++;
        continue;
      }

      // Save OCR text back to the database (via security definer RPC)
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
    } catch {
      totalFailed++;
    }
  }

  // Don't increment offset — we filter by image_ocr_text IS NULL,
  // so processed rows won't appear again
  if (wines.length < BATCH_SIZE) break;
}

await worker.terminate();

console.log(`\nDone!`);
console.log(`  Processed: ${totalProcessed}`);
console.log(`  Updated with OCR text: ${totalUpdated}`);
console.log(`  Skipped (no text found): ${totalSkipped}`);
console.log(`  Failed: ${totalFailed}`);
