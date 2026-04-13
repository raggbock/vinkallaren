import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { colors } from "../styles/theme";
import { updateVisibility, regenerateCellarCode } from "../lib/profile-actions";
import type { ProfileRow } from "../lib/profile-actions";

type Props = {
  profile: ProfileRow;
  onUpdate: (profile: ProfileRow) => void;
};

type ToggleRowProps = {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (v: boolean) => void;
};

function ToggleRow({ label, hint, value, disabled, onToggle }: ToggleRowProps) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleText}>
        <Text style={[s.toggleLabel, disabled && s.dimmed]}>{label}</Text>
        <Text style={s.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function VisibilitySettings({ profile, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggle(patch: { is_public?: boolean; show_wines?: boolean; show_taste_profile?: boolean }) {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await updateVisibility(profile.id, patch);
      if (updated) onUpdate(updated);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!profile.cellar_code) return;
    await Clipboard.setStringAsync(profile.cellar_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    try {
      const code = await regenerateCellarCode(profile.id);
      onUpdate({ ...profile, cellar_code: code });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Synlighet</Text>
      <ToggleRow
        label="Publik profil"
        hint="Andra kan se din källaröversikt"
        value={profile.is_public}
        onToggle={(v) => toggle({ is_public: v })}
      />
      <ToggleRow
        label="Visa vinlista"
        hint="Andra kan se dina viner"
        value={profile.show_wines}
        disabled={!profile.is_public}
        onToggle={(v) => toggle({ show_wines: v })}
      />
      <ToggleRow
        label="Visa smakprofil"
        hint="Andra kan se din smakprofil"
        value={profile.show_taste_profile}
        disabled={!profile.is_public}
        onToggle={(v) => toggle({ show_taste_profile: v })}
      />
      {profile.is_public && profile.cellar_code && (
        <View style={s.codeBox}>
          <Pressable onPress={handleCopy}>
            <Text style={s.cellarCode}>{profile.cellar_code}</Text>
            <Text style={s.copyHint}>{copied ? "Kopierat!" : "Tryck för att kopiera"}</Text>
          </Pressable>
          <Pressable onPress={handleRegenerate} disabled={busy}>
            <Text style={s.regenerateLink}>{busy ? "..." : "Generera ny kod"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  toggleHint: { color: colors.textSecondary, fontSize: 12 },
  dimmed: { color: colors.textSecondary },
  codeBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    alignItems: "center",
  },
  cellarCode: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
  },
  copyHint: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  regenerateLink: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
