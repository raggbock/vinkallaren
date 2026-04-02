import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
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
