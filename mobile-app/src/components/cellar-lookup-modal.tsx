import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../styles/theme";
import { getAvatarLetter, lookupByCellarCode, type ProfileRow } from "../lib/profile-actions";

const STORAGE_KEY = "cellar_peek_recent";
const MAX_RECENT = 10;

type Props = {
  onSelectProfile: (profile: ProfileRow) => void;
  onClose: () => void;
};

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

export function CellarLookupModal({ onSelectProfile, onClose }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ProfileRow[]>([]);

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
    onSelectProfile(profile);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Titta in i en källare</Text>
          <Pressable onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <View style={s.inputRow}>
          <TextInput
            style={s.codeInput}
            value={code}
            onChangeText={(t) => { setCode(t.toUpperCase().slice(0, 6)); setError(null); }}
            placeholder="KÄLLARKOD"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoFocus
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

        {recent.length > 0 && (
          <View style={s.recentSection}>
            <Text style={s.sectionLabel}>SENAST BESÖKTA</Text>
            <FlatList
              data={recent}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <Pressable style={s.recentRow} onPress={() => handleLookup(item.cellar_code ?? "")}>
                  <View style={[s.avatar, { backgroundColor: item.avatar_color ?? colors.accent }]}>
                    <Text style={s.avatarLetter}>{getAvatarLetter(item.display_name)}</Text>
                  </View>
                  <View style={s.recentInfo}>
                    <Text style={s.recentName}>{item.display_name ?? "Okänd"}</Text>
                    <Text style={s.recentCode}>{item.cellar_code}</Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18, color: colors.textSecondary },
  inputRow: { flexDirection: "row", gap: 10 },
  codeInput: { flex: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: 6, textAlign: "center" },
  searchBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 20, justifyContent: "center", alignItems: "center", minWidth: 72 },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  error: { color: "#C85050", fontSize: 14, textAlign: "center" },
  recentSection: { flex: 1, gap: 8 },
  sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  avatarLetter: { color: "#FFF", fontWeight: "700", fontSize: 17 },
  recentInfo: { flex: 1 },
  recentName: { color: colors.text, fontWeight: "600", fontSize: 15 },
  recentCode: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1 },
});
