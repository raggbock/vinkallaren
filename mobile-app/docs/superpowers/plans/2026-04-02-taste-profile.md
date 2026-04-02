# Personal Taste Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show accumulated tasting insights on the profile page — stats, WSET taste preferences, top regions/grapes, and session history with tap-to-view results.

**Architecture:** Fetch all user's tastings + wines + sessions in one helper, run pure aggregation, display in a TasteProfile component embedded in the existing ProfilePage. No new DB tables — all derived from existing data.

**Tech Stack:** React Native / Expo, TypeScript, Supabase client queries

**Spec:** `docs/superpowers/specs/2026-04-02-tasting-experience-design.md` — Subsystem 6

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/taste-profile.ts` | Fetch user's tasting data + pure aggregation helper |
| Create | `src/components/taste-profile.tsx` | Taste profile UI — stats, preference bars, top regions, history |
| Modify | `src/components/profile-page.tsx:66-69` | Replace placeholder with TasteProfile component |

---

### Task 1: Taste Profile Data Fetching and Aggregation

**Files:**
- Create: `src/lib/taste-profile.ts`

- [ ] **Step 1: Create the taste profile helper**

```typescript
import { supabase } from "./supabase";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WsetTastingData } from "./wset-data";

export type TasteProfileData = {
  ready: boolean; // false if < 2 completed sessions
  stats: {
    totalSessions: number;
    totalWines: number;
    lastSessionDate: string | null;
    mostCommonFormat: "quick" | "wset" | null;
  };
  preferences: PreferenceBar[]; // WSET only, wines rated ≥ good
  topRegions: { name: string; count: number }[];
  topGrapes: { name: string; count: number }[];
  history: SessionSummary[];
};

export type PreferenceBar = {
  label: string;
  values: { name: string; pct: number }[];
};

export type SessionSummary = {
  id: string;
  title: string;
  date: string;
  format: "quick" | "wset";
  wineCount: number;
  status: string;
};

const QUALITY_GOOD_OR_BETTER = ["good", "very good", "outstanding"];

export async function fetchTasteProfile(userId: string): Promise<TasteProfileData> {
  // 1. Fetch all user's tastings
  const { data: tastings } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("user_id", userId);
  if (!tastings || tastings.length === 0) return emptyProfile();

  // 2. Get unique session IDs
  const sessionIds = [...new Set((tastings as SessionTastingRow[]).map((t) => t.session_id))];

  // 3. Fetch sessions and wines in parallel
  const [sessionsRes, winesRes] = await Promise.all([
    supabase.from("tasting_sessions").select("*").in("id", sessionIds).order("created_at", { ascending: false }),
    supabase.from("session_wines").select("*").in("session_id", sessionIds),
  ]);

  const sessions = (sessionsRes.data ?? []) as TastingSessionRow[];
  const wines = (winesRes.data ?? []) as SessionWineRow[];
  const endedSessions = sessions.filter((s) => s.status === "ended");

  return buildTasteProfile(tastings as SessionTastingRow[], wines, sessions, endedSessions);
}

export function buildTasteProfile(
  tastings: SessionTastingRow[],
  wines: SessionWineRow[],
  allSessions: TastingSessionRow[],
  endedSessions: TastingSessionRow[],
): TasteProfileData {
  if (endedSessions.length < 2) return emptyProfile();

  // Stats
  const formats = endedSessions.map((s) => s.format);
  const quickCount = formats.filter((f) => f === "quick").length;
  const wsetCount = formats.filter((f) => f === "wset").length;

  const stats = {
    totalSessions: endedSessions.length,
    totalWines: tastings.length,
    lastSessionDate: endedSessions[0]?.created_at ?? null,
    mostCommonFormat: (quickCount >= wsetCount ? "quick" : "wset") as "quick" | "wset",
  };

  // WSET preferences — only from wines rated ≥ good
  const preferences = buildPreferences(tastings);

  // Top regions & grapes (from all tasted wines, only shown if 5+ have data)
  const tastedWineIds = new Set(tastings.map((t) => t.session_wine_id));
  const tastedWines = wines.filter((w) => tastedWineIds.has(w.id));
  const regionItems = tastedWines.map((w) => w.region).filter((r): r is string => r != null);
  const grapeItems = tastedWines.map((w) => w.grape).filter((g): g is string => g != null);
  const topRegions = regionItems.length >= 5 ? topN(regionItems, 3) : [];
  const topGrapes = grapeItems.length >= 5 ? topN(grapeItems, 3) : [];

  // History
  const wineCountMap = new Map<string, number>();
  for (const w of wines) wineCountMap.set(w.session_id, (wineCountMap.get(w.session_id) ?? 0) + 1);

  const history: SessionSummary[] = allSessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.created_at,
    format: s.format,
    wineCount: wineCountMap.get(s.id) ?? 0,
    status: s.status,
  }));

  return { ready: true, stats, preferences, topRegions, topGrapes, history };
}

function buildPreferences(tastings: SessionTastingRow[]): PreferenceBar[] {
  const goodTastings = tastings.filter((t) => {
    const data = t.tasting_data as WsetTastingData | null;
    return data?.conclusions?.quality && QUALITY_GOOD_OR_BETTER.includes(data.conclusions.quality);
  });
  if (goodTastings.length < 3) return [];

  const params: { key: string; label: string; path: (d: WsetTastingData) => string | null }[] = [
    { key: "acidity", label: "Syra", path: (d) => d.palate?.acidity ?? null },
    { key: "body", label: "Kropp", path: (d) => d.palate?.body ?? null },
    { key: "sweetness", label: "Sötma", path: (d) => d.palate?.sweetness ?? null },
    { key: "tannin", label: "Tannin", path: (d) => d.palate?.tannin ?? null },
    { key: "alcohol", label: "Alkohol", path: (d) => d.palate?.alcohol ?? null },
  ];

  return params.map(({ label, path }) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const t of goodTastings) {
      const val = path(t.tasting_data as WsetTastingData);
      if (val) { counts[val] = (counts[val] || 0) + 1; total++; }
    }
    const values = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, pct: total > 0 ? count / total : 0 }));
    return { label, values };
  }).filter((p) => p.values.length > 0);
}

function topN(items: string[], n: number): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function emptyProfile(): TasteProfileData {
  return {
    ready: false,
    stats: { totalSessions: 0, totalWines: 0, lastSessionDate: null, mostCommonFormat: null },
    preferences: [],
    topRegions: [],
    topGrapes: [],
    history: [],
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/taste-profile.ts
git commit -m "feat: add taste profile data fetching and aggregation helper"
```

---

### Task 2: Taste Profile Component

**Files:**
- Create: `src/components/taste-profile.tsx`

- [ ] **Step 1: Create the TasteProfile component**

```typescript
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fetchTasteProfile, type TasteProfileData, type SessionSummary } from "../lib/taste-profile";

type Props = {
  userId: string;
  onOpenSession: (sessionId: string) => void;
};

export function TasteProfile({ userId, onOpenSession }: Props) {
  const [data, setData] = useState<TasteProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTasteProfile(userId).then((d) => { setData(d); setLoading(false); });
  }, [userId]);

  if (loading) return <Text style={s.hint}>Laddar smakprofil...</Text>;
  if (!data || !data.ready) {
    return <Text style={s.hint}>Drick mer vin! Din smakprofil byggs upp efter 2 provningar.</Text>;
  }

  return (
    <View style={s.container}>
      {/* Stats row */}
      <View style={s.statsRow}>
        <StatBox label="Provningar" value={String(data.stats.totalSessions)} />
        <StatBox label="Viner" value={String(data.stats.totalWines)} />
        <StatBox label="Format" value={data.stats.mostCommonFormat === "wset" ? "WSET" : "Snabb"} />
      </View>

      {data.stats.lastSessionDate ? (
        <Text style={s.lastSession}>
          Senaste provning: {new Date(data.stats.lastSessionDate).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}
        </Text>
      ) : null}

      {/* WSET Preferences */}
      {data.preferences.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dina smakpreferenser</Text>
          <Text style={s.sectionSub}>Baserat på viner du bedömt som bra eller bättre</Text>
          {data.preferences.map((pref) => (
            <View key={pref.label} style={s.prefRow}>
              <Text style={s.prefLabel}>{pref.label}</Text>
              <View style={s.barContainer}>
                {pref.values.map((v) => (
                  <View key={v.name} style={[s.barSegment, { flex: v.pct }]}>
                    <Text style={s.barText}>{v.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Top regions & grapes */}
      {data.topRegions.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Topp regioner</Text>
          <View style={s.tagRow}>
            {data.topRegions.map((r) => (
              <View key={r.name} style={s.tag}>
                <Text style={s.tagText}>{r.name} ({r.count})</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {data.topGrapes.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Topp druvor</Text>
          <View style={s.tagRow}>
            {data.topGrapes.map((g) => (
              <View key={g.name} style={s.tag}>
                <Text style={s.tagText}>{g.name} ({g.count})</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Session history */}
      {data.history.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Provningshistorik</Text>
          {data.history.map((ses) => (
            <SessionHistoryCard key={ses.id} session={ses} onPress={() => onOpenSession(ses.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SessionHistoryCard({ session, onPress }: { session: SessionSummary; onPress: () => void }) {
  const dateStr = new Date(session.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  return (
    <Pressable onPress={onPress} style={s.historyCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.historyTitle}>{session.title}</Text>
        <Text style={s.historyMeta}>
          {dateStr} · {session.wineCount} viner · {session.format.toUpperCase()}
        </Text>
      </View>
      <Text style={s.historyArrow}>→</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  hint: { color: "#8f8178", fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, backgroundColor: "#ead8ca", borderRadius: 14, padding: 12, alignItems: "center" },
  statValue: { color: "#6f1d1b", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#564a40", fontSize: 11, marginTop: 2 },
  lastSession: { color: "#564a40", fontSize: 12 },
  section: { gap: 8 },
  sectionTitle: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionSub: { color: "#8f8178", fontSize: 11 },
  prefRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefLabel: { color: "#564a40", fontSize: 12, fontWeight: "700", width: 70 },
  barContainer: { flex: 1, flexDirection: "row", gap: 2, height: 26, borderRadius: 6, overflow: "hidden" },
  barSegment: { backgroundColor: "#ead8ca", justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  barText: { color: "#6f1d1b", fontSize: 10, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#ead8ca", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: "#6f1d1b", fontSize: 12, fontWeight: "600" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fffaf5", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#ead8ca" },
  historyTitle: { color: "#231815", fontSize: 14, fontWeight: "600" },
  historyMeta: { color: "#564a40", fontSize: 12 },
  historyArrow: { color: "#6f1d1b", fontSize: 16, fontWeight: "700" },
});
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/taste-profile.tsx
git commit -m "feat: add taste profile component with stats, preferences, and history"
```

---

### Task 3: Wire Taste Profile into Profile Page

**Files:**
- Modify: `src/components/profile-page.tsx:1-78`

- [ ] **Step 1: Add TasteProfile import**

Add at top of profile-page.tsx:
```typescript
import { TasteProfile } from "./taste-profile";
```

- [ ] **Step 2: Add onOpenSession prop to ProfilePage**

Update the `ProfilePageProps` type from:
```typescript
type ProfilePageProps = {
  profile: ProfileRow;
  onUpdateName: (name: string) => Promise<boolean>;
  onSignOut: () => void;
  onBack: () => void;
};
```
To:
```typescript
type ProfilePageProps = {
  profile: ProfileRow;
  onUpdateName: (name: string) => Promise<boolean>;
  onSignOut: () => void;
  onBack: () => void;
  onOpenSession?: (sessionId: string) => void;
};
```

Update the function signature from:
```typescript
export function ProfilePage({ profile, onUpdateName, onSignOut, onBack }: ProfilePageProps) {
```
To:
```typescript
export function ProfilePage({ profile, onUpdateName, onSignOut, onBack, onOpenSession }: ProfilePageProps) {
```

- [ ] **Step 3: Replace the placeholder section with TasteProfile**

Replace:
```typescript
      <View style={s.section}>
        <Text style={s.sectionTitle}>Statistik</Text>
        <Text style={s.placeholder}>Smakprofil och provningshistorik kommer i framtida uppdateringar.</Text>
      </View>
```
With:
```typescript
      <View style={s.section}>
        <Text style={s.sectionTitle}>Smakprofil</Text>
        <TasteProfile userId={profile.id} onOpenSession={onOpenSession ?? (() => {})} />
      </View>
```

- [ ] **Step 4: Remove unused `placeholder` style**

In the StyleSheet, remove:
```typescript
  placeholder: {
    color: "#8f8178",
    fontSize: 13,
    lineHeight: 20,
  },
```

- [ ] **Step 5: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/components/profile-page.tsx
git commit -m "feat: wire taste profile into profile page, replacing placeholder"
```
