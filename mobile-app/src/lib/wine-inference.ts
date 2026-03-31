import type { ProductCatalogEntry, ProductLookupInput } from "./product-catalog";

type OpenFoodFactsResponse = {
  code?: string;
  status?: number;
  product?: {
    product_name?: string;
    product_name_sv?: string;
    generic_name?: string;
    generic_name_sv?: string;
    brands?: string;
    countries?: string;
    origins?: string;
    categories?: string;
  };
};

export async function findOpenFoodFactsMatch(input: ProductLookupInput): Promise<ProductCatalogEntry | null> {
  const barcode = input.barcode?.trim();
  if (!barcode || barcode.length < 8) return null;

  const fields = [
    "code", "product_name", "product_name_sv", "generic_name",
    "generic_name_sv", "brands", "countries", "origins", "categories",
  ].join(",");

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${encodeURIComponent(fields)}`
  );
  if (!response.ok) return null;

  const data = (await response.json()) as OpenFoodFactsResponse;
  if (data.status !== 1 || !data.product) return null;

  return mapOpenFoodFactsProduct(barcode, data.product);
}

function mapOpenFoodFactsProduct(barcode: string, product: NonNullable<OpenFoodFactsResponse["product"]>): ProductCatalogEntry | null {
  const name = firstNonEmpty([product.product_name_sv, product.product_name, product.generic_name_sv, product.generic_name]);
  if (!name) return null;

  const confidence = classifyWineConfidence(name, product.categories);
  if (confidence === "low") return null;

  const country = firstNonEmpty([product.countries, product.origins]);
  const type = inferWineType(name, product.categories);

  return {
    barcode, name,
    producer: cleanValue(product.brands),
    country: cleanValue(country),
    region: inferRegion(name, product.categories),
    grape: inferGrape(name, product.categories),
    type,
    vintage: inferVintage(name),
    foodPairings: inferFoodPairings(name, product.categories, type),
    sourceLabel: confidence === "high" ? "Open Food Facts" : "Open Food Facts (möjlig träff)",
    sourceConfidence: confidence,
  };
}

export function classifyWineConfidence(name: string, categories?: string): "high" | "medium" | "low" {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);

  if (matchesAny(haystack, [
    "wine", "vin", "red wine", "white wine", "rose wine", "sparkling wine",
    "champagne", "prosecco", "cava", "barolo", "rioja", "chianti",
    "riesling", "chablis", "sancerre", "bourgogne",
  ])) return "high";

  if (matchesAny(haystack, [
    "alcoholic beverages", "alcoholic beverage", "beverages", "fermented beverages",
    "druvor", "grapes", "organic wine", "natural wine", "vin rouge", "vin blanc",
    "vino", "wein", "brut", "reserve", "reserva", "grand cru", "premier cru",
    "cotes du rhone", "cotes de", "chateau", "domaine", "cuvee", "cuvée",
  ])) return "medium";

  if (matchesAny(haystack, [
    "chocolate", "snack", "chips", "candy", "confectionery", "hazelnut spread",
    "coffee", "tea", "juice", "yoghurt", "cheese", "beer", "stout", "ipa",
    "cider", "whisky", "vodka", "gin", "rum",
  ])) return "low";

  return inferVintage(name) || inferGrape(name, categories) || inferRegion(name, categories) ? "medium" : "low";
}

function inferWineType(name: string, categories?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);
  if (matchesAny(haystack, ["champagne", "prosecco", "cava", "sparkling", "mousserande", "frizzante"])) return "Mousserande";
  if (matchesAny(haystack, ["rose", "rosé"])) return "Rosé";
  if (matchesAny(haystack, ["white wine", "vin blanc", "vitt vin", "riesling", "chablis", "sancerre"])) return "Vitt";
  if (matchesAny(haystack, ["dessert wine", "sauternes", "tokaji", "port", "sherry", "late harvest"])) return "Dessert";
  if (matchesAny(haystack, ["red wine", "vin rouge", "rott vin", "rött vin", "rioja", "barolo", "chianti"])) return "Rött";
  if (matchesAny(haystack, ["wine", "vin"])) return "Rött";
  return undefined;
}

function inferFoodPairings(name: string, categories?: string, type?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);
  if (type === "Mousserande") return ["aperitif", "skaldjur", "chips", "ost"];
  if (type === "Vitt") return ["fisk", "skaldjur", "getost", "sallad"];
  if (type === "Rosé") return ["grillat", "sallad", "fågel", "aperitif"];
  if (type === "Dessert") return ["dessert", "ost", "frukt"];
  if (matchesAny(haystack, ["pinot noir", "burgundy", "bourgogne"])) return ["fågel", "svamp", "ost"];
  if (matchesAny(haystack, ["rioja", "tempranillo", "barolo", "nebbiolo", "syrah", "cabernet", "merlot"])) return ["lamm", "nöt", "grillat", "lagrad ost"];
  return ["middag"];
}

function inferRegion(name: string, categories?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);
  const regionMatches: Array<[string, string[]]> = [
    ["Piemonte", ["piemonte", "barolo", "barbaresco"]],
    ["Toscana", ["toscana", "chianti", "brunello", "bolgheri"]],
    ["Rioja", ["rioja"]],
    ["Bourgogne", ["bourgogne", "burgundy", "chablis"]],
    ["Champagne", ["champagne"]],
    ["Loire", ["loire", "sancerre", "pouilly-fume", "pouilly fumé"]],
    ["Mosel", ["mosel"]],
    ["Rhône", ["rhone", "rhône", "chateauneuf-du-pape", "cotes du rhone"]],
    ["Napa Valley", ["napa"]],
    ["Marlborough", ["marlborough"]],
    ["Priorat", ["priorat"]],
    ["Ribera del Duero", ["ribera del duero"]],
  ];
  return regionMatches.find(([, needles]) => matchesAny(haystack, needles))?.[0];
}

function inferGrape(name: string, categories?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);
  const grapeMatches: Array<[string, string[]]> = [
    ["Nebbiolo", ["nebbiolo", "barolo", "barbaresco"]],
    ["Chardonnay", ["chardonnay", "chablis", "meursault"]],
    ["Sauvignon Blanc", ["sauvignon blanc", "sancerre", "pouilly-fume", "pouilly fumé"]],
    ["Riesling", ["riesling"]],
    ["Tempranillo", ["tempranillo", "rioja", "ribera del duero"]],
    ["Sangiovese", ["sangiovese", "chianti", "brunello"]],
    ["Pinot Noir", ["pinot noir", "bourgogne rouge", "burgundy red"]],
    ["Cabernet Sauvignon", ["cabernet sauvignon", "cabernet"]],
    ["Merlot", ["merlot"]],
    ["Syrah", ["syrah", "shiraz"]],
    ["Grenache", ["grenache", "garnacha"]],
    ["Pinot Noir, Chardonnay", ["champagne", "cremant", "crémant"]],
  ];
  return grapeMatches.find(([, needles]) => matchesAny(haystack, needles))?.[0];
}

function inferVintage(name: string) {
  const match = name.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function matchesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(normalizeForLookup(needle)));
}

function normalizeForLookup(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function firstNonEmpty(values: Array<string | undefined>) {
  return values.map(cleanValue).find(Boolean);
}

function cleanValue(value?: string | null) {
  return value?.trim() || undefined;
}
