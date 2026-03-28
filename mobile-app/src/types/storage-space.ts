export type StorageSpaceRow = {
  id: string;
  user_id: string;
  name: string;
  space_type: string;
  row_count: number;
  slots_per_row: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StorageSpaceInsert = {
  user_id: string;
  name: string;
  space_type: string;
  row_count: number;
  slots_per_row: number;
  notes?: string | null;
};

