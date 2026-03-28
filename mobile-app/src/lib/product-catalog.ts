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

  if (!endpoint) {
    return null;
  }

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
