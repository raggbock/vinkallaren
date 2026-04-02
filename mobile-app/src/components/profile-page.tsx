import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar } from "./avatar";
import { PanelHeader } from "./form-controls";
import { TasteProfile } from "./taste-profile";
import type { ProfileRow } from "../lib/profile-actions";

type ProfilePageProps = {
  profile: ProfileRow;
  onUpdateName: (name: string) => Promise<boolean>;
  onSignOut: () => void;
  onBack: () => void;
  onOpenSession?: (sessionId: string) => void;
};

export function ProfilePage({ profile, onUpdateName, onSignOut, onBack, onOpenSession }: ProfilePageProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name.trim().length < 2) return;
    setSaving(true);
    const ok = await onUpdateName(name.trim());
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <View>
      <PanelHeader title="Profil" rightLabel="Tillbaka" onRightPress={onBack} />

      <View style={s.section}>
        <View style={s.avatarRow}>
          <Avatar
            displayName={profile.display_name}
            userId={profile.id}
            avatarColor={profile.avatar_color}
            size={64}
          />
          {editing ? (
            <View style={s.editRow}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Pressable onPress={handleSave} style={s.saveBtn} disabled={saving || name.trim().length < 2}>
                <Text style={s.saveBtnText}>{saving ? "..." : "Spara"}</Text>
              </Pressable>
              <Pressable onPress={() => { setEditing(false); setName(profile.display_name || ""); }}>
                <Text style={s.cancelText}>Avbryt</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditing(true)} style={s.nameRow}>
              <Text style={s.displayName}>{profile.display_name || "Inget namn"}</Text>
              <Text style={s.editLink}>Ändra</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Smakprofil</Text>
        <TasteProfile userId={profile.id} onOpenSession={onOpenSession ?? (() => {})} />
      </View>

      <View style={s.section}>
        <Pressable onPress={onSignOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Logga ut</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ead8ca",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  nameRow: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  editLink: {
    color: "#6f1d1b",
    fontSize: 13,
    fontWeight: "600",
  },
  editRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ead8ca",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#231815",
    fontSize: 16,
    backgroundColor: "#fffaf5",
  },
  saveBtn: {
    backgroundColor: "#6f1d1b",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 13,
  },
  cancelText: {
    color: "#564a40",
    fontSize: 13,
  },
  sectionTitle: {
    color: "#564a40",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: "#6f1d1b",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  signOutText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 14,
  },
});
