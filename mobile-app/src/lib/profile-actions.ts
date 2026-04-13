import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  is_public: boolean;
  show_wines: boolean;
  show_taste_profile: boolean;
  cellar_code: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Deterministic avatar color from user ID.
 * Hashes the UUID to a hue in the wine-red palette (HSL).
 */
export function generateAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  // Map to warm hue range: 0-30 (reds/oranges) and 330-360 (magentas/reds)
  const hue = ((Math.abs(hash) % 60) + 330) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

export function getAvatarLetter(displayName: string | null): string {
  if (!displayName || displayName.trim().length === 0) return "?";
  return displayName.trim()[0].toUpperCase();
}

export async function fetchProfile(userId: string): Promise<Result<ProfileRow>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return fail(error.message);
  return ok(data as ProfileRow);
}

export async function updateProfile(
  userId: string,
  patch: { display_name?: string; avatar_color?: string },
): Promise<Result<ProfileRow>> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as ProfileRow);
}

/**
 * Sets display name and avatar color in one call.
 * Used by the display name prompt on first login.
 */
export async function setDisplayName(
  userId: string,
  displayName: string,
): Promise<Result<ProfileRow>> {
  const color = generateAvatarColor(userId);
  return updateProfile(userId, { display_name: displayName, avatar_color: color });
}

export async function updateVisibility(
  userId: string,
  patch: { is_public?: boolean; show_wines?: boolean; show_taste_profile?: boolean }
): Promise<ProfileRow | null> {
  let extras: Record<string, unknown> = {};
  if (patch.is_public === true) {
    const { data: current } = await supabase
      .from("profiles")
      .select("cellar_code")
      .eq("id", userId)
      .single();
    if (!current?.cellar_code) {
      const { data: codeResult } = await supabase.rpc("generate_cellar_code");
      extras.cellar_code = codeResult;
    }
  }
  if (patch.is_public === false) {
    patch.show_wines = false;
    patch.show_taste_profile = false;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, ...extras })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function regenerateCellarCode(userId: string): Promise<string> {
  const { data: code } = await supabase.rpc("generate_cellar_code");
  const { error } = await supabase
    .from("profiles")
    .update({ cellar_code: code })
    .eq("id", userId);
  if (error) throw error;
  return code as string;
}

export async function lookupByCellarCode(
  code: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("cellar_code", code.toUpperCase().trim())
    .single();
  if (error) return null;
  return data;
}
