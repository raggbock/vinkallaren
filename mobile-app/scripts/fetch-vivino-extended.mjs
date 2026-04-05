import path from "node:path";
import { fetchVivinoCatalog } from "./lib/vivino-fetcher.mjs";

const [, , outputArg = "./data/catalog-sources/vivino-extended-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

// Extended country list — skip it/fr/us (already in vivino-wine-batch.json)
const COUNTRIES = [
  "es", "pt", "de", "at", "ar", "cl", "au", "nz", "za",
  "gr", "hu", "ro", "ge", "hr", "si", "bg", "ch", "gb",
  "il", "lb", "mx", "br", "uy",
];

console.log("Fetching Vivino extended wine catalog...");
await fetchVivinoCatalog(COUNTRIES, outputPath, { delayMs: 500 });
