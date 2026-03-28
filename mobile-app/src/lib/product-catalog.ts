export type ProductCatalogEntry = {
  systembolagetProductId?: string;
  barcode?: string;
  name: string;
  producer?: string;
  country?: string;
  region?: string;
  grape?: string;
  type?: string;
  vintage?: number;
  foodPairings?: string[];
  sourceLabel: string;
};

type ProductLookupInput = {
  barcode?: string;
  systembolagetProductId?: string;
};

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

const systembolagetSeedCatalog: ProductCatalogEntry[] = [
  {
    systembolagetProductId: "7202301",
    barcode: "7310400123456",
    name: "Barolo Bricco San Pietro",
    producer: "Rocche dei Manzoni",
    country: "Italien",
    region: "Piemonte",
    grape: "Nebbiolo",
    type: "Rött",
    vintage: 2018,
    foodPairings: ["lamm", "nöt", "svamp", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "558801",
    barcode: "7310400223455",
    name: "Chablis Premier Cru",
    producer: "Louis Michel",
    country: "Frankrike",
    region: "Chablis",
    grape: "Chardonnay",
    type: "Vitt",
    vintage: 2022,
    foodPairings: ["fisk", "skaldjur", "getost", "sallad"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "7724501",
    barcode: "7310400323454",
    name: "Crémant de Bourgogne",
    producer: "Louis Bouillot",
    country: "Frankrike",
    region: "Bourgogne",
    grape: "Pinot Noir, Chardonnay",
    type: "Mousserande",
    vintage: 2021,
    foodPairings: ["aperitif", "skaldjur", "chips", "ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "1234501",
    barcode: "7310400423453",
    name: "Rioja Reserva",
    producer: "Marqués de Riscal",
    country: "Spanien",
    region: "Rioja",
    grape: "Tempranillo",
    type: "Rött",
    vintage: 2019,
    foodPairings: ["lamm", "grillat", "tapas", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "2345601",
    barcode: "7310400523452",
    name: "Sancerre Blanc",
    producer: "Henri Bourgeois",
    country: "Frankrike",
    region: "Loire",
    grape: "Sauvignon Blanc",
    type: "Vitt",
    vintage: 2023,
    foodPairings: ["fisk", "getost", "sallad", "skaldjur"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "3456701",
    barcode: "7310400623451",
    name: "Côtes du Rhône",
    producer: "E. Guigal",
    country: "Frankrike",
    region: "Rhône",
    grape: "Grenache, Syrah, Mourvèdre",
    type: "Rött",
    vintage: 2021,
    foodPairings: ["grillat", "nöt", "lamm", "svamp"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "4567801",
    barcode: "7310400723450",
    name: "Riesling Kabinett",
    producer: "Dr. Loosen",
    country: "Tyskland",
    region: "Mosel",
    grape: "Riesling",
    type: "Vitt",
    vintage: 2023,
    foodPairings: ["asiatiskt", "fisk", "skaldjur", "kryddigt"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "5678901",
    barcode: "7310400823449",
    name: "Chianti Classico",
    producer: "Castello di Ama",
    country: "Italien",
    region: "Toscana",
    grape: "Sangiovese",
    type: "Rött",
    vintage: 2020,
    foodPairings: ["pasta", "pizza", "lamm", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "6789001",
    barcode: "7310400923448",
    name: "Champagne Brut",
    producer: "Pol Roger",
    country: "Frankrike",
    region: "Champagne",
    grape: "Pinot Noir, Chardonnay, Pinot Meunier",
    type: "Mousserande",
    vintage: 2018,
    foodPairings: ["aperitif", "skaldjur", "chips", "ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "7890101",
    barcode: "7310401023447",
    name: "Tokaji Late Harvest",
    producer: "Royal Tokaji",
    country: "Ungern",
    region: "Tokaj",
    grape: "Furmint",
    type: "Dessert",
    vintage: 2022,
    foodPairings: ["dessert", "blåmögelost", "frukt"],
    sourceLabel: "Systembolaget referens",
  },
];

export async function findCatalogMatch(input: ProductLookupInput) {
  const localMatch = findLocalCatalogMatch(input);

  if (localMatch) {
    return localMatch;
  }

  return findRemoteCatalogMatch(input);
}

function findLocalCatalogMatch(input: ProductLookupInput) {
  const barcode = input.barcode?.trim();
  const systembolagetProductId = input.systembolagetProductId?.trim();

  return (
    systembolagetSeedCatalog.find((entry) => {
      const barcodeMatch = barcode && entry.barcode && entry.barcode === barcode;
      const articleMatch =
        systembolagetProductId &&
        entry.systembolagetProductId &&
        entry.systembolagetProductId === systembolagetProductId;

      return Boolean(barcodeMatch || articleMatch);
    }) ?? null
  );
}

async function findRemoteCatalogMatch(input: ProductLookupInput) {
  const endpoint = process.env.EXPO_PUBLIC_PRODUCT_LOOKUP_URL;

  if (endpoint) {
    const remoteMatch = await findCustomRemoteCatalogMatch(endpoint, input);

    if (remoteMatch) {
      return remoteMatch;
    }
  }

  return findOpenFoodFactsMatch(input);
}

async function findCustomRemoteCatalogMatch(endpoint: string, input: ProductLookupInput) {
  const query = new URLSearchParams();

  if (input.barcode?.trim()) {
    query.set("barcode", input.barcode.trim());
  }

  if (input.systembolagetProductId?.trim()) {
    query.set("systembolagetProductId", input.systembolagetProductId.trim());
  }

  const response = await fetch(`${endpoint}?${query.toString()}`);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ProductCatalogEntry | null;
  return data;
}

async function findOpenFoodFactsMatch(input: ProductLookupInput) {
  const barcode = input.barcode?.trim();

  if (!barcode || barcode.length < 8) {
    return null;
  }

  const fields = [
    "code",
    "product_name",
    "product_name_sv",
    "generic_name",
    "generic_name_sv",
    "brands",
    "countries",
    "origins",
    "categories",
  ].join(",");

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${encodeURIComponent(fields)}`
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OpenFoodFactsResponse;

  if (data.status !== 1 || !data.product) {
    return null;
  }

  return mapOpenFoodFactsProduct(barcode, data.product);
}

function mapOpenFoodFactsProduct(barcode: string, product: NonNullable<OpenFoodFactsResponse["product"]>) {
  const name = firstNonEmpty([
    product.product_name_sv,
    product.product_name,
    product.generic_name_sv,
    product.generic_name,
  ]);

  if (!name) {
    return null;
  }

  if (!looksLikeWineProduct(name, product.categories)) {
    return null;
  }

  const country = firstNonEmpty([product.countries, product.origins]);
  const type = inferWineType(name, product.categories);
  const region = inferRegion(name, product.categories);
  const grape = inferGrape(name, product.categories);
  const vintage = inferVintage(name);

  return {
    barcode,
    name,
    producer: cleanValue(product.brands),
    country: cleanValue(country),
    region,
    grape,
    type,
    vintage,
    foodPairings: inferFoodPairings(name, product.categories, type),
    sourceLabel: "Open Food Facts",
  };
}

function looksLikeWineProduct(name: string, categories?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);

  return matchesAny(haystack, [
    "wine",
    "vin",
    "red wine",
    "white wine",
    "rose wine",
    "sparkling wine",
    "champagne",
    "prosecco",
    "cava",
    "barolo",
    "rioja",
    "chianti",
    "riesling",
    "chablis",
    "sancerre",
    "bourgogne",
  ]);
}

function inferWineType(name: string, categories?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);

  if (matchesAny(haystack, ["champagne", "prosecco", "cava", "sparkling", "mousserande", "frizzante"])) {
    return "Mousserande";
  }

  if (matchesAny(haystack, ["rose", "rosé"])) {
    return "Rosé";
  }

  if (matchesAny(haystack, ["white wine", "vin blanc", "vitt vin", "riesling", "chablis", "sancerre"])) {
    return "Vitt";
  }

  if (matchesAny(haystack, ["dessert wine", "sauternes", "tokaji", "port", "sherry", "late harvest"])) {
    return "Dessert";
  }

  if (matchesAny(haystack, ["red wine", "vin rouge", "rott vin", "rött vin", "rioja", "barolo", "chianti"])) {
    return "Rött";
  }

  if (matchesAny(haystack, ["wine", "vin"])) {
    return "Rött";
  }

  return undefined;
}

function inferFoodPairings(name: string, categories?: string, type?: string) {
  const haystack = normalizeForLookup(`${name} ${categories ?? ""}`);

  if (type === "Mousserande") {
    return ["aperitif", "skaldjur", "chips", "ost"];
  }

  if (type === "Vitt") {
    return ["fisk", "skaldjur", "getost", "sallad"];
  }

  if (type === "Rosé") {
    return ["grillat", "sallad", "fågel", "aperitif"];
  }

  if (type === "Dessert") {
    return ["dessert", "ost", "frukt"];
  }

  if (matchesAny(haystack, ["pinot noir", "burgundy", "bourgogne"])) {
    return ["fågel", "svamp", "ost"];
  }

  if (matchesAny(haystack, ["rioja", "tempranillo", "barolo", "nebbiolo", "syrah", "cabernet", "merlot"])) {
    return ["lamm", "nöt", "grillat", "lagrad ost"];
  }

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

  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function matchesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(normalizeForLookup(needle)));
}

function normalizeForLookup(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstNonEmpty(values: Array<string | undefined>) {
  return values.map(cleanValue).find(Boolean);
}

function cleanValue(value?: string | null) {
  return value?.trim() || undefined;
}
