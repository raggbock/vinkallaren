import sharp from "sharp";
import { supabase } from "./lib/supabase-client.mjs";

const BATCH_SIZE = 200;
const DELAY_MS = 50;
const HASH_SIZE = 8;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Compute aHash: resize to 8×8, grayscale, compare to mean → 64-bit hex */
function computeAHash(grayPixels) {
  const mean = grayPixels.reduce((a, b) => a + b, 0) / grayPixels.length;
  let hash = "";
  for (let i = 0; i < grayPixels.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4 && i + j < grayPixels.length; j++) {
      if (grayPixels[i + j] >= mean) nibble |= (1 << (3 - j));
    }
    hash += nibble.toString(16);
  }
  return hash;
}

let totalProcessed = 0;
let totalUpdated = 0;
let totalFailed = 0;
let offset = 0;

console.log("Starting pHash enrichment...\n");

while (true) {
  const { data: wines, error } = await supabase
    .from("product_catalog_wines")
    .select("id, name, image_url")
    .not("image_url", "is", null)
    .is("image_phash", null)
    .range(offset, offset + BATCH_SIZE - 1);

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

      // Resize to 8×8 grayscale using sharp
      const { data: pixels } = await sharp(buffer)
        .resize(HASH_SIZE, HASH_SIZE, { fit: "fill" })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const hash = computeAHash([...pixels]);

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
  offset += wines.length;
}

console.log(`\nDone!`);
console.log(`  Processed: ${totalProcessed}`);
console.log(`  Hashed: ${totalUpdated}`);
console.log(`  Failed: ${totalFailed}`);
