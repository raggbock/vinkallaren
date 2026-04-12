export type TastingSessionRow = {
  id: string;
  host_id: string;
  title: string;
  join_code: string;
  mode: "blind" | "open";
  format: "quick" | "wset";
  free_order: boolean;
  status: "setup" | "active" | "revealing" | "ended";
  revealed_up_to: number;
  created_at: string;
};

export type SessionWineRow = {
  id: string;
  session_id: string;
  position: number;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
  type: string | null;
  wine_id: string | null;
  created_at: string;
};

export type SessionTastingRow = {
  id: string;
  session_id: string;
  session_wine_id: string;
  user_id: string;
  rating: number | null;
  notes: string | null;
  food_pairings: string[];
  tasting_data: Record<string, unknown> | null;
  created_at: string;
};

export type SessionWineInsert = {
  session_id: string;
  position: number;
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  grape?: string | null;
  vintage?: number | null;
  type?: string | null;
  wine_id?: string | null;
};

export type SessionTastingInsert = {
  session_id: string;
  session_wine_id: string;
  user_id: string;
  rating?: number | null;
  notes?: string | null;
  food_pairings?: string[];
  tasting_data?: Record<string, unknown> | null;
};

export type CreateSessionInput = {
  title: string;
  mode: "blind" | "open";
  format: "quick" | "wset";
  free_order: boolean;
};

export type SessionParticipant = {
  user_id: string;
  display_name: string;
  avatar_color: string | null;
};

export type SessionToast = { id: number; message: string };

export type SessionDishRow = {
  id: string;
  session_id: string;
  name: string;
  created_at: string;
};

export type SessionTastingDishRow = {
  session_tasting_id: string;
  session_dish_id: string;
};
