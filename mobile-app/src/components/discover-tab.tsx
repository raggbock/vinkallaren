import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, styles as theme } from "../styles/theme";
import { getAvatarLetter, lookupByCellarCode, type ProfileRow } from "../lib/profile-actions";
import { usePublicProfile } from "../hooks/usePublicProfile";
import { PanelHeader } from "./form-controls";
import { SquigglyLine } from "./doodles";
import { PublicProfilePage } from "./public-profile-page";

const STORAGE_KEY = "cellar_peek_recent";
const MAX_RECENT = 10;

type Props = {
  onOpenProfile: () => void;
};

export function DiscoverTab({ onOpenProfile }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProfileRow[]>([]);
  const [peekProfile, setPeekProfile] = useState<ProfileRow | null>(null);
  const publicProfile = usePublicProfile(peekProfile);

  useEffect(() => {
    loadRecent().then(setRecent);
  }, []);

  async function handleLookup(lookupCode: string) {
    const trimmed = lookupCode.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const profile = await lookupByCellarCode(trimmed);
    setLoading(false);
    if (!profile || !profile.is_public) {
      setError("Ingen publik källare hittades med den koden");
      return;
    }
    const updated = await saveRecent(profile, recent);
    setRecent(updated);
    setCode("");
    setPeekProfile(profile);
  }

  // Show inline public profile when a code is selected
  if (peekProfile && (publicProfile.profile || publicProfile.loading)) {
    return (
      <View style={s.panel}>
        <PanelHeader title="Upptäck" rightLabel="Profil" onRightPress={onOpenProfile} />
        <PublicProfilePage
          profile={publicProfile.profile ?? peekProfile}
          summary={publicProfile.summary}
          wines={publicProfile.wines}
          tasteProfile={publicProfile.tasteProfile}
          onClose={() => { setPeekProfile(null); }}
        />
      </View>
    );
  }

  return (
    <View style={s.panel}>
      <PanelHeader title="Upptäck" rightLabel="Profil" onRightPress={onOpenProfile} />

      <Text style={s.heading}>Titta in i en källare</Text>
      <Text style={s.subtitle}>Skriv in en källarkod för att se någon annans vinsamling.</Text>

      <View style={s.inputRow}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase().slice(0, 6)); setError(null); }}
          placeholder="KÄLLARKOD"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
          maxLength={6}
        />
        <Pressable
          style={[s.searchBtn, (!code.trim() || loading) && s.searchBtnDisabled]}
          onPress={() => handleLookup(code)}
          disabled={!code.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.searchBtnText}>Sök</Text>}
        </Pressable>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {publicProfile.loading && (
        <View style={s.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.loadingText}>Laddar källare...</Text>
        </View>
      )}

      {recent.length > 0 && (
        <>
          <SquigglyLine />
          <Text style={s.sectionLabel}>Senast besökta</Text>
          {recent.map((item) => (
            <Pressable key={item.id} style={s.recentRow} onPress={() => handleLookup(item.cellar_code ?? "")}>
              <View style={[s.avatar, { backgroundColor: item.avatar_color ?? colors.accent }]}>
                <Text style={s.avatarLetter}>{getAvatarLetter(item.display_name)}</Text>
              </View>
              <View style={s.recentInfo}>
                <Text style={s.recentName}>{item.display_name ?? "Okänd"}</Text>
                <Text style={s.recentCode}>{item.cellar_code}</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

async function loadRecent(): Promise<ProfileRow[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveRecent(profile: ProfileRow, existing: ProfileRow[]): Promise<ProfileRow[]> {
  const filtered = existing.filter((p) => p.id !== profile.id);
  const updated = [profile, ...filtered].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

const s = StyleSheet.create({
  panel: { gap: 12, flex: 1 },
  heading: { color: colors.text, fontSize: 20, fontWeight: "700" },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: 6, textAlign: "center",
  },
  searchBtn: {
    backgroundColor: colors.accent, borderRadius: 16,
    paddingHorizontal: 20, justifyContent: "center", alignItems: "center", minWidth: 72,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  error: { color: "#C85050", fontSize: 14, textAlign: "center" },
  loadingRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  sectionLabel: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: "#FFF", fontWeight: "700", fontSize: 17 },
  recentInfo: { flex: 1 },
  recentName: { color: colors.text, fontWeight: "600", fontSize: 15 },
  recentCode: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1 },
});
