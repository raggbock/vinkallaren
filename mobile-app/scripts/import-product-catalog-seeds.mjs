import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , inputArg, modeArg = "--sql", outputArg] = process.argv;

const inputPath = path.resolve(process.cwd(), inputArg || "./data/product-catalog-seeds.json");
const mode = modeArg;
const outputPath = outputArg ? path.resolve(process.cwd(), outputArg) : null;

if (!fs.existsSync(inputPath)) {
  console.error(`Seed file not found: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
const seeds = JSON.parse(raw);

if (!Array.isArray(seeds) || seeds.length === 0) {
  console.error("Seed file must contain a non-empty array.");
  process.exit(1);
}

for (const [index, seed] of seeds.entries()) {
  if (!seed.barcode || !seed.name) {
    console.error(`Seed row ${index + 1} is missing required barcode or name.`);
    process.exit(1);
  }
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value) {
  if (value === null || value === undefined || value === "") {
    return "null::integer";
  }

  return `${Number(value)}`;
}

function sqlTextArray(values) {
  const normalized = Array.isArray(values) ? values : [];
  const entries = normalized.map((value) => sqlString(value)).join(", ");
  return `array[${entries}]::text[]`;
}

const valuesSql = seeds
  .map(
    (seed) => `    (
      ${sqlString(seed.barcode)},
      ${sqlString(seed.name)},
      ${sqlString(seed.producer ?? null)},
      ${sqlString(seed.country ?? null)},
      ${sqlString(seed.region ?? null)},
      ${sqlString(seed.grape ?? null)},
      ${sqlString(seed.type ?? null)},
      ${sqlInteger(seed.vintage ?? null)},
      ${sqlTextArray(seed.foodPairings)},
      ${sqlString(seed.sourceLabel ?? "Import seed")},
      ${sqlString(seed.sourceConfidence ?? "medium")}
    )`
  )
  .join(",\n");

const sql = `merge into public.product_catalog_wines as target
using (
  values
${valuesSql}
) as source (
  barcode,
  name,
  producer,
  country,
  region,
  grape,
  type,
  vintage,
  food_pairings,
  source_label,
  source_confidence
)
on target.barcode = source.barcode
when matched then
  update set
    name = source.name,
    producer = source.producer,
    country = source.country,
    region = source.region,
    grape = source.grape,
    type = source.type,
    vintage = source.vintage,
    food_pairings = source.food_pairings,
    source_label = source.source_label,
    source_confidence = source.source_confidence
when not matched then
  insert (
    barcode,
    name,
    producer,
    country,
    region,
    grape,
    type,
    vintage,
    food_pairings,
    source_label,
    source_confidence
  )
  values (
    source.barcode,
    source.name,
    source.producer,
    source.country,
    source.region,
    source.grape,
    source.type,
    source.vintage,
    source.food_pairings,
    source.source_label,
    source.source_confidence
  );
`;

if (mode === "--sql") {
  if (outputPath) {
    fs.writeFileSync(outputPath, sql, "utf8");
    console.log(`Wrote SQL for ${seeds.length} seeds to ${outputPath}`);
  } else {
    process.stdout.write(sql);
  }
  process.exit(0);
}

if (mode !== "--apply") {
  console.error("Unknown mode. Use --sql or --apply.");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_POOLER_URL;

if (!connectionString) {
  console.error("Missing SUPABASE_POOLER_URL environment variable.");
  process.exit(1);
}

const tempFile = path.join(os.tmpdir(), `product-catalog-seeds-${Date.now()}.sql`);
fs.writeFileSync(tempFile, sql, "utf8");

try {
  const psqlPath = process.env.PSQL_PATH || "psql";
  const result = spawnSync(psqlPath, [connectionString, "-f", tempFile], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Imported ${seeds.length} product catalog seeds.`);
} finally {
  fs.rmSync(tempFile, { force: true });
}
