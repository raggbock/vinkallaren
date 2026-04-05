import fs from "node:fs";
import path from "node:path";
import { supabase } from "./lib/supabase-client.mjs";

const [, , inputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: node upgrade-catalog-images.mjs <path-to-batch.json>");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const labelWines = wines.filter((w) => w.imageUrl && w.imageUrl.includes("_pl_") && w.name && w.producer);
console.log(`Loaded ${wines.length} wines, ${labelWines.length} have label crop images`);

const BATCH_SIZE = 200;
let totalUpgraded = 0;
let totalBackfilled = 0;

for (let i = 0; i < labelWines.length; i += BATCH_SIZE) {
  const batch = labelWines.slice(i, i + BATCH_SIZE);

  const { data: upgraded } = await supabase.rpc("upgrade_catalog_images", { wines: batch });
  totalUpgraded += upgraded ?? 0;

  const { data: backfilled } = await supabase.rpc("backfill_catalog_images", { wines: batch });
  totalBackfilled += backfilled ?? 0;

  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(labelWines.length / BATCH_SIZE);
  if (batchNum % 10 === 0 || batchNum === totalBatches) {
    console.log(`Batch ${batchNum}/${totalBatches}: ${totalUpgraded} upgraded, ${totalBackfilled} backfilled`);
  }
}

console.log(`\nDone! Upgraded ${totalUpgraded} bottle→label, backfilled ${totalBackfilled} missing images.`);
