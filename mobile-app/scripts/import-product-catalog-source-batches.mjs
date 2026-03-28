import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [, , manifestArg = "./data/catalog-source-manifest.json", sourceArg = "--all", modeArg = "--sql", outputArg] = process.argv;

const manifestPath = path.resolve(process.cwd(), manifestArg);

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest file not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest) || manifest.length === 0) {
  console.error("Manifest must contain at least one source entry.");
  process.exit(1);
}

const normalizedSourceArg = sourceArg.toLowerCase();
const selectedSources = normalizedSourceArg === "--all"
  ? manifest
  : manifest.filter((entry) => String(entry.source).toLowerCase() === normalizedSourceArg.replace(/^--/, ""));

if (selectedSources.length === 0) {
  console.error(`No source matched ${sourceArg}.`);
  process.exit(1);
}

function normalizeType(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();

  if (/^rött/i.test(normalized) || /^rott/i.test(normalized) || /rött vin/i.test(normalized)) {
    return "Rött";
  }

  if (/^vitt/i.test(normalized) || /vitt vin/i.test(normalized)) {
    return "Vitt";
  }

  if (/mousserande/i.test(normalized) || /sparkling/i.test(normalized)) {
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

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildSeedKey(seed) {
  if (seed.systembolagetProductId) {
    return `sb:${normalizeKeyPart(seed.systembolagetProductId)}`;
  }

  return [
    normalizeKeyPart(seed.name),
    normalizeKeyPart(seed.producer),
    normalizeKeyPart(seed.vintage),
  ].join("|");
}

function scoreSeed(seed) {
  return [
    seed.name,
    seed.producer,
    seed.country,
    seed.region,
    seed.type,
    seed.vintage,
    seed.systembolagetProductId,
    seed.sourceUrl,
  ].filter(Boolean).length;
}

const mergedSeeds = new Map();
let loadedFiles = 0;

for (const sourceEntry of selectedSources.sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999))) {
  for (const relativeFile of sourceEntry.files ?? []) {
    const resolvedFile = path.resolve(process.cwd(), relativeFile);

    if (!fs.existsSync(resolvedFile)) {
      console.warn(`Skipping missing file: ${resolvedFile}`);
      continue;
    }

    const rows = JSON.parse(fs.readFileSync(resolvedFile, "utf8"));

    if (!Array.isArray(rows)) {
      console.warn(`Skipping invalid seed file (not array): ${resolvedFile}`);
      continue;
    }

    loadedFiles += 1;

    for (const row of rows) {
      if (!row?.name) {
        continue;
      }

      const normalizedSeed = {
        name: row.name,
        producer: row.producer ?? null,
        country: row.country ?? null,
        region: row.region ?? null,
        type: normalizeType(row.type),
        vintage: row.vintage ?? null,
        systembolagetProductId: row.systembolagetProductId ?? null,
        sourceLabel: row.sourceLabel ?? sourceEntry.source,
        sourceUrl: row.sourceUrl ?? null,
      };

      const key = buildSeedKey(normalizedSeed);
      const existing = mergedSeeds.get(key);

      if (!existing || scoreSeed(normalizedSeed) > scoreSeed(existing)) {
        mergedSeeds.set(key, normalizedSeed);
      }
    }
  }
}

const dedupedSeeds = [...mergedSeeds.values()];

if (dedupedSeeds.length === 0) {
  console.error("No seed rows found in selected sources.");
  process.exit(1);
}

const tempFile = path.resolve(process.cwd(), ".tmp-catalog-source-import.json");
fs.writeFileSync(tempFile, JSON.stringify(dedupedSeeds, null, 2), "utf8");

try {
  const importerPath = path.resolve(process.cwd(), "./scripts/import-product-catalog-name-seeds.mjs");
  const args = [importerPath, tempFile, modeArg];

  if (outputArg) {
    args.push(path.resolve(process.cwd(), outputArg));
  }

  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`Merged ${dedupedSeeds.length} catalog seeds from ${loadedFiles} source files.`);
} finally {
  fs.rmSync(tempFile, { force: true });
}
