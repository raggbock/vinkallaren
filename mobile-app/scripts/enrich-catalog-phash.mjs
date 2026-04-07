import sharp from "sharp";
import { supabase } from "./lib/supabase-client.mjs";

const BATCH_SIZE = 200;
const DELAY_MS = 50;
const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Compute dHash: resize to 9×8, grayscale, compare pixel to right neighbor → 64-bit hex */
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

let totalProcessed = 0;
let totalUpdated = 0;
let totalFailed = 0;

console.log("Starting pHash enrichment...\n");

while (true) {
  const { data: wines, error } = await supabase.rpc("get_wines_needing_phash", {
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
      if (!res.ok) { totalFailed++; continue; }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Resize to 9×8 grayscale using sharp
      const { data: pixels } = await sharp(buffer)
        .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const hash = computeDHash([...pixels]);

      const { error: updateError } = await supabase.rpc("set_image_phash", {
        wine_id: wine.id,
        phash: hash,
      });

      if (updateError) { totalFailed++; continue; }
      totalUpdated++;

      if (totalUpdated % 100 === 0) {
        console.log(`Processed: ${totalProcessed} | Hashed: ${totalUpdated} | Failed: ${totalFailed}`);
      }
      await sleep(DELAY_MS);
    } catch {
      totalFailed++;
    }
  }

  if (wines.length < BATCH_SIZE) break;
}

console.log(`\nDone!`);
console.log(`  Processed: ${totalProcessed}`);
console.log(`  Hashed: ${totalUpdated}`);
console.log(`  Failed: ${totalFailed}`);
