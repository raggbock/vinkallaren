export type ProductCatalogWineRow = {
  id: string;
  barcode: string | null;
  systembolaget_product_id: string | null;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  type: string | null;
  vintage: number | null;
  food_pairings: string[];
  source_label: string | null;
  source_confidence: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogTextMatch = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  similarity: number;
};

export type ProductCatalogEntry = {
  barcode?: string;
  systembolagetProductId?: string;
  name: string;
  producer?: string;
  country?: string;
  region?: string;
  grape?: string;
  type?: string;
  vintage?: number;
  foodPairings?: string[];
  sourceLabel?: string;
  sourceConfidence?: "high" | "medium" | "low";
};

export type ProductLookupInput = {
  barcode?: string;
  systembolagetProductId?: string;
  name?: string;
};

export type ProductCatalogWineInsert = {
  barcode?: string | null;
  systembolaget_product_id?: string | null;
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  grape?: string | null;
  type?: string | null;
  vintage?: number | null;
  food_pairings?: string[];
  source_label?: string | null;
  source_confidence?: string | null;
  created_by?: string | null;
};
