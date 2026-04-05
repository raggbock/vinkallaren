import path from "node:path";
import { fetchVivinoCatalog } from "./lib/vivino-fetcher.mjs";

const [, , outputArg = "./data/catalog-sources/vivino-wine-batch.json"] =
  process.argv;
const outputPath = path.resolve(process.cwd(), outputArg);

const COUNTRIES = ["it", "fr", "us"];

console.log("Fetching Vivino wine catalog via API...\n");
await fetchVivinoCatalog(COUNTRIES, outputPath, { delayMs: 400 });
