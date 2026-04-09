import { Image, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator } from "react-native";

import { styles, colors } from "../styles/theme";

export function SetupScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>Mobilapp under uppbyggnad</Text>
        <Text style={styles.heroTitle}>Koppla in Supabase för att börja.</Text>
        <Text style={styles.heroText}>
          Lägg in <Text style={styles.mono}>EXPO_PUBLIC_SUPABASE_URL</Text> och{" "}
          <Text style={styles.mono}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> i en lokal{" "}
          <Text style={styles.mono}>.env</Text>-fil i appmappen. När de finns på plats får du inloggning, synkad databas
          och lagring i molnet.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Appmapp</Text>
          <Text style={styles.infoValue}>C:\Projects\vinkällaren\mobile-app</Text>
        </View>
      </View>
    </View>
  );
}

const logoSquare = require("../../assets/logo-square.png");

export function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.screenCentered}>
      <StatusBar style="light" />
      <Image source={logoSquare} style={{ width: 120, height: 120, marginBottom: 16 }} resizeMode="contain" />
      <ActivityIndicator size="large" color={colors.warm} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}
