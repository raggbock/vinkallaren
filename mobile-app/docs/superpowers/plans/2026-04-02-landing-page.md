# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain AuthScreen with a marketing-first landing page that shows feature highlights alongside the auth form in a responsive split layout.

**Architecture:** New `LandingScreen` in `src/screens/landing.tsx` replaces `AuthScreen`. Desktop (>768px) shows a two-column split (marketing left, auth right). Narrow/mobile stacks vertically. All auth logic (sign-in, sign-up, guest, email verification) is preserved from the existing AuthScreen. The old `AuthScreen` export is removed from `src/screens/auth.tsx` (SetupScreen and LoadingScreen remain).

**Tech Stack:** React Native, Expo, TypeScript, Supabase Auth, `Dimensions` API for responsive layout

**Spec:** `docs/superpowers/specs/2026-04-02-landing-page-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/screens/landing.tsx` | Create | LandingScreen component — marketing + auth form, responsive layout |
| `src/screens/auth.tsx` | Modify | Remove AuthScreen export (keep SetupScreen, LoadingScreen) |
| `App.tsx` | Modify | Import LandingScreen instead of AuthScreen |

---

### Task 1: Create LandingScreen with responsive layout and marketing content

**Files:**
- Create: `src/screens/landing.tsx`

This task creates the full LandingScreen component with the marketing section, responsive split layout, and all auth functionality migrated from AuthScreen.

- [ ] **Step 1: Create `src/screens/landing.tsx`**

```tsx
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
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { supabase } from "../lib/supabase";
import { showError } from "../lib/show-error";
import { LabeledInput } from "../components/form-controls";

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

function AuthForm() {
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        const msg = "Kontot är skapat. Kolla din e-post och bekräfta adressen innan du loggar in.";
        setSignupNotice(msg);
        setAwaitingVerification(!data.session);
        if (Platform.OS !== "web") {
          Alert.alert("Konto skapat", data.session ? "Kontot skapades och du är nu inloggad." : msg);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
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

  if (awaitingVerification) {
    return (
      <View style={s.formCard}>
        <Text style={s.verifyTitle}>Verifiera din e-post</Text>
        <Text style={s.verifyText}>
          Vi har skickat ett bekräftelsemail till {email}. Öppna mailet och klicka på länken, kom sedan tillbaka och logga in.
        </Text>
        <Text style={s.verifyHint}>
          Hittar du inget mail? Kolla skräppost eller försök registrera igen om adressen blev fel.
        </Text>
        <Pressable
          onPress={() => { setAwaitingVerification(false); setMode("signin"); }}
          style={s.primaryCta}
        >
          <Text style={s.primaryCtaText}>Jag har verifierat min mail</Text>
        </Pressable>
        <Pressable onPress={handleGuestSignIn} style={s.guestCta} disabled={guestBusy}>
          <Text style={s.guestCtaText}>
            {guestBusy ? "Startar gästläge..." : "Fortsätt som gäst i stället"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.formCard}>
      <View style={s.segment}>
        <Pressable
          onPress={() => setMode("signin")}
          style={[s.segmentTab, mode === "signin" && s.segmentTabActive]}
        >
          <Text style={[s.segmentLabel, mode === "signin" && s.segmentLabelActive]}>Logga in</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("signup")}
          style={[s.segmentTab, mode === "signup" && s.segmentTabActive]}
        >
          <Text style={[s.segmentLabel, mode === "signup" && s.segmentLabelActive]}>Skapa konto</Text>
        </Pressable>
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>E-post</Text>
        <LabeledInput
          label=""
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          placeholder="namn@exempel.se"
          style={s.fieldInput}
        />
      </View>

      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Lösenord</Text>
        <LabeledInput
          label=""
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={handleAuth}
          style={s.fieldInput}
        />
      </View>

      <Pressable onPress={handleAuth} style={s.primaryCta} disabled={busy}>
        <Text style={s.primaryCtaText}>
          {busy ? "Arbetar..." : mode === "signup" ? "Skapa konto" : "Logga in"}
        </Text>
      </Pressable>

      {signupNotice ? <Text style={s.notice}>{signupNotice}</Text> : null}

      <Pressable onPress={handleGuestSignIn} style={s.guestCta} disabled={guestBusy}>
        <Text style={s.guestCtaText}>
          {guestBusy ? "Startar gästläge..." : "Testa utan konto"}
        </Text>
      </Pressable>
    </View>
  );
}

export function LandingScreen() {
  const isWide = useIsWide();

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.flex}
      >
        <ScrollView
          contentContainerStyle={[s.container, isWide && s.containerWide]}
          keyboardShouldPersistTaps="handled"
        >
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
  container: { flexGrow: 1, padding: 24, gap: 0 },
  containerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 48,
    gap: 0,
  },

  // Marketing column
  marketing: { flex: 1, justifyContent: "center", paddingRight: 0, paddingBottom: 24, maxWidth: 520 },
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
```

- [ ] **Step 2: Verify the file was created and has no syntax errors**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/screens/landing.tsx 2>&1 | head -20`
Expected: No errors (or only errors from external imports, not from this file's syntax)

- [ ] **Step 3: Commit**

```bash
git add src/screens/landing.tsx
git commit -m "feat: create LandingScreen with split layout and marketing content"
```

---

### Task 2: Wire up LandingScreen and remove old AuthScreen

**Files:**
- Modify: `App.tsx:25,72`
- Modify: `src/screens/auth.tsx:1-226`

- [ ] **Step 1: Update `App.tsx` import and usage**

In `App.tsx`, change line 25 from:

```tsx
import { AuthScreen, LoadingScreen, SetupScreen } from "./src/screens/auth";
```

to:

```tsx
import { LoadingScreen, SetupScreen } from "./src/screens/auth";
import { LandingScreen } from "./src/screens/landing";
```

Then change line 72 from:

```tsx
if (!session) return <AuthScreen />;
```

to:

```tsx
if (!session) return <LandingScreen />;
```

- [ ] **Step 2: Remove AuthScreen from `src/screens/auth.tsx`**

Delete the `AuthScreen` function and its associated `AuthMode` type from `src/screens/auth.tsx`. Keep `SetupScreen` and `LoadingScreen`. Also remove unused imports that were only needed by AuthScreen (`useState`, `Alert`, `KeyboardAvoidingView`, `Platform`, `Pressable`, `ScrollView`, `supabase`, `showError`, `LabeledInput`).

The file should be simplified to:

```tsx
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator } from "react-native";

import { styles } from "../styles/theme";

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

export function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.screenCentered}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#f4c38c" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}
```

Note: `SafeAreaView` was replaced with `View` since the LandingScreen handles its own layout, and these utility screens don't need safe area insets on web. If native safe area is needed later, it can be re-added.

- [ ] **Step 3: Verify no TypeScript errors**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to AuthScreen, LandingScreen, or auth.tsx

- [ ] **Step 4: Verify the app loads correctly**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx expo export --platform web 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/screens/auth.tsx src/screens/landing.tsx
git commit -m "feat: replace AuthScreen with LandingScreen on unauthenticated route"
```

---

### Task 3: Visual polish and responsive tweaks

**Files:**
- Modify: `src/screens/landing.tsx`

After the initial wiring is done, verify the layout in a browser and fix any visual issues. This task covers specific adjustments that are hard to predict until the layout is rendered.

- [ ] **Step 1: Test in browser**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx expo start --web` and open in browser.

Check:
- Desktop (>768px): Two columns side by side, marketing left, auth right
- Mobile (<768px): Stacks vertically, marketing on top, auth form below
- Resize the window across the 768px breakpoint — layout should switch dynamically
- Auth form works: sign in, sign up toggle, guest mode button
- All text is readable and properly colored

- [ ] **Step 2: Fix any issues found**

Apply targeted CSS/style fixes to `src/screens/landing.tsx`. Common issues to watch for:
- Marketing column `paddingRight` should only apply on wide layout (move to `containerWide` children)
- ScrollView may need `style={{ flex: 1 }}` to fill viewport on web
- On narrow screens, the auth column background (#3d2220) should still appear as a distinct section

- [ ] **Step 3: Commit**

```bash
git add src/screens/landing.tsx
git commit -m "fix: landing page visual polish and responsive tweaks"
```
