import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { ProfileRow } from "../lib/profile-actions";
import type { PublicWineRow } from "../types/wine";
import { fetchTasteProfile, type TasteProfileData } from "../lib/taste-profile";

export type CellarSummary = {
  total_bottles: number;
  unique_labels: number;
  top_country: string | null;
  top_type: string | null;
  top_grape: string | null;
  avg_vintage: number | null;
  type_distribution: Record<string, number> | null;
};

type PublicProfileState = {
  profile: ProfileRow | null;
  summary: CellarSummary | null;
  wines: PublicWineRow[];
  tasteProfile: TasteProfileData | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: PublicProfileState = {
  profile: null, summary: null, wines: [], tasteProfile: null, loading: false, error: null,
};

/**
 * Fetches public cellar data for a given profile.
 * Pass a validated ProfileRow to load their data. Pass null to reset.
 */
export function usePublicProfile(profile: ProfileRow | null) {
  const [state, setState] = useState<PublicProfileState>(EMPTY);

  const load = useCallback(async (p: ProfileRow) => {
    setState((s) => ({ ...s, profile: p, loading: true, error: null }));

    const { data: summary } = await supabase.rpc("get_cellar_summary", {
      target_user_id: p.id,
    });

    let wines: PublicWineRow[] = [];
    if (p.show_wines) {
      const { data } = await supabase
        .from("wines")
        .select("id, user_id, name, producer, country, region, grape, vintage, type, food_pairings, tags, image_path, systembolaget_product_id, barcode, created_at, updated_at")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false });
      wines = (data ?? []) as PublicWineRow[];
    }

    let tasteProfile: TasteProfileData | null = null;
    if (p.show_taste_profile) {
      tasteProfile = await fetchTasteProfile(p.id);
    }

    setState({
      profile: p,
      summary: summary as CellarSummary | null,
      wines,
      tasteProfile,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (profile) {
      load(profile);
    } else {
      setState(EMPTY);
    }
  }, [profile, load]);

  return state;
}
