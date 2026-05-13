import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import type { SessionToast } from "../types/tasting-session";

export function SessionToasts({ toasts }: { toasts: SessionToast[] }) {
  if (toasts.length === 0) return null;
  return (
    <View style={s.stack}>
      {toasts.map((t) => (
        <View key={t.id} style={s.toast}>
          <Text style={s.text}>{t.message}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 6 },
  toast: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  text: { color: colors.textLight, fontSize: 13, fontWeight: "600", textAlign: "center" },
});
