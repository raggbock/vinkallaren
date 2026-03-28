import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , inputArg, modeArg = "--sql", outputArg] = process.argv;

const inputPath = path.resolve(process.cwd(), inputArg || "./data/wine-name-seeds.json");
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
  if (!seed.name) {
    console.error(`Seed row ${index + 1} is missing required name.`);
    process.exit(1);
  }
}

function sqlString(value) {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value) {
  if (value === null || value === undefined || value === "") {
    return "null";
  }

  return `${Number(value)}`;
}

function normalizeType(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();

  if (/^rött/i.test(normalized) || /^rott/i.test(normalized)) {
    return "Rött";
  }

  if (/^vitt/i.test(normalized)) {
    return "Vitt";
  }

  if (/mousserande/i.test(normalized)) {
    return "Mousserande";
  }

  if (/^sött/i.test(normalized) || /dessert/i.test(normalized)) {
    return "Sött";
  }

  if (/rosé|rose/i.test(normalized)) {
    return "Rosé";
  }

  return normalized;
}

const valuesSql = seeds
  .map(
    (seed) => `    (
      ${sqlString(seed.name)},
      ${sqlString(seed.producer ?? null)},
      ${sqlString(seed.country ?? null)},
      ${sqlString(seed.region ?? null)},
      ${sqlString(normalizeType(seed.type))},
      ${sqlInteger(seed.vintage ?? null)},
      ${sqlString(seed.systembolagetProductId ?? null)},
      ${sqlString(seed.sourceLabel ?? "Seed import")},
      'high'
    )`
  )
  .join(",\n");

const sql = `merge into public.product_catalog_wines as target
using (
  values
${valuesSql}
) as source (
  name,
  producer,
  country,
  region,
  type,
  vintage,
  systembolaget_product_id,
  source_label,
  source_confidence
)
on (
  (
    source.systembolaget_product_id is not null
    and target.systembolaget_product_id = source.systembolaget_product_id
  )
  or (
    source.systembolaget_product_id is null
    and lower(target.name) = lower(source.name)
    and coalesce(lower(target.producer), '') = coalesce(lower(source.producer), '')
  )
)
when matched then
  update set
    producer = coalesce(target.producer, source.producer),
    country = coalesce(target.country, source.country),
    region = coalesce(target.region, source.region),
    type = coalesce(target.type, source.type),
    vintage = coalesce(target.vintage, source.vintage),
    systembolaget_product_id = coalesce(target.systembolaget_product_id, source.systembolaget_product_id),
    source_label = coalesce(target.source_label, source.source_label),
    source_confidence = coalesce(target.source_confidence, source.source_confidence)
when not matched then
  insert (
    name,
    producer,
    country,
    region,
    type,
    vintage,
    systembolaget_product_id,
    source_label,
    source_confidence
  )
  values (
    source.name,
    source.producer,
    source.country,
    source.region,
    source.type,
    source.vintage,
    source.systembolaget_product_id,
    source.source_label,
    source.source_confidence
  );
`;

if (mode === "--sql") {
  if (outputPath) {
    fs.writeFileSync(outputPath, sql, "utf8");
    console.log(`Wrote SQL for ${seeds.length} catalog name seeds to ${outputPath}`);
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

const tempFile = path.join(os.tmpdir(), `product-catalog-name-seeds-${Date.now()}.sql`);
fs.writeFileSync(tempFile, sql, "utf8");

try {
  const psqlPath = process.env.PSQL_PATH || "psql";
  const result = spawnSync(psqlPath, [connectionString, "-f", tempFile], {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Imported ${seeds.length} catalog name seeds.`);
} finally {
  fs.rmSync(tempFile, { force: true });
}
