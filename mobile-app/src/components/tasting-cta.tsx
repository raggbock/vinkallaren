import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { resolveResultsCta } from "../lib/tasting-cta";

type Props = {
  isAnonymous: boolean;
  isHost: boolean;
  onCreateAccount: () => void;
  onStartOwnTasting: () => void;
};

export function TastingCta({ isAnonymous, isHost, onCreateAccount, onStartOwnTasting }: Props) {
  const variant = resolveResultsCta({ isAnonymous, isHost });
  if (!variant) return null;

  const isCreate = variant === "create-account";
  return (
    <View style={s.card}>
      <Text style={s.title}>{isCreate ? "Spara dina resultat" : "Sugen på att vara värd?"}</Text>
      <Text style={s.body}>
        {isCreate
          ? "Skapa ett konto så att dina provningar och betyg finns kvar."
          : "Starta din egen vinprovning och bjud in dina vänner."}
      </Text>
      <Pressable style={s.btn} onPress={isCreate ? onCreateAccount : onStartOwnTasting}>
        <Text style={s.btnText}>{isCreate ? "Skapa konto" : "Starta en egen provning"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.textLight, borderRadius: 18, padding: 18, gap: 8, borderWidth: 1, borderColor: colors.surfaceAlt, marginTop: 8 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  btn: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  btnText: { color: colors.textLight, fontWeight: "700", fontSize: 15 },
});
