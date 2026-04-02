import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
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

/** Injects a radial gradient background on web (RN doesn't support gradients natively) */
function useWebGradient() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = document.createElement("style");
    style.textContent = [
      "[data-landing-root] { background: radial-gradient(ellipse at 30% 20%, #3d2220 0%, #2b1714 55%, #1a0f0e 100%) !important; }",
      "[data-landing-glow] { box-shadow: 0 0 40px rgba(244,195,140,0.12), 0 0 80px rgba(244,195,140,0.06); }",
      "[data-landing-icon] { box-shadow: 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05); transition: transform 0.2s; }",
      "[data-landing-icon]:hover { transform: scale(1.08); }",
      "[data-landing-cta] { transition: filter 0.15s, transform 0.15s; }",
      "[data-landing-cta]:hover { filter: brightness(1.1); transform: translateY(-1px); }",
      "[data-landing-cta]:active { transform: translateY(0); filter: brightness(0.95); }",
    ].join("\n");
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
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
  { icon: "\u{1F37D}\uFE0F", title: "Hitta rätt vin till maten", desc: "Välj vad du ska äta — få förslag på matchande viner direkt från din egen samling." },
  { icon: "\u2B50", title: "Smaknoteringar och betyg", desc: "Spara tasting notes med WSET-stöd. Bygg upp din smakhistorik över tid." },
] as const;

function Divider() {
  return (
    <View style={s.divider}>
      <View style={s.dividerLine} />
      <Text style={s.dividerDot}>{"\u{1F347}"}</Text>
      <View style={s.dividerLine} />
    </View>
  );
}

const logoBanner = require("../../assets/logo-banner.png");

function MarketingContent({ isWide }: { isWide: boolean }) {
  return (
    <View style={s.marketing}>
      <Image source={logoBanner} style={[s.heroBanner, isWide && s.heroBannerWide]} resizeMode="contain" />
      <Text style={s.subheadline}>
        Din personliga vinsamling i fickan — katalogisera flaskor, håll provningar med vänner och hitta perfekta vinet till middagen.
      </Text>
      <Divider />
      <View style={s.featureList}>
        {FEATURES.map((f) => (
          <View key={f.title} style={s.featureRow}>
            <View style={s.iconBox} dataSet={{ landingIcon: true }}>
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
    <View style={s.formCard} dataSet={{ landingGlow: true }}>
      <Text style={s.verifyTitle}>Verifiera din e-post</Text>
      <Text style={s.verifyText}>
        Vi har skickat ett bekräftelsemail till {email}. Öppna mailet och klicka på länken, kom sedan tillbaka och logga in.
      </Text>
      <Text style={s.verifyHint}>
        Hittar du inget mail? Kolla skräppost eller försök registrera igen om adressen blev fel.
      </Text>
      <Pressable onPress={onBack} style={s.primaryCta} dataSet={{ landingCta: true }}>
        <Text style={s.primaryCtaText}>Jag har verifierat min mail</Text>
      </Pressable>
      <Pressable onPress={onGuestSignIn} style={s.guestCta} disabled={guestBusy} dataSet={{ landingCta: true }}>
        <Text style={s.guestCtaText}>
          {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst i stället"}
        </Text>
      </Pressable>
    </View>
  );
}

function AuthForm() {
  const auth = useAuthForm();

  if (auth.awaitingVerification) {
    return <VerificationView email={auth.email} onBack={auth.resetVerification} onGuestSignIn={auth.handleGuestSignIn} guestBusy={auth.guestBusy} />;
  }

  return (
    <View style={s.formCard} dataSet={{ landingGlow: true }}>
      <Text style={s.formWelcome}>Välkommen in</Text>
      <View style={s.segment}>
        <Pressable onPress={() => auth.setMode("signin")} style={[s.segmentTab, auth.mode === "signin" && s.segmentTabActive]}>
          <Text style={[s.segmentLabel, auth.mode === "signin" && s.segmentLabelActive]}>Logga in</Text>
        </Pressable>
        <Pressable onPress={() => auth.setMode("signup")} style={[s.segmentTab, auth.mode === "signup" && s.segmentTabActive]}>
          <Text style={[s.segmentLabel, auth.mode === "signup" && s.segmentLabelActive]}>Skapa konto</Text>
        </Pressable>
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>E-post</Text>
        <TextInput value={auth.email} onChangeText={auth.setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" placeholder="namn@exempel.se" style={s.fieldInput} placeholderTextColor="#8f8178" />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Lösenord</Text>
        <TextInput value={auth.password} onChangeText={auth.setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={auth.handleAuth} style={s.fieldInput} placeholderTextColor="#8f8178" />
      </View>
      <Pressable onPress={auth.handleAuth} style={s.primaryCta} disabled={auth.busy} dataSet={{ landingCta: true }}>
        <Text style={s.primaryCtaText}>{auth.busy ? "Arbetar..." : auth.mode === "signup" ? "Skapa konto" : "Logga in"}</Text>
      </Pressable>
      {auth.signupNotice ? <Text style={s.notice}>{auth.signupNotice}</Text> : null}
      <Pressable onPress={auth.handleGuestSignIn} style={s.guestCta} disabled={auth.guestBusy} dataSet={{ landingCta: true }}>
        <Text style={s.guestCtaText}>{auth.guestBusy ? "Startar gästläge..." : "Testa utan konto"}</Text>
      </Pressable>
    </View>
  );
}

export function LandingScreen() {
  const isWide = useIsWide();
  useWebGradient();

  return (
    <View style={s.root} dataSet={{ landingRoot: true }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <ScrollView contentContainerStyle={[s.container, isWide && s.containerWide]} keyboardShouldPersistTaps="handled">
          <MarketingContent isWide={isWide} />
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
    gap: 48,
  },

  // Marketing column
  marketing: { flex: 1, justifyContent: "center", paddingBottom: 24, maxWidth: 520 },
  heroBanner: { width: "100%", height: 120, marginBottom: 16 },
  heroBannerWide: { height: 150 },
  subheadline: {
    color: "#c4a882",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },

  // Decorative divider
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(244,195,140,0.2)" },
  dividerDot: { fontSize: 14 },

  // Feature list
  featureList: { gap: 20 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  iconBox: {
    backgroundColor: "#3d2220",
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(244,195,140,0.15)",
  },
  iconText: { fontSize: 20 },
  featureText: { flex: 1 },
  featureTitle: { color: "#fffaf5", fontSize: 14, fontWeight: "700" },
  featureDesc: { color: "#c4a882", fontSize: 12, lineHeight: 18, marginTop: 3 },

  // Auth column
  authColumn: { width: "100%", backgroundColor: "rgba(61,34,32,0.7)", borderRadius: 24, padding: 24 },
  authColumnWide: {
    flexBasis: 390,
    flexShrink: 0,
    flexGrow: 0,
    width: 390,
    backgroundColor: "rgba(61,34,32,0.7)",
    borderRadius: 24,
    padding: 32,
  },
  formCard: {
    backgroundColor: "rgba(43,23,20,0.9)",
    borderRadius: 18,
    padding: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(244,195,140,0.08)",
  },
  formWelcome: {
    color: "#f4c38c",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
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
  fieldLabel: { color: "#c4a882", fontSize: 11, fontWeight: "600" },
  fieldInput: {
    backgroundColor: "#1a0f0e",
    borderWidth: 1,
    borderColor: "rgba(90,58,56,0.6)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fffaf5",
    fontSize: 14,
  },

  // CTAs
  primaryCta: {
    backgroundColor: "#f4c38c",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryCtaText: { color: "#2b1714", fontWeight: "700", fontSize: 14 },
  guestCta: {
    borderWidth: 1.5,
    borderColor: "rgba(244,195,140,0.5)",
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
  },
  guestCtaText: { color: "#f4c38c", fontWeight: "600", fontSize: 13 },

  // Notices
  notice: { color: "#c4a882", fontSize: 11, lineHeight: 16 },
  verifyTitle: { color: "#fffaf5", fontSize: 16, fontWeight: "700" },
  verifyText: { color: "#c4a882", fontSize: 12, lineHeight: 18 },
  verifyHint: { color: "#8f8178", fontSize: 11, lineHeight: 16 },
});
