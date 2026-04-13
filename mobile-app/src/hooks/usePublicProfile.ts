import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  ProfileRow,
  lookupByCellarCode,
} from "../lib/profile-actions";
import { PublicWineRow } from "../types/wine";
import { fetchTasteProfile, TasteProfileData } from "../lib/taste-profile";

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

export function usePublicProfile(cellarCode: string | null) {
  const [state, setState] = useState<PublicProfileState>({
    profile: null,
    summary: null,
    wines: [],
    tasteProfile: null,
    loading: false,
    error: null,
  });

  const load = useCallback(async (code: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const profile = await lookupByCellarCode(code);
    if (!profile || !profile.is_public) {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Ingen källare hittades med den koden",
        profile: null,
      }));
      return;
    }

    // Fetch summary (always available for public profiles)
    const { data: summary } = await supabase.rpc("get_cellar_summary", {
      target_user_id: profile.id,
    });

    // Fetch wines if visible (RLS handles access)
    let wines: PublicWineRow[] = [];
    if (profile.show_wines) {
      const { data } = await supabase
        .from("wines")
        .select("id, user_id, name, producer, country, region, grape, vintage, type, food_pairings, tags, image_path, systembolaget_product_id, barcode, created_at, updated_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });
      wines = data ?? [];
    }

    // Fetch taste profile if visible
    let tasteProfile: TasteProfileData | null = null;
    if (profile.show_taste_profile) {
      tasteProfile = await fetchTasteProfile(profile.id);
    }

    setState({
      profile,
      summary: summary as CellarSummary | null,
      wines,
      tasteProfile,
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (cellarCode) load(cellarCode);
  }, [cellarCode, load]);

  return state;
}
