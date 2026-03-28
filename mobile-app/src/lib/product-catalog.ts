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
};

export const productCatalog: ProductCatalogEntry[] = [
  {
    systembolagetProductId: "7202301",
    name: "Barolo Bricco San Pietro",
    producer: "Rocche dei Manzoni",
    country: "Italien",
    region: "Piemonte",
    grape: "Nebbiolo",
    type: "Rött",
    foodPairings: ["lamm", "nöt", "svamp", "lagrad ost"],
  },
  {
    systembolagetProductId: "558801",
    name: "Chablis Premier Cru",
    producer: "Louis Michel",
    country: "Frankrike",
    region: "Chablis",
    grape: "Chardonnay",
    type: "Vitt",
    foodPairings: ["fisk", "skaldjur", "getost", "sallad"],
  },
  {
    systembolagetProductId: "7724501",
    name: "Crémant de Bourgogne",
    producer: "Louis Bouillot",
    country: "Frankrike",
    region: "Bourgogne",
    grape: "Pinot Noir, Chardonnay",
    type: "Mousserande",
    foodPairings: ["aperitif", "skaldjur", "chips", "ost"],
  },
];

export function findCatalogMatch(input: { barcode?: string; systembolagetProductId?: string }) {
  const barcode = input.barcode?.trim();
  const systembolagetProductId = input.systembolagetProductId?.trim();

  return productCatalog.find((entry) => {
    const barcodeMatch = barcode && entry.barcode && entry.barcode === barcode;
    const articleMatch =
      systembolagetProductId &&
      entry.systembolagetProductId &&
      entry.systembolagetProductId === systembolagetProductId;

    return Boolean(barcodeMatch || articleMatch);
  }) ?? null;
}
