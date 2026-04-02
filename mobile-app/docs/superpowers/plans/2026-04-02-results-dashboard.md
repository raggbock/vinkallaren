# Results Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a rich results summary after a tasting session ends — wine rankings, participant comparisons, consensus indicators, and WSET parameter breakdowns.

**Architecture:** Pure aggregation helper builds result data from session_tastings. A `ResultsDashboard` component renders Quick or WSET format results. Shown automatically when session ends and accessible from history. No new database tables.

**Tech Stack:** React Native / Expo, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-02-tasting-experience-design.md` — Subsystem 5

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/session-results.ts` | Pure aggregation: buildSessionResults(), consensus calc, WSET parameter comparison |
| Create | `src/components/results-dashboard.tsx` | Results UI — header stats, wine list, expandable details |
| Modify | `src/components/tasting-session-modal.tsx` | Show ResultsDashboard for ended/revealed sessions |
| Modify | `src/components/cellar-sections.tsx` | Show ResultsDashboard when opening ended session from history |

---

### Task 1: Session Results Aggregation Helper

**Files:**
- Create: `src/lib/session-results.ts`

- [ ] **Step 1: Write the aggregation helper**

```typescript
import type { SessionTastingRow, SessionWineRow } from "../types/tasting-session";
import type { WsetTastingData } from "./wset-data";

export type WineResult = {
  wine: SessionWineRow;
  tastings: SessionTastingRow[];
  averageRating: number | null;
  ratingSpread: number; // standard deviation
  consensus: "high" | "low"; // σ < 0.8 = high consensus
  qualityCounts: Record<string, number>; // WSET quality level → count
  averageQuality: string | null; // most common quality ≥ "good"
};

export type SessionResults = {
  format: "quick" | "wset";
  wineCount: number;
  participantCount: number;
  date: string;
  wines: WineResult[];
  favorite: WineResult | null; // highest avg rating (quick) or most quality ≥ good (wset)
  mostDivided: WineResult | null; // highest spread
  participantIds: string[];
};

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const QUALITY_ORDER = ["poor", "acceptable", "good", "very good", "outstanding"];

function getWsetQuality(tasting: SessionTastingRow): string | null {
  const data = tasting.tasting_data as WsetTastingData | null;
  return data?.conclusions?.quality ?? null;
}

function buildWineResult(wine: SessionWineRow, tastings: SessionTastingRow[]): WineResult {
  const wineTastings = tastings.filter((t) => t.session_wine_id === wine.id);
  const ratings = wineTastings.map((t) => t.rating).filter((r): r is number => r != null);
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const spread = stddev(ratings);

  const qualityCounts: Record<string, number> = {};
  for (const t of wineTastings) {
    const q = getWsetQuality(t);
    if (q) qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  }

  const goodOrBetter = Object.entries(qualityCounts)
    .filter(([k]) => QUALITY_ORDER.indexOf(k) >= 2)
    .sort((a, b) => b[1] - a[1]);

  return {
    wine,
    tastings: wineTastings,
    averageRating: avg,
    ratingSpread: spread,
    consensus: spread < 0.8 ? "high" : "low",
    qualityCounts,
    averageQuality: goodOrBetter.length > 0 ? goodOrBetter[0][0] : null,
  };
}

export function buildSessionResults(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  format: "quick" | "wset",
  sessionDate: string,
): SessionResults {
  const participantIds = [...new Set(tastings.map((t) => t.user_id))];
  const wineResults = wines.map((w) => buildWineResult(w, tastings));

  // Sort: quick by avg rating desc, wset by quality level desc
  if (format === "quick") {
    wineResults.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  } else {
    wineResults.sort((a, b) => {
      const aIdx = QUALITY_ORDER.indexOf(a.averageQuality ?? "");
      const bIdx = QUALITY_ORDER.indexOf(b.averageQuality ?? "");
      return bIdx - aIdx;
    });
  }

  const favorite = format === "quick"
    ? wineResults.reduce<WineResult | null>((best, w) => (!best || (w.averageRating ?? 0) > (best.averageRating ?? 0)) ? w : best, null)
    : wineResults.find((w) => w.averageQuality != null) ?? null;

  const mostDivided = wineResults.reduce<WineResult | null>(
    (worst, w) => (!worst || w.ratingSpread > worst.ratingSpread) ? w : worst, null,
  );

  return {
    format,
    wineCount: wines.length,
    participantCount: participantIds.length,
    date: sessionDate,
    wines: wineResults,
    favorite,
    mostDivided: mostDivided && mostDivided.ratingSpread > 0 ? mostDivided : null,
    participantIds,
  };
}

/** Extract WSET parameter values from all tastings for a wine */
export function getWsetParameterComparison(tastings: SessionTastingRow[]): {
  param: string;
  label: string;
  counts: Record<string, number>;
}[] {
  const params: { key: string; label: string; path: (d: WsetTastingData) => string | null }[] = [
    { key: "sweetness", label: "Sötma", path: (d) => d.palate?.sweetness ?? null },
    { key: "acidity", label: "Syra", path: (d) => d.palate?.acidity ?? null },
    { key: "tannin", label: "Tannin", path: (d) => d.palate?.tannin ?? null },
    { key: "body", label: "Kropp", path: (d) => d.palate?.body ?? null },
    { key: "alcohol", label: "Alkohol", path: (d) => d.palate?.alcohol ?? null },
    { key: "finish", label: "Avslut", path: (d) => d.palate?.finish ?? null },
    { key: "noseIntensity", label: "Doftintensitet", path: (d) => d.nose?.intensity ?? null },
    { key: "flavourIntensity", label: "Smakintensitet", path: (d) => d.palate?.flavourIntensity ?? null },
  ];

  return params.map(({ key, label, path }) => {
    const counts: Record<string, number> = {};
    for (const t of tastings) {
      const data = t.tasting_data as WsetTastingData | null;
      if (!data) continue;
      const val = path(data);
      if (val) counts[val] = (counts[val] || 0) + 1;
    }
    return { param: key, label, counts };
  }).filter((p) => Object.keys(p.counts).length > 0);
}

/** Collect all aromas mentioned by 2+ participants for a wine */
export function getSharedAromas(tastings: SessionTastingRow[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tastings) {
    const data = t.tasting_data as WsetTastingData | null;
    if (!data) continue;
    const aromas = [...(data.nose?.aromas ?? []), ...(data.palate?.flavours ?? [])];
    const unique = new Set(aromas);
    for (const a of unique) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c >= 2).map(([a]) => a);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/lib/session-results.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/session-results.ts
git commit -m "feat: add session results aggregation with consensus and WSET comparison"
```

---

### Task 2: Results Dashboard Component

**Files:**
- Create: `src/components/results-dashboard.tsx`

- [ ] **Step 1: Write the ResultsDashboard component**

This is a larger component (~200 lines). It shows:
- Header: stats row, favorite wine, most divided wine
- Wine list sorted by rating/quality with consensus badges
- Expandable wine details (participants' ratings for Quick, parameter bars for WSET)

```typescript
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./avatar";
import { Expandable } from "./form-controls";
import type { SessionResults, WineResult } from "../lib/session-results";
import { getWsetParameterComparison, getSharedAromas } from "../lib/session-results";
import { buildWsetSummary } from "../lib/wset-data";
import type { WsetTastingData } from "../lib/wset-data";

type Props = {
  results: SessionResults;
  participants: Array<{ user_id: string; display_name: string | null; avatar_color: string | null }>;
  onBack: () => void;
};

export function ResultsDashboard({ results, participants, onBack }: Props) {
  const participantMap = new Map(participants.map((p) => [p.user_id, p]));

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>Tillbaka</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <StatBox label="Viner" value={String(results.wineCount)} />
        <StatBox label="Deltagare" value={String(results.participantCount)} />
        <StatBox label="Datum" value={new Date(results.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })} />
      </View>

      {/* Highlights */}
      {results.favorite ? (
        <HighlightCard
          title="Gruppens favorit"
          wineName={results.favorite.wine.name}
          detail={results.format === "quick"
            ? `${results.favorite.averageRating?.toFixed(1)} snitt`
            : results.favorite.averageQuality ?? ""}
        />
      ) : null}
      {results.mostDivided ? (
        <HighlightCard
          title="Mest delade meningar"
          wineName={results.mostDivided.wine.name}
          detail={`Spridning: ${results.mostDivided.ratingSpread.toFixed(1)}`}
        />
      ) : null}

      {/* Wine list */}
      {results.wines.map((wr, i) => (
        <WineResultCard
          key={wr.wine.id}
          rank={i + 1}
          result={wr}
          format={results.format}
          participantMap={participantMap}
        />
      ))}
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

function HighlightCard({ title, wineName, detail }: { title: string; wineName: string; detail: string }) {
  return (
    <View style={s.highlight}>
      <Text style={s.highlightTitle}>{title}</Text>
      <Text style={s.highlightWine}>{wineName}</Text>
      <Text style={s.highlightDetail}>{detail}</Text>
    </View>
  );
}

function WineResultCard({ rank, result, format, participantMap }: {
  rank: number;
  result: WineResult;
  format: "quick" | "wset";
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.wineCard}>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.wineCardHeader}>
        <Text style={s.rank}>{rank}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.wineName}>{result.wine.name}</Text>
          <Text style={s.wineMeta}>
            {[result.wine.producer, result.wine.vintage].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {format === "quick" && result.averageRating != null ? (
          <Text style={s.ratingBig}>{result.averageRating.toFixed(1)}</Text>
        ) : null}
        {format === "wset" && result.averageQuality ? (
          <Text style={s.qualityBadge}>{result.averageQuality}</Text>
        ) : null}
        <View style={[s.consensusBadge, result.consensus === "high" ? s.consensusHigh : s.consensusLow]}>
          <Text style={[s.consensusText, result.consensus === "high" ? s.consensusTextHigh : s.consensusTextLow]}>
            {result.consensus === "high" ? "Eniga" : "Delade"}
          </Text>
        </View>
      </Pressable>
      <Expandable expanded={expanded}>
        {format === "quick" ? (
          <QuickDetails tastings={result.tastings} participantMap={participantMap} />
        ) : (
          <WsetDetails tastings={result.tastings} participantMap={participantMap} />
        )}
      </Expandable>
    </View>
  );
}

function QuickDetails({ tastings, participantMap }: {
  tastings: WineResult["tastings"];
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  return (
    <View style={s.details}>
      {tastings.filter((t) => t.rating != null).map((t) => {
        const p = participantMap.get(t.user_id);
        return (
          <View key={t.id} style={s.participantRow}>
            <Avatar displayName={p?.display_name ?? null} userId={t.user_id} avatarColor={p?.avatar_color} size={24} />
            <Text style={s.participantName}>{p?.display_name ?? "Anonym"}</Text>
            <Text style={s.participantRating}>{t.rating}/5</Text>
            {t.notes ? <Text style={s.participantNotes}>"{t.notes}"</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function WsetDetails({ tastings, participantMap }: {
  tastings: WineResult["tastings"];
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  const params = getWsetParameterComparison(tastings);
  const shared = getSharedAromas(tastings);

  return (
    <View style={s.details}>
      {/* Parameter bars */}
      {params.map((p) => (
        <View key={p.param} style={s.paramRow}>
          <Text style={s.paramLabel}>{p.label}</Text>
          <View style={s.paramCounts}>
            {Object.entries(p.counts).sort((a, b) => b[1] - a[1]).map(([val, count]) => (
              <Text key={val} style={s.paramValue}>{count} {val}</Text>
            ))}
          </View>
        </View>
      ))}

      {/* Shared aromas */}
      {shared.length > 0 ? (
        <View style={s.aromaSection}>
          <Text style={s.aromaTitle}>Gemensamma aromer</Text>
          <View style={s.aromaRow}>
            {shared.map((a) => (
              <View key={a} style={s.aromaTag}><Text style={s.aromaText}>{a}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Per-participant WSET summaries */}
      {tastings.filter((t) => t.tasting_data).map((t) => {
        const p = participantMap.get(t.user_id);
        const data = t.tasting_data as WsetTastingData;
        return (
          <View key={t.id} style={s.participantRow}>
            <Avatar displayName={p?.display_name ?? null} userId={t.user_id} avatarColor={p?.avatar_color} size={24} />
            <View style={{ flex: 1 }}>
              <Text style={s.participantName}>{p?.display_name ?? "Anonym"}</Text>
              <Text style={s.wsetSummary}>{buildWsetSummary(data)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: "row", justifyContent: "flex-end" },
  backBtn: {},
  backText: { color: "#6f1d1b", fontSize: 14, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, backgroundColor: "#ead8ca", borderRadius: 14, padding: 12, alignItems: "center" },
  statValue: { color: "#6f1d1b", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#564a40", fontSize: 11, marginTop: 2 },
  highlight: { backgroundColor: "#fffaf5", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#ead8ca" },
  highlightTitle: { color: "#564a40", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  highlightWine: { color: "#231815", fontSize: 16, fontWeight: "700", marginTop: 2 },
  highlightDetail: { color: "#6f1d1b", fontSize: 13, fontWeight: "600", marginTop: 2 },
  wineCard: { backgroundColor: "#fffaf5", borderRadius: 18, borderWidth: 1, borderColor: "#ead8ca", overflow: "hidden" },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  rank: { color: "#6f1d1b", fontSize: 18, fontWeight: "800", width: 28 },
  wineName: { color: "#231815", fontSize: 15, fontWeight: "600" },
  wineMeta: { color: "#564a40", fontSize: 12 },
  ratingBig: { color: "#6f1d1b", fontSize: 20, fontWeight: "800" },
  qualityBadge: { color: "#6f1d1b", fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  consensusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  consensusHigh: { backgroundColor: "rgba(120,180,100,0.15)" },
  consensusLow: { backgroundColor: "rgba(200,120,80,0.15)" },
  consensusText: { fontSize: 11, fontWeight: "700" },
  consensusTextHigh: { color: "#5a8a4a" },
  consensusTextLow: { color: "#c87850" },
  details: { gap: 10, padding: 14, paddingTop: 0 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  participantName: { color: "#231815", fontSize: 13, fontWeight: "600" },
  participantRating: { color: "#6f1d1b", fontSize: 14, fontWeight: "700" },
  participantNotes: { color: "#564a40", fontSize: 12, flex: 1 },
  paramRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paramLabel: { color: "#564a40", fontSize: 12, fontWeight: "700", width: 100 },
  paramCounts: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  paramValue: { color: "#231815", fontSize: 12, backgroundColor: "#ead8ca", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  aromaSection: { gap: 4 },
  aromaTitle: { color: "#564a40", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  aromaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  aromaTag: { backgroundColor: "#ead8ca", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  aromaText: { color: "#6f1d1b", fontSize: 11, fontWeight: "600" },
  wsetSummary: { color: "#564a40", fontSize: 12, lineHeight: 18, marginTop: 2 },
});
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/components/results-dashboard.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/results-dashboard.tsx
git commit -m "feat: add results dashboard with Quick and WSET format views"
```

---

### Task 3: Wire Results Dashboard into Session Flow

Show results automatically when viewing an ended/revealed session.

**Files:**
- Modify: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { ResultsDashboard } from "./results-dashboard";
import { buildSessionResults } from "../lib/session-results";
```

- [ ] **Step 2: Show ResultsDashboard for ended/revealed sessions**

In the `TastingSessionPanel`, in the active session view block (the `if (activeSession)` block), before the current rendering, add a check: if the session is ended or revealed, show the results dashboard instead of the active view.

After the `if (activeSession && tastingWine)` block (the tasting view), and before the `if (activeSession)` block, add:

```typescript
  // Results view for ended/revealed sessions
  if (activeSession && (activeSession.status === "ended" || activeSession.status === "revealed")) {
    const results = buildSessionResults(activeWines, activeTastings, activeSession.format, activeSession.created_at);
    return (
      <View style={styles.panel}>
        <ResultsDashboard
          results={results}
          participants={participants}
          onBack={() => { onCloseSession(); setView("list"); }}
        />
      </View>
    );
  }
```

- [ ] **Step 3: Verify and commit**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

```bash
git add src/components/tasting-session-modal.tsx
git commit -m "feat: show results dashboard for ended and revealed sessions"
```
