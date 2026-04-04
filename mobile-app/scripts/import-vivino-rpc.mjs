import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Parse .env manually to avoid dotenv dependency
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
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const [
  ,
  ,
  inputArg = "./data/catalog-sources/vivino-wine-batch.json",
] = process.argv;
const inputPath = path.resolve(process.cwd(), inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const wines = JSON.parse(fs.readFileSync(inputPath, "utf8"));
console.log(`Loaded ${wines.length} wines from ${inputPath}`);

function stripProducerPrefix(name, producer) {
  if (!name || !producer) return name;
  if (name.toLowerCase().startsWith(producer.toLowerCase() + " ")) {
    const stripped = name.slice(producer.length).trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
}

function collapseSpaces(str) {
  return str ? str.replace(/\s{2,}/g, " ").trim() : str;
}

function normalizeApostrophes(str) {
  return str ? str.replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'") : str;
}

function normalizeType(value) {
  if (!value) return null;
  const t = String(value).trim();
  if (/^rött/i.test(t) || /rött vin/i.test(t)) return "Rött";
  if (/^vitt/i.test(t) || /vitt vin/i.test(t)) return "Vitt";
  if (/mousserande/i.test(t)) return "Mousserande";
  if (/^sött/i.test(t) || /dessert/i.test(t)) return "Sött";
  if (/rosé|rose/i.test(t)) return "Rosé";
  if (/orange/i.test(t)) return "Orange";
  return t;
}

const normalized = wines
  .filter((w) => {
    // Skip wines without name, producer, or vintage — required by unique index
    if (!w.name || !w.producer) return false;
    if (!w.vintage || !/^\d{4}$/.test(String(w.vintage))) return false;
    return true;
  })
  .map((w) => {
    let name = w.name;
    let vintage =
      w.vintage && /^\d{4}$/.test(String(w.vintage))
        ? String(w.vintage)
        : null;

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
  });

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
