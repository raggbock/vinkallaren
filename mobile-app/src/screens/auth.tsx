import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { colors, serifFont } from "../styles";

export function SetupScreen() {
  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <View style={s.heroPanel}>
        <Text style={s.eyebrow}>Mobilapp under uppbyggnad</Text>
        <Text style={s.heroTitle}>Koppla in Supabase för att börja.</Text>
        <Text style={s.heroText}>
          Lägg in <Text style={s.mono}>EXPO_PUBLIC_SUPABASE_URL</Text> och{" "}
          <Text style={s.mono}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> i en lokal{" "}
          <Text style={s.mono}>.env</Text>-fil i appmappen. När de finns på plats får du inloggning, synkad databas
          och lagring i molnet.
        </Text>
        <View style={s.infoBox}>
          <Text style={s.infoLabel}>Appmapp</Text>
          <Text style={s.infoValue}>C:\Projects\vinkällaren\mobile-app</Text>
        </View>
      </View>
    </View>
  );
}

const logoSquare = require("../../assets/logo-square.webp");

export function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={s.screenCentered}>
      <StatusBar style="light" />
      <Image source={logoSquare} style={{ width: 120, height: 120, marginBottom: 16 }} resizeMode="contain" />
      <ActivityIndicator size="large" color={colors.warm} />
      <Text style={s.loadingText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenCentered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: 12 },
  heroPanel: { backgroundColor: colors.surface, borderRadius: 28, padding: 22, gap: 12, borderWidth: 1.5, borderColor: colors.accent },
  eyebrow: { color: colors.accent, letterSpacing: 2, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  heroTitle: { fontFamily: serifFont, color: colors.text, fontSize: 34, lineHeight: 36, fontWeight: "700" },
  heroText: { color: colors.textSecondary, fontSize: 15, lineHeight: 23 },
  mono: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), color: colors.text },
  infoBox: { marginTop: 6, padding: 14, borderRadius: 18, backgroundColor: colors.surfaceAlt, gap: 6 },
  infoLabel: { color: colors.accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  infoValue: { color: colors.text, fontSize: 14 },
  loadingText: { color: colors.text, fontSize: 16 },
});
