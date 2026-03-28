export type WineHistoryRow = {
  id: string;
  user_id: string;
  wine_id: string | null;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
  type: string | null;
  barcode: string | null;
  systembolaget_product_id: string | null;
  storage_space_id: string | null;
  storage_row: number | null;
  storage_slot: number | null;
  cellar_location: string | null;
  image_path: string | null;
  quantity_consumed: number;
  rating: number | null;
  tasting_notes: string | null;
  consumed_at: string;
  created_at: string;
};

export type WineHistoryRecord = WineHistoryRow & {
  image_url: string | null;
};

export type WineHistoryInsert = {
  user_id: string;
  wine_id?: string | null;
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  grape?: string | null;
  vintage?: number | null;
  type?: string | null;
  barcode?: string | null;
  systembolaget_product_id?: string | null;
  storage_space_id?: string | null;
  storage_row?: number | null;
  storage_slot?: number | null;
  cellar_location?: string | null;
  image_path?: string | null;
  quantity_consumed?: number;
  rating?: number | null;
  tasting_notes?: string | null;
};
