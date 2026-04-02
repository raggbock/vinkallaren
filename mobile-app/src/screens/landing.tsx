import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";

type AuthMode = "signin" | "signup";

const BREAKPOINT = 768;

function useIsWide() {
  const [wide, setWide] = useState(() => Dimensions.get("window").width >= BREAKPOINT);
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setWide(window.width >= BREAKPOINT);
    });
    return () => sub.remove();
  }, []);
  return wide;
}

function useAuthForm() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [signupNotice, setSignupNotice] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      showError("Saknar uppgifter", "Fyll i både e-post och lösenord.");
      return;
    }
    setBusy(true);
    setSignupNotice("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: password.trim() });
        if (error) throw error;
        const msg = "Kontot är skapat. Kolla din e-post och bekräfta adressen innan du loggar in.";
        setSignupNotice(msg);
        setAwaitingVerification(!data.session);
        if (Platform.OS !== "web") {
          Alert.alert("Konto skapat", data.session ? "Kontot skapades och du är nu inloggad." : msg);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
        if (error) throw error;
      }
    } catch (error) {
      showError("Inloggning misslyckades", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestSignIn() {
    setGuestBusy(true);
    setSignupNotice("");
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (error) {
      showError(
        "Gästläge gick inte att starta",
        error instanceof Error
          ? `${error.message} Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge.`
          : "Aktivera Anonymous Sign-Ins i Supabase Authentication om du vill använda gästläge."
      );
    } finally {
      setGuestBusy(false);
    }
  }

  function resetVerification() {
    setAwaitingVerification(false);
    setMode("signin");
  }

  return { mode, setMode, email, setEmail, password, setPassword, busy, guestBusy, signupNotice, awaitingVerification, handleAuth, handleGuestSignIn, resetVerification };
}

const FEATURES = [
  { icon: "\u{1F942}", title: "Provningar med vänner", desc: "Starta blindprovningar, dela en kod och betygsätt tillsammans. Avslöja resultaten när alla är klara." },
  { icon: "\u{1F377}", title: "Katalogisera din samling", desc: "Håll ordning på flaskor, förvaringsplatser och årgångar. Sök och filtrera i din källare." },
  { icon: "\u{1F37D}", title: "Hitta rätt vin till maten", desc: "Välj vad du ska äta — få förslag på matchande viner direkt från din egen samling." },
  { icon: "\u2605", title: "Smaknoteringar och betyg", desc: "Spara tasting notes med WSAT-stöd. Bygg upp din smakhistorik över tid." },
] as const;

function MarketingContent() {
  return (
    <View style={s.marketing}>
      <Text style={s.eyebrow}>Vinkällaren</Text>
      <Text style={s.headline}>Håll koll på hela{"\n"}din vinsamling</Text>
      <Text style={s.subheadline}>
        Katalogisera, provsmaka och hitta rätt vin till maten — allt på ett ställe.
      </Text>
      <View style={s.featureList}>
        {FEATURES.map((f) => (
          <View key={f.title} style={s.featureRow}>
            <View style={s.iconBox}>
              <Text style={s.iconText}>{f.icon}</Text>
            </View>
            <View style={s.featureText}>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type VerificationViewProps = {
  email: string;
  onBack: () => void;
  onGuestSignIn: () => void;
  guestBusy: boolean;
};

function VerificationView({ email, onBack, onGuestSignIn, guestBusy }: VerificationViewProps) {
  return (
    <View style={s.formCard}>
      <Text style={s.verifyTitle}>Verifiera din e-post</Text>
      <Text style={s.verifyText}>
        Vi har skickat ett bekräftelsemail till {email}. Öppna mailet och klicka på länken, kom sedan tillbaka och logga in.
      </Text>
      <Text style={s.verifyHint}>
        Hittar du inget mail? Kolla skräppost eller försök registrera igen om adressen blev fel.
      </Text>
      <Pressable onPress={onBack} style={s.primaryCta}>
        <Text style={s.primaryCtaText}>Jag har verifierat min mail</Text>
      </Pressable>
      <Pressable onPress={onGuestSignIn} style={s.guestCta} disabled={guestBusy}>
        <Text style={s.guestCtaText}>
          {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst i stället"}
        </Text>
      </Pressable>
    </View>
  );
}

function AuthForm() {
  const { mode, setMode, email, setEmail, password, setPassword, busy, guestBusy, signupNotice, awaitingVerification, handleAuth, handleGuestSignIn, resetVerification } = useAuthForm();

  if (awaitingVerification) {
    return <VerificationView email={email} onBack={resetVerification} onGuestSignIn={handleGuestSignIn} guestBusy={guestBusy} />;
  }

  return (
    <View style={s.formCard}>
      <View style={s.segment}>
        <Pressable onPress={() => setMode("signin")} style={[s.segmentTab, mode === "signin" && s.segmentTabActive]}>
          <Text style={[s.segmentLabel, mode === "signin" && s.segmentLabelActive]}>Logga in</Text>
        </Pressable>
        <Pressable onPress={() => setMode("signup")} style={[s.segmentTab, mode === "signup" && s.segmentTabActive]}>
          <Text style={[s.segmentLabel, mode === "signup" && s.segmentLabelActive]}>Skapa konto</Text>
        </Pressable>
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>E-post</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" placeholder="namn@exempel.se" style={s.fieldInput} placeholderTextColor="#8f8178" />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Lösenord</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={handleAuth} style={s.fieldInput} placeholderTextColor="#8f8178" />
      </View>
      <Pressable onPress={handleAuth} style={s.primaryCta} disabled={busy}>
        <Text style={s.primaryCtaText}>{busy ? "Arbetar..." : mode === "signup" ? "Skapa konto" : "Logga in"}</Text>
      </Pressable>
      {signupNotice ? <Text style={s.notice}>{signupNotice}</Text> : null}
      <Pressable onPress={handleGuestSignIn} style={s.guestCta} disabled={guestBusy}>
        <Text style={s.guestCtaText}>{guestBusy ? "Startar gästläge..." : "Testa utan konto"}</Text>
      </Pressable>
    </View>
  );
}

export function LandingScreen() {
  const isWide = useIsWide();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={[s.container, isWide && s.containerWide]} keyboardShouldPersistTaps="handled">
          <MarketingContent />
          <View style={[s.authColumn, isWide && s.authColumnWide]}>
            <AuthForm />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2b1714" },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24 },
  containerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
  },

  // Marketing column
  marketing: { flex: 1, justifyContent: "center", paddingBottom: 24, maxWidth: 520 },
  eyebrow: {
    color: "#f4c38c",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 3,
    marginBottom: 12,
    fontWeight: "700",
  },
  headline: {
    color: "#fffaf5",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 12,
  },
  subheadline: {
    color: "#c4a882",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 32,
  },
  featureList: { gap: 20 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  iconBox: {
    backgroundColor: "#3d2220",
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18 },
  featureText: { flex: 1 },
  featureTitle: { color: "#fffaf5", fontSize: 13, fontWeight: "700" },
  featureDesc: { color: "#c4a882", fontSize: 11, lineHeight: 16, marginTop: 2 },

  // Auth column
  authColumn: { width: "100%" },
  authColumnWide: {
    width: 380,
    flex: 0,
    backgroundColor: "#3d2220",
    borderRadius: 20,
    padding: 32,
  },
  formCard: {
    backgroundColor: "#2b1714",
    borderRadius: 16,
    padding: 28,
    gap: 14,
  },

  // Segment control
  segment: {
    flexDirection: "row",
    backgroundColor: "#1a0f0e",
    borderRadius: 10,
    padding: 3,
    marginBottom: 6,
  },
  segmentTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentTabActive: { backgroundColor: "#3d2220" },
  segmentLabel: { color: "#8f8178", fontSize: 12, fontWeight: "600" },
  segmentLabelActive: { color: "#fffaf5" },

  // Form fields
  fieldGroup: { gap: 4 },
  fieldLabel: { color: "#c4a882", fontSize: 10 },
  fieldInput: {
    backgroundColor: "#1a0f0e",
    borderWidth: 1,
    borderColor: "#5a3a38",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fffaf5",
    fontSize: 13,
  },

  // CTAs
  primaryCta: {
    backgroundColor: "#f4c38c",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  primaryCtaText: { color: "#2b1714", fontWeight: "700", fontSize: 13 },
  guestCta: {
    borderWidth: 1.5,
    borderColor: "#f4c38c",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  guestCtaText: { color: "#f4c38c", fontWeight: "600", fontSize: 12 },

  // Notices
  notice: { color: "#c4a882", fontSize: 11, lineHeight: 16 },
  verifyTitle: { color: "#fffaf5", fontSize: 16, fontWeight: "700" },
  verifyText: { color: "#c4a882", fontSize: 12, lineHeight: 18 },
  verifyHint: { color: "#8f8178", fontSize: 11, lineHeight: 16 },
});
