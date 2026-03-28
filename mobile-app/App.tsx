import "react-native-url-polyfill/auto";

import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "./src/lib/supabase";
import type { WineInsert, WineRecord, WineRow } from "./src/types/wine";

type AuthMode = "signin" | "signup";

type WineDraft = {
  name: string;
  producer: string;
  country: string;
  region: string;
  vintage: string;
  quantity: string;
  type: string;
  drinkBy: string;
  location: string;
  barcode: string;
  tags: string;
  notes: string;
  imageUri: string;
};

const defaultDraft: WineDraft = {
  name: "",
  producer: "",
  country: "",
  region: "",
  vintage: "",
  quantity: "1",
  type: "Rött",
  drinkBy: "",
  location: "",
  barcode: "",
  tags: "",
  notes: "",
  imageUri: "",
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!supabaseConfigured) {
    return <SetupScreen />;
  }

  if (loadingSession) {
    return <LoadingScreen label="Kopplar upp vinkällaren..." />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <CellarScreen session={session} />;
}

function SetupScreen() {
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

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.screenCentered}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#f4c38c" />
      <Text style={styles.loadingText}>{label}</Text>
    </SafeAreaView>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Saknar uppgifter", "Fyll i både e-post och lösenord.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          throw error;
        }

        Alert.alert(
          "Konto skapat",
          "Om e-postbekräftelse är aktiv i Supabase får du nu ett mail för att slutföra registreringen."
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CellarScreen({ session }: { session: Session }) {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [draft, setDraft] = useState<WineDraft>(defaultDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => buildStats(wines), [wines]);

  useEffect(() => {
    fetchWines();
  }, []);

  async function fetchWines() {
    setLoading(true);

    const { data, error } = await supabase
      .from("wines")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Kunde inte hämta viner", error.message);
      setLoading(false);
      return;
    }

    setWines(await hydrateWineRecords((data ?? []) as WineRow[]));
    setLoading(false);
  }

  async function saveWine() {
    if (!draft.name.trim()) {
      Alert.alert("Namn saknas", "Skriv in vilket vin du vill lägga till.");
      return;
    }

    setSaving(true);

    try {
      let imagePath: string | null = null;

      if (draft.imageUri) {
        imagePath = await uploadWineImage(session.user.id, draft.imageUri);
      }

      const payload: WineInsert = {
        user_id: session.user.id,
        name: draft.name.trim(),
        producer: emptyToNull(draft.producer),
        country: emptyToNull(draft.country),
        region: emptyToNull(draft.region),
        vintage: toNumberOrNull(draft.vintage),
        quantity: Math.max(1, Number(draft.quantity) || 1),
        type: draft.type.trim() || "Rött",
        drink_by_year: toNumberOrNull(draft.drinkBy),
        cellar_location: emptyToNull(draft.location),
        barcode: emptyToNull(draft.barcode),
        tags: parseTags(draft.tags),
        notes: emptyToNull(draft.notes),
        image_path: imagePath,
      };

      const { error } = await supabase.from("wines").insert(payload);

      if (error) {
        throw error;
      }

      setDraft(defaultDraft);
      await fetchWines();
    } catch (error) {
      Alert.alert("Kunde inte spara", error instanceof Error ? error.message : "Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  async function decrementWine(wine: WineRecord) {
    if (wine.quantity <= 1) {
      await deleteWine(wine.id, wine.image_path);
      return;
    }

    const { data, error } = await supabase
      .from("wines")
      .update({ quantity: wine.quantity - 1 })
      .eq("id", wine.id)
      .select("*")
      .single();

    if (error) {
      Alert.alert("Kunde inte uppdatera", error.message);
      return;
    }

    const [hydrated] = await hydrateWineRecords([data as WineRow]);
    setWines((current) => current.map((item) => (item.id === wine.id ? hydrated : item)));
  }

  async function deleteWine(id: string, imagePath?: string | null) {
    const { error } = await supabase.from("wines").delete().eq("id", id);

    if (error) {
      Alert.alert("Kunde inte ta bort", error.message);
      return;
    }

    if (imagePath) {
      await supabase.storage.from("wine-images").remove([imagePath]);
    }

    setWines((current) => current.filter((wine) => wine.id !== id));
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Kunde inte logga ut", error.message);
    }
  }

  async function chooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Behörighet saknas", "Ge appen tillgång till bilder för att välja en flaskbild.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setDraft((current) => ({ ...current, imageUri: result.assets[0].uri }));
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroPanel}>
          <Text style={styles.eyebrow}>Synkad vinkällare</Text>
          <Text style={styles.heroTitle}>Alla flaskor, alltid med dig.</Text>
          <Text style={styles.heroText}>{session.user.email}</Text>

          <View style={styles.metricsRow}>
            <MetricCard value={String(stats.totalBottles)} label="Flaskor" />
            <MetricCard value={String(stats.totalLabels)} label="Olika viner" />
            <MetricCard value={String(stats.drinkSoon)} label="Drick snart" />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Statistik</Text>
            <Pressable onPress={fetchWines}>
              <Text style={styles.linkText}>Uppdatera</Text>
            </Pressable>
          </View>

          <InsightCard label="Mest flaskor från" value={stats.topCountry} />
          <InsightCard label="Vanligaste typ" value={stats.topType} />
          <InsightCard label="Snittårgång" value={stats.averageVintage} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Lägg till vin</Text>
          <LabeledInput label="Namn" value={draft.name} onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <LabeledInput
            label="Producent"
            value={draft.producer}
            onChangeText={(value) => setDraft((current) => ({ ...current, producer: value }))}
          />
          <DoubleRow>
            <LabeledInput label="Land" value={draft.country} onChangeText={(value) => setDraft((current) => ({ ...current, country: value }))} />
            <LabeledInput label="Region" value={draft.region} onChangeText={(value) => setDraft((current) => ({ ...current, region: value }))} />
          </DoubleRow>
          <DoubleRow>
            <LabeledInput
              label="Årgång"
              value={draft.vintage}
              onChangeText={(value) => setDraft((current) => ({ ...current, vintage: value }))}
              keyboardType="number-pad"
            />
            <LabeledInput
              label="Antal"
              value={draft.quantity}
              onChangeText={(value) => setDraft((current) => ({ ...current, quantity: value }))}
              keyboardType="number-pad"
            />
          </DoubleRow>
          <DoubleRow>
            <LabeledInput label="Typ" value={draft.type} onChangeText={(value) => setDraft((current) => ({ ...current, type: value }))} />
            <LabeledInput
              label="Drick senast"
              value={draft.drinkBy}
              onChangeText={(value) => setDraft((current) => ({ ...current, drinkBy: value }))}
              keyboardType="number-pad"
            />
          </DoubleRow>
          <LabeledInput
            label="Plats i källaren"
            value={draft.location}
            onChangeText={(value) => setDraft((current) => ({ ...current, location: value }))}
          />
          <LabeledInput
            label="Streckkod"
            value={draft.barcode}
            onChangeText={(value) => setDraft((current) => ({ ...current, barcode: value }))}
          />
          <LabeledInput
            label="Etiketter"
            value={draft.tags}
            onChangeText={(value) => setDraft((current) => ({ ...current, tags: value }))}
            placeholder="middag, present, lagring"
          />
          <LabeledInput
            label="Anteckningar"
            value={draft.notes}
            onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
            multiline
          />

          <Pressable onPress={chooseImage} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{draft.imageUri ? "Byt bild" : "Välj flaskbild"}</Text>
          </Pressable>

          {draft.imageUri ? <Image source={{ uri: draft.imageUri }} style={styles.wineImage} /> : null}

          <Pressable onPress={saveWine} style={styles.primaryButton} disabled={saving}>
            <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara i molnet"}</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelTitle}>Min källare</Text>
            <Pressable onPress={signOut}>
              <Text style={styles.linkText}>Logga ut</Text>
            </Pressable>
          </View>

          {loading ? <LoadingInline /> : null}

          {!loading && wines.length === 0 ? (
            <Text style={styles.emptyState}>Inga viner ännu. Lägg till din första flaska ovan.</Text>
          ) : null}

          {wines.map((wine) => (
            <View key={wine.id} style={styles.wineCard}>
              {wine.image_url ? <Image source={{ uri: wine.image_url }} style={styles.wineImage} /> : null}

              <View style={styles.wineCardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.wineType}>{wine.type}</Text>
                  <Text style={styles.wineName}>{wine.name}</Text>
                  <Text style={styles.wineMeta}>
                    {[wine.producer, wine.vintage, [wine.country, wine.region].filter(Boolean).join(", ")]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                </View>
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>{wine.quantity} st</Text>
                </View>
              </View>

              {wine.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {wine.tags.map((tag) => (
                    <View key={`${wine.id}-${tag}`} style={styles.tagPill}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.notesText}>{wine.notes || "Ingen anteckning ännu."}</Text>

              <View style={styles.actionRow}>
                <Pressable onPress={() => decrementWine(wine)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Drack 1 flaska</Text>
                </Pressable>
                <Pressable onPress={() => deleteWine(wine.id, wine.image_path)}>
                  <Text style={styles.dangerText}>Ta bort</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LabeledInput({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#8f8178"
        style={[styles.input, multiline && styles.textarea]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

function DoubleRow({ children }: { children: ReactNode }) {
  return <View style={styles.doubleRow}>{children}</View>;
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

function LoadingInline() {
  return (
    <View style={styles.loadingInline}>
      <ActivityIndicator color="#6f1d1b" />
      <Text style={styles.notesText}>Laddar viner...</Text>
    </View>
  );
}

async function hydrateWineRecords(rows: WineRow[]): Promise<WineRecord[]> {
  const paths = rows.map((row) => row.image_path).filter((value): value is string => Boolean(value));
  const signedUrlMap = new Map<string, string>();

  if (paths.length > 0) {
    const { data } = await supabase.storage.from("wine-images").createSignedUrls(paths, 60 * 60);

    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    image_url: row.image_path ? signedUrlMap.get(row.image_path) ?? null : null,
  }));
}

async function uploadWineImage(userId: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from("wine-images").upload(filePath, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

function buildStats(wines: WineRecord[]) {
  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const drinkSoon = wines
    .filter((wine) => wine.drink_by_year && wine.drink_by_year <= new Date().getFullYear() + 1)
    .reduce((sum, wine) => sum + wine.quantity, 0);

  const byCountry = new Map<string, number>();
  const byType = new Map<string, number>();
  const vintages = wines.map((wine) => wine.vintage).filter((value): value is number => Boolean(value));

  for (const wine of wines) {
    if (wine.country) {
      byCountry.set(wine.country, (byCountry.get(wine.country) || 0) + wine.quantity);
    }

    byType.set(wine.type, (byType.get(wine.type) || 0) + wine.quantity);
  }

  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];
  const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalBottles,
    totalLabels: wines.length,
    drinkSoon,
    topCountry: topCountry ? `${topCountry[0]} (${topCountry[1]})` : "Ingen data",
    topType: topType ? `${topType[0]} (${topType[1]})` : "Ingen data",
    averageVintage:
      vintages.length > 0
        ? String(Math.round(vintages.reduce((sum, value) => sum + value, 0) / vintages.length))
        : "-",
  };
}

function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#2b1714",
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b1714",
    gap: 12,
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  heroPanel: {
    backgroundColor: "#5c1d1b",
    borderRadius: 28,
    padding: 22,
    gap: 12,
  },
  eyebrow: {
    color: "#f4c38c",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff6ee",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
  },
  heroText: {
    color: "#ead8ca",
    fontSize: 15,
    lineHeight: 23,
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#fff6ee",
  },
  infoBox: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  infoLabel: {
    color: "#f4c38c",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#fff6ee",
    fontSize: 14,
  },
  loadingText: {
    color: "#fff6ee",
    fontSize: 16,
  },
  panel: {
    backgroundColor: "#f8f1e8",
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#6f1d1b",
  },
  segmentText: {
    color: "#6f6259",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#fffaf5",
  },
  inputGroup: {
    gap: 6,
    flex: 1,
  },
  inputLabel: {
    color: "#6f6259",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fffaf5",
    color: "#231815",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#6f1d1b",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
  },
  linkText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: "#fffaf5",
    fontSize: 22,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#ead8ca",
    fontSize: 12,
  },
  insightCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 6,
  },
  insightValue: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  wineCard: {
    borderTopWidth: 1,
    borderTopColor: "#ead8ca",
    paddingTop: 16,
    gap: 12,
  },
  wineImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 20,
    backgroundColor: "#ead8ca",
  },
  wineCardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  wineType: {
    color: "#6f1d1b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  wineName: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  wineMeta: {
    color: "#6f6259",
    marginTop: 4,
  },
  quantityBadge: {
    backgroundColor: "#ead8ca",
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quantityBadgeText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagPill: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  notesText: {
    color: "#6f6259",
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dangerText: {
    color: "#9c3d31",
    fontWeight: "700",
  },
  emptyState: {
    color: "#6f6259",
    lineHeight: 21,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
