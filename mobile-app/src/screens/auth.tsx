import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator } from "react-native";

import { supabase } from "../lib/supabase";
import { LabeledInput } from "../components/form-controls";
import { styles } from "../styles/theme";

type AuthMode = "signin" | "signup";

export function SetupScreen() {
  return (
    <SafeAreaView style={styles.screen}>
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
    </SafeAreaView>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.screenCentered}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#f4c38c" />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [signupNotice, setSignupNotice] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Saknar uppgifter", "Fyll i både e-post och lösenord.");
      return;
    }

    setBusy(true);
    setSignupNotice("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          throw error;
        }

        const confirmationMessage =
          "Kontot är skapat. Kolla din e-post och bekräfta adressen innan du loggar in.";

        setSignupNotice(confirmationMessage);
        setAwaitingVerification(!data.session);

        Alert.alert(
          "Konto skapat",
          data.session
            ? "Kontot skapades och du är nu inloggad."
            : confirmationMessage
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      Alert.alert("Inloggning misslyckades", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestSignIn() {
    setGuestBusy(true);
    setSignupNotice("");

    try {
      const { error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }
    } catch (error) {
      Alert.alert(
        "Gästläge gick inte att starta",
        error instanceof Error
          ? `${error.message} Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge.`
          : "Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge."
      );
    } finally {
      setGuestBusy(false);
    }
  }

  if (awaitingVerification) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.scrollContent}>
          <View style={styles.heroPanel}>
            <Text style={styles.eyebrow}>Verifiera din e-post</Text>
            <Text style={styles.heroTitle}>Ett steg kvar innan du kan logga in.</Text>
            <Text style={styles.heroText}>
              Vi har skickat ett bekräftelsemail till {email}. Öppna mailet och klicka på länken, kom sedan tillbaka och logga in.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.authNotice}>
              Hittar du inget mail? Kolla skräppost eller försök registrera igen om adressen blev fel.
            </Text>

            <Pressable
              onPress={() => {
                setAwaitingVerification(false);
                setMode("signin");
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Jag har verifierat min mail</Text>
            </Pressable>

            <Pressable onPress={handleGuestSignIn} style={styles.secondaryButton} disabled={guestBusy}>
              <Text style={styles.secondaryButtonText}>
                {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst i stället"}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroPanel}>
            <Text style={styles.eyebrow}>Vinkällaren</Text>
            <Text style={styles.heroTitle}>En riktig mobilapp för din samling.</Text>
            <Text style={styles.heroText}>
              Logga in för att synka alla flaskor mellan enheter och bygga upp din källare i molnet.
            </Text>
          </View>

          <View style={styles.panel}>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setMode("signin")}
                style={[styles.segmentButton, mode === "signin" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, mode === "signin" && styles.segmentTextActive]}>Logga in</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("signup")}
                style={[styles.segmentButton, mode === "signup" && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Skapa konto</Text>
              </Pressable>
            </View>

            <LabeledInput
              label="E-post"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <LabeledInput label="Lösenord" value={password} onChangeText={setPassword} secureTextEntry />

            <Pressable onPress={handleAuth} style={styles.primaryButton} disabled={busy}>
              <Text style={styles.primaryButtonText}>
                {busy ? "Arbetar..." : mode === "signup" ? "Skapa konto" : "Logga in"}
              </Text>
            </Pressable>

            {signupNotice ? <Text style={styles.authNotice}>{signupNotice}</Text> : null}

            <Pressable onPress={handleGuestSignIn} style={styles.secondaryButton} disabled={guestBusy}>
              <Text style={styles.secondaryButtonText}>
                {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst"}
              </Text>
            </Pressable>

            <Text style={styles.authFootnote}>
              Gästläge kräver att Anonymous Sign-Ins är aktiverat i ditt Supabase-projekt.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
