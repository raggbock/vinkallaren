export type WineRow = {
  id: string;
  user_id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
  quantity: number;
  type: string;
  barcode: string | null;
  systembolaget_product_id: string | null;
  storage_space_id: string | null;
  storage_row: number | null;
  storage_slot: number | null;
  tags: string[];
  food_pairings: string[];
  pairing_source: string | null;
  notes: string | null;
  cellar_location: string | null;
  image_path: string | null;
  acquired_at: string | null;
  drink_by_year: number | null;
  created_at: string;
  updated_at: string;
};

export type WineRecord = WineRow & {
  image_url: string | null;
};

export type WineInsert = {
  user_id: string;
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  grape?: string | null;
  vintage?: number | null;
  quantity: number;
  type: string;
  barcode?: string | null;
  systembolaget_product_id?: string | null;
  storage_space_id?: string | null;
  storage_row?: number | null;
  storage_slot?: number | null;
  tags?: string[];
  food_pairings?: string[];
  pairing_source?: string | null;
  notes?: string | null;
  cellar_location?: string | null;
  image_path?: string | null;
  acquired_at?: string | null;
  drink_by_year?: number | null;
};
