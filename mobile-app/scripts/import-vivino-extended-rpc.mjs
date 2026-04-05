import fs from "node:fs";
import path from "node:path";
import { supabase } from "./lib/supabase-client.mjs";
import { stripProducerPrefix, collapseSpaces, normalizeApostrophes, normalizeType } from "./lib/normalize.mjs";

const [, , inputArg = "./data/catalog-sources/vivino-extended-batch.json"] =
  process.argv;
const inputPath = path.resolve(process.cwd(), inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
console.log(`Loaded ${wines.length} wines from ${inputPath}`);

function normalizeWine(w) {
  let name = w.name;
  let vintage = w.vintage && /^\d{4}$/.test(String(w.vintage)) ? String(w.vintage) : null;

  const yearMatch = name && name.match(/\s+((?:18|19|20)\d{2})\s*$/);
  if (yearMatch) {
    if (!vintage) vintage = yearMatch[1];
    name = name.replace(/\s+(18|19|20)\d{2}\s*$/, "");
  }

  const producer = normalizeApostrophes(w.producer || null);
  return {
    name: normalizeApostrophes(collapseSpaces(stripProducerPrefix(name, producer))),
    producer,
    country: w.country || null,
    region: w.region || null,
    type: normalizeType(w.type),
    vintage,
    grape: w.grape || null,
    imageUrl: w.imageUrl || null,
    systembolagetProductId: null,
    sourceLabel: w.sourceLabel || "Vivino",
    sourceConfidence: "catalog",
  };
}

const normalized = wines
  .filter((w) => !(!w.name || !w.producer))
  .map(normalizeWine);

console.log(
  `${wines.length - normalized.length} wines skipped (missing name/producer/vintage)`,
);
console.log(`${normalized.length} wines to import`);

const BATCH_SIZE = 200;
let totalImported = 0;

for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
  const batch = normalized.slice(i, i + BATCH_SIZE);

  const { data, error } = await supabase.rpc("import_catalog_wines", {
    wines: batch,
  });

  if (error) {
    console.error(
      `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
      error.message,
    );
    continue;
  }

  const inserted = data ?? 0;
  totalImported += inserted;

  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(normalized.length / BATCH_SIZE);
  if (batchNum % 10 === 0 || batchNum === totalBatches) {
    console.log(
      `Batch ${batchNum}/${totalBatches}: +${inserted} (${totalImported} total new)`,
    );
  }
}

console.log(`\nDone! Imported ${totalImported} new wines into database.`);
