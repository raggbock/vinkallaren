import fs from "node:fs";
import path from "node:path";
import { supabase } from "./lib/supabase-client.mjs";

const [, , outputDirArg = "./data/catalog-images"] = process.argv;
const outputDir = path.resolve(process.cwd(), outputDirArg);
const DELAY_MS = 200;
const BATCH_SIZE = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const existingFiles = new Set(fs.readdirSync(outputDir));

console.log("Fetching catalog wines with image URLs...\n");

let offset = 0;
let totalDownloaded = 0;
let totalSkipped = 0;
let totalFailed = 0;

while (true) {
  const { data: wines, error } = await supabase
    .from("product_catalog_wines")
    .select("id, name, producer, image_url")
    .not("image_url", "is", null)
    .range(offset, offset + BATCH_SIZE - 1);

  if (error) {
    console.error("Failed to fetch wines:", error.message);
    process.exit(1);
  }

  if (!wines || wines.length === 0) break;

  for (const wine of wines) {
    const ext = wine.image_url.match(/\.(jpg|jpeg|png|webp|avif)/i)?.[1] || "jpg";
    const filename = `${wine.id}.${ext}`;

    if (existingFiles.has(filename)) {
      totalSkipped++;
      continue;
    }

    try {
      const res = await fetch(wine.image_url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!res.ok) {
        totalFailed++;
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(outputDir, filename), buffer);
      totalDownloaded++;

      if (totalDownloaded % 100 === 0) {
        console.log(
          `Downloaded: ${totalDownloaded} | Skipped: ${totalSkipped} | Failed: ${totalFailed}`
        );
      }

      await sleep(DELAY_MS);
    } catch {
      totalFailed++;
    }
  }

  offset += BATCH_SIZE;
  if (wines.length < BATCH_SIZE) break;
}

const indexPath = path.join(outputDir, "index.json");
const indexEntries = fs.readdirSync(outputDir)
  .filter((f) => f !== "index.json" && !f.startsWith("."))
  .map((f) => ({ id: f.replace(/\.[^.]+$/, ""), file: f }));

fs.writeFileSync(indexPath, JSON.stringify(indexEntries, null, 2), "utf8");

console.log(`\nDone!`);
console.log(`  Downloaded: ${totalDownloaded}`);
console.log(`  Skipped (existing): ${totalSkipped}`);
console.log(`  Failed: ${totalFailed}`);
console.log(`  Index: ${indexPath} (${indexEntries.length} entries)`);
