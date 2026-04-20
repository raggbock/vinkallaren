import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, serifFont, styles as theme } from "../styles/theme";
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

  if (peekProfile && (publicProfile.profile || publicProfile.loading)) {
    return (
      <View style={theme.panel}>
        <PanelHeader rightLabel="Profil" onRightPress={onOpenProfile} />
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
    <View style={theme.panel}>
      <PanelHeader rightLabel="Profil" onRightPress={onOpenProfile} />

      <View>
        <Text style={s.screenTitle}>Upptäck</Text>
        <Text style={s.screenSub}>Titta in i någon annans källare</Text>
      </View>

      <View style={s.inputRow}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={(t) => { setCode(t.toUpperCase().slice(0, 6)); setError(null); }}
          placeholder="KÄLLARKOD"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          maxLength={6}
        />
        <Pressable
          style={({ pressed }) => [s.searchBtn, (!code.trim() || loading) && s.searchBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={() => handleLookup(code)}
          disabled={!code.trim() || loading}
        >
          {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.searchBtnText}>Sök</Text>}
        </Pressable>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {publicProfile.loading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.loadingText}>Laddar källare...</Text>
        </View>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SquigglyLine />
          <Text style={theme.eyebrow}>Senast besökta</Text>
          <View style={{ gap: 0 }}>
            {recent.map((item, i) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [s.recentRow, i > 0 && s.recentRowBorder, pressed && { opacity: 0.65 }]}
                onPress={() => handleLookup(item.cellar_code ?? "")}
              >
                <View style={[s.avatar, { backgroundColor: item.avatar_color ?? colors.accent }]}>
                  <Text style={s.avatarLetter}>{getAvatarLetter(item.display_name)}</Text>
                </View>
                <View style={s.recentInfo}>
                  <Text style={s.recentName}>{item.display_name ?? "Okänd"}</Text>
                  <Text style={s.recentCode}>{item.cellar_code}</Text>
                </View>
                <Text style={s.recentChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
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
  screenTitle: { fontFamily: serifFont, color: colors.text, fontSize: 32, fontWeight: "700", lineHeight: 34 },
  screenSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  codeInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 4,
    textAlign: "center",
  },
  searchBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 60,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  error: { color: "#C85050", fontSize: 14, textAlign: "center" },
  loadingRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  recentRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: "#FFF", fontWeight: "700", fontSize: 17 },
  recentInfo: { flex: 1 },
  recentName: { fontFamily: serifFont, color: colors.text, fontSize: 18, fontWeight: "700" },
  recentCode: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1.5, marginTop: 1 },
  recentChevron: { color: colors.textSecondary, fontSize: 22, fontWeight: "400" },
});
