import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import { supabase } from "../lib/supabase";

type UpgradePromptProps = {
  visible: boolean;
  isBlocked: boolean;
  onUpgraded: () => void;
  onDismiss: () => void;
};

export function UpgradePrompt({ visible, isBlocked, onUpgraded, onDismiss }: UpgradePromptProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const canSave = email.includes("@") && password.length >= 6;

  async function handleUpgrade() {
    setSaving(true);
    setError(null);
    const { error: authError } = await supabase.auth.updateUser({ email, password });
    setSaving(false);
    if (authError) {
      if (authError.message.includes("already been registered") || authError.message.includes("already exists")) {
        setError("Den här e-postadressen används redan");
      } else {
        setError(authError.message);
      }
      return;
    }
    onUpgraded();
  }

  return (
    <View style={s.overlay}>
      <View style={s.card}>
        <Text style={s.title}>
          {isBlocked ? "Skapa ett konto" : "Spara dina viner"}
        </Text>
        <Text style={s.subtitle}>
          {isBlocked
            ? "Du behöver ett konto för att lägga till fler viner."
            : "Skapa ett konto för att inte förlora dina viner."}
        </Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-post"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Lösenord (minst 6 tecken)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Pressable
          onPress={handleUpgrade}
          style={[s.primaryBtn, !canSave && s.disabled]}
          disabled={!canSave || saving}
        >
          <Text style={s.primaryBtnText}>{saving ? "Skapar..." : "Skapa konto"}</Text>
        </Pressable>
        {!isBlocked ? (
          <Pressable onPress={onDismiss} disabled={saving}>
            <Text style={s.skipText}>Inte nu</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
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
  error: {
    color: colors.accent,
    fontSize: 13,
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
