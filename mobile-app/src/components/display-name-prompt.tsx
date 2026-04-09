import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";

type DisplayNamePromptProps = {
  visible: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
};

export function DisplayNamePrompt({ visible, saving, onSave, onSkip }: DisplayNamePromptProps) {
  const [name, setName] = useState("");

  if (!visible) return null;

  const canSave = name.trim().length >= 2;

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>Välj ett användarnamn</Text>
        <Text style={s.subtitle}>
          Ditt namn visas för andra deltagare i provningar.
        </Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="Minst 2 tecken"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={() => canSave && onSave(name.trim())}
        />
        <Pressable
          onPress={() => onSave(name.trim())}
          style={[s.primaryBtn, !canSave && s.disabled]}
          disabled={!canSave || saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Sparar..." : "Spara"}</Text>
        </Pressable>
        <Pressable onPress={onSkip} disabled={saving}>
          <Text style={s.skipText}>Hoppa över</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26, 15, 14, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: colors.warm,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.4,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
});
