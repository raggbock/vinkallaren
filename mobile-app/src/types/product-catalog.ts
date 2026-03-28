export type ProductCatalogWineRow = {
  id: string;
  barcode: string;
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

export type ProductCatalogWineInsert = {
  barcode: string;
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
