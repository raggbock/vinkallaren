import { useCallback, useEffect, useState } from "react";
import {
  fetchProfile,
  setDisplayName,
  updateProfile,
  generateAvatarColor,
  type ProfileRow,
} from "../lib/profile-actions";
import { showError } from "../lib/show-error";

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchProfile(userId).then((result) => {
      if (!mounted) return;
      if (result.data) {
        // Ensure avatar_color is set (backfill for existing users)
        if (!result.data.avatar_color) {
          const color = generateAvatarColor(userId);
          updateProfile(userId, { avatar_color: color }).then((r) => {
            if (r.data && mounted) setProfile(r.data);
          });
          setProfile({ ...result.data, avatar_color: color });
        } else {
          setProfile(result.data);
        }
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  /** True when display name is missing or still the email placeholder */
  const needsDisplayName =
    !loading &&
    profile != null &&
    (!profile.display_name || profile.display_name.includes("@"));

  const saveDisplayName = useCallback(
    async (name: string) => {
      const result = await setDisplayName(userId, name);
      if (result.error) {
        showError("Kunde inte spara namn", result.error);
        return false;
      }
      setProfile(result.data!);
      return true;
    },
    [userId],
  );

  const updateName = useCallback(
    async (name: string) => {
      const result = await updateProfile(userId, { display_name: name });
      if (result.error) {
        showError("Kunde inte uppdatera namn", result.error);
        return false;
      }
      setProfile(result.data!);
      return true;
    },
    [userId],
  );

  return { profile, setProfile, loading, needsDisplayName, saveDisplayName, updateName };
}
