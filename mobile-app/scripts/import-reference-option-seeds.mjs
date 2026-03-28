import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , inputArg, categoryArg, modeArg = "--sql", outputArg] = process.argv;

const inputPath = path.resolve(process.cwd(), inputArg || "./data/wine-name-seeds.json");
const category = categoryArg || "wine_name";
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
    return "0";
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
    (seed, index) => `    (
      ${sqlString(seed.name)},
      ${sqlString(category)},
      ${sqlTextArray(seed.aliases)},
      ${sqlString(seed.parentName ?? seed.producer ?? null)},
      ${sqlInteger(seed.sortOrder ?? index + 1)}
    )`
  )
  .join(",\n");

const sql = `merge into public.reference_options as target
using (
  values
${valuesSql}
) as source (
  name,
  category,
  aliases,
  parent_name,
  sort_order
)
on target.name = source.name and target.category = source.category
when matched then
  update set
    aliases = source.aliases,
    parent_name = source.parent_name,
    sort_order = source.sort_order
when not matched then
  insert (
    name,
    category,
    aliases,
    parent_name,
    sort_order
  )
  values (
    source.name,
    source.category,
    source.aliases,
    source.parent_name,
    source.sort_order
  );
`;

if (mode === "--sql") {
  if (outputPath) {
    fs.writeFileSync(outputPath, sql, "utf8");
    console.log(`Wrote SQL for ${seeds.length} ${category} seeds to ${outputPath}`);
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

const tempFile = path.join(os.tmpdir(), `reference-option-seeds-${Date.now()}.sql`);
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

  console.log(`Imported ${seeds.length} ${category} seeds.`);
} finally {
  fs.rmSync(tempFile, { force: true });
}
