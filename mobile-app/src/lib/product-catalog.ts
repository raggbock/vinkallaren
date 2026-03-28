export type ProductCatalogEntry = {
  systembolagetProductId?: string;
  barcode?: string;
  name: string;
  producer?: string;
  country?: string;
  region?: string;
  grape?: string;
  type?: string;
  foodPairings?: string[];
  sourceLabel: string;
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
    foodPairings: ["dessert", "blåmögelost", "frukt"],
    sourceLabel: "Systembolaget referens",
  },
];

export function findCatalogMatch(input: { barcode?: string; systembolagetProductId?: string }) {
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
