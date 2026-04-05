import fs from "node:fs";
import path from "node:path";
import { supabase } from "./lib/supabase-client.mjs";

const [, , inputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: node backfill-catalog-images.mjs <path-to-batch.json>");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const withImages = wines.filter((w) => w.imageUrl && w.name && w.producer && w.vintage);
console.log(`Loaded ${wines.length} wines, ${withImages.length} have images`);

const BATCH_SIZE = 200;
let totalUpdated = 0;

for (let i = 0; i < withImages.length; i += BATCH_SIZE) {
  const batch = withImages.slice(i, i + BATCH_SIZE);

  const { data, error } = await supabase.rpc("backfill_catalog_images", {
    wines: batch,
  });

  if (error) {
    console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
    continue;
  }

  totalUpdated += data ?? 0;

  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(withImages.length / BATCH_SIZE);
  if (batchNum % 10 === 0 || batchNum === totalBatches) {
    console.log(`Batch ${batchNum}/${totalBatches}: ${totalUpdated} images backfilled so far`);
  }
}

console.log(`\nDone! Backfilled ${totalUpdated} images.`);
