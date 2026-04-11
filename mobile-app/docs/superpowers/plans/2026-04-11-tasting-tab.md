# Tasting Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Mat" bottom tab with a "Provning" tab that gives tasting sessions first-class navigation.

**Architecture:** Update `CELLAR_SECTIONS` type/constant, create a `TastingTab` component that renders session lists (active + ended) and quick actions. Move `MealPlannerPanel` into `CellarTab` as an expandable section. Reuse all existing tasting hooks and sub-views unchanged.

**Tech Stack:** React Native, TypeScript, existing `useTastingSessions` hook

---

### Task 1: Update navigation types and constants

**Files:**
- Modify: `src/types/cellar.ts`
- Modify: `src/components/cellar-sections.tsx:34-38` (TAB_ICON_COMPONENTS map)
- Modify: `src/components/doodles.tsx` (add TabIconTasting, rename/keep TabIconFood)

- [ ] **Step 1: Update CellarSection type and CELLAR_SECTIONS**

In `src/types/cellar.ts`, replace `"meal"` with `"tasting"`:

```typescript
export type CellarSection = "cellar" | "add" | "tasting" | "history";

export const CELLAR_SECTIONS: Array<{ key: CellarSection; label: string }> = [
  { key: "cellar", label: "Min källare" },
  { key: "add", label: "Lägg till" },
  { key: "tasting", label: "Provning" },
  { key: "history", label: "Historik" },
];
```

- [ ] **Step 2: Add TabIconTasting doodle**

In `src/components/doodles.tsx`, add a wine glass icon for the tasting tab. Reuse the existing `WineGlassDoodle` SVG pattern but as a tab icon:

```typescript
export function TabIconTasting({ size = 24, color = "#C83C2D" }: { size?: number; color?: string }) {
  if (Platform.OS !== "web") return <View style={{ width: size, height: size }} />;
  return (
    <WebSvg
      size={size}
      svg={`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
        <path d="M8 2 L16 2 L14.5 9 Q12 13, 12 13 Q12 13, 9.5 9 Z" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 13 L12 19" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M9 19 L15 19" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>
      </svg>`}
    />
  );
}
```

- [ ] **Step 3: Update TAB_ICON_COMPONENTS in cellar-sections.tsx**

In `src/components/cellar-sections.tsx`, import `TabIconTasting` and update the map:

```typescript
import { WineGlassDoodle, SquigglyLine, TabIconCellar, TabIconAdd, TabIconTasting, TabIconHistory } from "./doodles";

// In BottomTabBar:
const TAB_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  cellar: TabIconCellar,
  add: TabIconAdd,
  tasting: TabIconTasting,
  history: TabIconHistory,
};
```

Remove `TabIconFood` from the import since it's no longer used in the tab bar.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Errors in `App.tsx` referencing `"meal"` section — expected, will fix in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/types/cellar.ts src/components/cellar-sections.tsx src/components/doodles.tsx
git commit -m "refactor: replace meal tab type with tasting in navigation"
```

---

### Task 2: Create TastingTab component

**Files:**
- Create: `src/components/tasting-tab.tsx`

- [ ] **Step 1: Create TastingTab**

```typescript
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { PanelHeader } from "./form-controls";
import type { CreateSessionInput, TastingSessionRow } from "../types/tasting-session";
import { CreateForm, JoinForm } from "./session-forms";
import { colors, styles } from "../styles/theme";
import { formatDateFull } from "../lib/format-date";

type Props = {
  sessions: TastingSessionRow[];
  loading: boolean;
  onCreateSession: (input: CreateSessionInput) => Promise<TastingSessionRow | null>;
  onJoinSession: (code: string) => Promise<TastingSessionRow | null>;
  onOpenSession: (session: TastingSessionRow) => void;
  onOpenProfile: () => void;
  onFetchSessions: () => void;
};

function statusLabel(status: TastingSessionRow["status"]): string {
  const labels: Record<string, string> = { setup: "Förbereder", active: "Pågår", revealing: "Avslöjas", ended: "Avslutad" };
  return labels[status] ?? status;
}

function statusColor(status: TastingSessionRow["status"]): string {
  return status === "active" ? colors.accent : status === "setup" ? colors.textSecondary : colors.text;
}

export function TastingTab({ sessions, loading, onCreateSession, onJoinSession, onOpenSession, onOpenProfile, onFetchSessions }: Props) {
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [error, setError] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.status === "setup" || s.status === "active");
  const endedSessions = sessions.filter((s) => s.status === "ended" || s.status === "revealing");

  if (view === "create") {
    return (
      <View style={styles.panel}>
        <PanelHeader title="Ny provning" rightLabel="Avbryt" onRightPress={() => setView("list")} />
        <CreateForm onCreate={async (input) => {
          const result = await onCreateSession(input);
          if (!result) { setError("Kunde inte skapa provning"); return; }
          setView("list");
        }} onCancel={() => setView("list")} />
      </View>
    );
  }

  if (view === "join") {
    return (
      <View style={styles.panel}>
        <PanelHeader title="Gå med i provning" rightLabel="Avbryt" onRightPress={() => setView("list")} />
        <JoinForm onJoin={async (code) => {
          const result = await onJoinSession(code);
          if (!result) { setError("Kunde inte gå med — kontrollera koden"); return; }
          setView("list");
        }} onCancel={() => setView("list")} />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <PanelHeader title="Provningar" rightLabel="Profil" onRightPress={onOpenProfile} />
      {error ? <Text style={local.error}>{error}</Text> : null}

      <View style={local.actionRow}>
        <Pressable onPress={() => { setError(null); setView("create"); }} style={[styles.primaryButton, { flex: 2 }]}>
          <Text style={styles.primaryButtonText}>Ny provning</Text>
        </Pressable>
        <Pressable onPress={() => { setError(null); setView("join"); }} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Gå med (kod)</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} /> : null}

      {activeSessions.length > 0 ? (
        <>
          <Text style={local.sectionLabel}>Pågående</Text>
          {activeSessions.map((ses) => (
            <Pressable key={ses.id} style={local.card} onPress={() => onOpenSession(ses)}>
              <View style={local.cardHeader}>
                <Text style={local.cardTitle}>{ses.title}</Text>
                <Text style={[local.statusBadge, { color: statusColor(ses.status) }]}>{statusLabel(ses.status)}</Text>
              </View>
              <Text style={local.cardMeta}>{ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={local.sectionLabel}>Avslutade</Text>
      {endedSessions.length === 0 && !loading ? (
        <Text style={local.empty}>Inga avslutade provningar ännu.</Text>
      ) : null}
      {endedSessions.map((ses) => (
        <Pressable key={ses.id} style={local.card} onPress={() => onOpenSession(ses)}>
          <View style={local.cardHeader}>
            <Text style={local.cardTitle}>{ses.title}</Text>
            <Text style={local.cardDate}>{formatDateFull(ses.created_at)}</Text>
          </View>
          <Text style={local.cardMeta}>{ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: colors.textLight, borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.surfaceAlt, marginBottom: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
  cardDate: { color: colors.textSecondary, fontSize: 12 },
  statusBadge: { fontSize: 12, fontWeight: "600" },
  empty: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic" },
  error: { color: colors.accent, fontSize: 13, marginBottom: 8 },
});
```

- [ ] **Step 2: Run TypeScript check on the new file**

Run: `npx tsc --noEmit`
Expected: May still fail on App.tsx (meal references) — the new file should compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasting-tab.tsx
git commit -m "feat: add TastingTab component for provning tab"
```

---

### Task 3: Wire TastingTab into App.tsx, remove MealTab

**Files:**
- Modify: `App.tsx:23,282,294-312,322-328`

- [ ] **Step 1: Replace MealTab import with TastingTab**

In `App.tsx`, change:
```typescript
import { MealTab } from "./src/components/meal-tab";
```
to:
```typescript
import { TastingTab } from "./src/components/tasting-tab";
```

- [ ] **Step 2: Remove tastingSessionsVisible state and onOpenTastingSessions**

Delete the `tastingSessionsVisible` useState (line 232). This state is no longer needed — tasting sessions live in their own tab now.

- [ ] **Step 3: Remove onOpenTastingSessions from CellarTab props**

In the `CellarTab` rendering, remove:
```typescript
onOpenTastingSessions={() => { setTastingSessionsVisible(true); tastingSessions.fetchSessions(); }}
```

- [ ] **Step 4: Remove the tastingSessionsVisible overlay block**

Delete the entire `if (activeSection === "cellar" && tastingSessionsVisible)` block (lines 294-312) that renders `TastingSessionPanel` as an overlay on the cellar tab.

- [ ] **Step 5: Replace MealTab with TastingTab in the activeSection switch**

Change:
```typescript
} else if (activeSection === "meal") {
    activePanel = (
      <MealTab hidden={false}
        onWinePress={(id) => { setHighlightedWineId(id); setActiveSection("cellar"); }}
        onOpenProfile={() => setProfileVisible(true)}
      />
    );
```
to:
```typescript
} else if (activeSection === "tasting") {
    activePanel = (
      <TastingTab
        sessions={tastingSessions.sessions}
        loading={tastingSessions.loading}
        onCreateSession={tastingSessions.createSession}
        onJoinSession={tastingSessions.joinSession}
        onOpenSession={tastingSessions.openSession}
        onOpenProfile={() => setProfileVisible(true)}
        onFetchSessions={tastingSessions.fetchSessions}
      />
    );
```

- [ ] **Step 6: Update auto-join from URL**

The `pendingJoinCode` effect currently does `setTastingSessionsVisible(true)`. Change it to navigate to the tasting tab instead:

```typescript
useEffect(() => {
  if (!pendingJoinCode) return;
  onJoinCodeConsumed();
  setActiveSection("tasting");
  tastingSessions.joinSession(pendingJoinCode);
}, [pendingJoinCode]);
```

- [ ] **Step 7: Update onSessionEnded callback**

In the `TastingSessionPanel` Suspense block that's now in the tasting tab flow, `onSessionEnded` currently sets `setTastingSessionsVisible(false)` and navigates to history. Since the tasting panel is now a session detail view opened from the tab, this should navigate back to history:

Find `onSessionEnded` usage — it's passed to `TastingSessionPanel`. After removing the overlay block in step 4, the `TastingSessionPanel` is only mounted when a session is active/open. We need to handle the session detail view. This is done by checking if `tastingSessions.activeSession` is set — if so, render `TastingSessionPanel` inside the tasting tab instead of the list.

Update the tasting section in the switch:

```typescript
} else if (activeSection === "tasting") {
    if (tastingSessions.activeSession) {
      activePanel = (
        <Suspense fallback={<ActivityIndicator style={{ flex: 1, justifyContent: "center" }} color={colors.accent} />}>
          <TastingSessionPanel
            styles={styles} userId={session.user.id}
            sessions={tastingSessions.sessions} loading={tastingSessions.loading} toasts={tastingSessions.toasts}
            activeSession={tastingSessions.activeSession} activeWines={tastingSessions.activeWines}
            activeTastings={tastingSessions.activeTastings} wines={wineData.wines}
            searchWineNames={catalogData.searchCatalogWineNames}
            onBack={() => { tastingSessions.closeSession(); }}
            onFetchSessions={tastingSessions.fetchSessions} onCreateSession={tastingSessions.createSession}
            onJoinSession={tastingSessions.joinSession} onOpenSession={tastingSessions.openSession}
            onCloseSession={tastingSessions.closeSession} onSetActiveWines={tastingSessions.setActiveWines}
            onSetActiveTastings={tastingSessions.setActiveTastings} onSetActiveSession={tastingSessions.setActiveSession}
            onOpenWset={sessionWset.open} wsetData={sessionWset.data}
            onSessionEnded={() => { tastingSessions.closeSession(); setActiveSection("history"); }}
          />
        </Suspense>
      );
    } else {
      activePanel = (
        <TastingTab
          sessions={tastingSessions.sessions}
          loading={tastingSessions.loading}
          onCreateSession={tastingSessions.createSession}
          onJoinSession={tastingSessions.joinSession}
          onOpenSession={tastingSessions.openSession}
          onOpenProfile={() => setProfileVisible(true)}
          onFetchSessions={tastingSessions.fetchSessions}
        />
      );
    }
```

- [ ] **Step 8: Fix the scroll condition**

The scroll/no-scroll conditional currently checks `activeSection === "cellar" && !tastingSessionsVisible`. Since `tastingSessionsVisible` is removed, simplify to just check sections that manage their own scrolling:

```typescript
{activeSection === "history" || activeSection === "cellar" ? (
```

- [ ] **Step 9: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS — no more references to `"meal"` section type.

- [ ] **Step 10: Commit**

```bash
git add App.tsx
git commit -m "feat: wire tasting tab into navigation, remove meal overlay"
```

---

### Task 4: Move MealPlannerPanel into CellarTab

**Files:**
- Modify: `src/components/cellar-tab.tsx`
- Modify: `src/components/min-kallare-panel.tsx` (remove onOpenTastingSessions prop)

- [ ] **Step 1: Remove onOpenTastingSessions from CellarTab Props**

In `src/components/cellar-tab.tsx`, remove `onOpenTastingSessions` from the Props type and from the `<MinKallarePanel>` usage.

- [ ] **Step 2: Add MealPlannerPanel to CellarTab**

Import and render `MealPlannerPanel` at the bottom of `CellarTab`, after `MinKallarePanel`:

```typescript
import { MealPlannerPanel } from "./cellar-sections";
import { buildMealRecommendations } from "../lib/cellar-helpers";
import { useState, useMemo } from "react"; // add useState to existing import

// Inside CellarTab function, before return:
const [selectedMeal, setSelectedMeal] = useState("");
const mealRecommendations = useMemo(
  () => selectedMeal ? buildMealRecommendations(ctx.wines, selectedMeal) : [],
  [selectedMeal, ctx.wines],
);

// In the return, wrap MinKallarePanel and MealPlannerPanel in a fragment:
return (
  <>
    <MinKallarePanel
      {/* ...existing props, remove onOpenTastingSessions... */}
    />
    <MealPlannerPanel
      styles={styles}
      wines={ctx.wines}
      selectedMeal={selectedMeal}
      mealRecommendations={mealRecommendations}
      onSelectMeal={setSelectedMeal}
      onWinePress={(wine) => props.onHighlightWine?.(wine.id)}
    />
  </>
);
```

- [ ] **Step 3: Remove onOpenTastingSessions from MinKallarePanel**

In `src/components/min-kallare-panel.tsx`, find and remove the `onOpenTastingSessions` prop from the type definition and the button that triggers it (likely a "Provningar" button in the panel header or body).

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/cellar-tab.tsx src/components/min-kallare-panel.tsx
git commit -m "refactor: move meal planner into cellar tab, remove tasting button"
```

---

### Task 5: Delete meal-tab.tsx and clean up unused imports

**Files:**
- Delete: `src/components/meal-tab.tsx`
- Modify: `App.tsx` (remove MealTab import if not already done)
- Modify: `src/components/cellar-sections.tsx` (remove TabIconFood import if unused)

- [ ] **Step 1: Delete meal-tab.tsx**

```bash
git rm src/components/meal-tab.tsx
```

- [ ] **Step 2: Check for remaining references to MealTab or TabIconFood**

Run: `grep -r "MealTab\|TabIconFood\|meal-tab" src/ App.tsx`
Expected: No results. If any remain, remove them.

- [ ] **Step 3: Remove TabIconFood from doodles.tsx if unused**

Check if `TabIconFood` is imported anywhere. If not, delete the function from `src/components/doodles.tsx`.

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete meal-tab.tsx and clean up unused tab icon"
```

---

### Task 6: Fetch sessions on tab mount

**Files:**
- Modify: `src/components/tasting-tab.tsx`

- [ ] **Step 1: Add useEffect to fetch sessions on mount**

The tasting tab should fetch sessions when it mounts (user navigates to the tab):

```typescript
import { useEffect, useState } from "react";

// Inside TastingTab, at the top of the function:
useEffect(() => { onFetchSessions(); }, []);
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/tasting-tab.tsx
git commit -m "fix: fetch tasting sessions on tab mount"
```

---

### Task 7: Visual verification and final cleanup

**Files:**
- No new files

- [ ] **Step 1: Build and run**

Run: `npm run web:build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify in browser**

Navigate to the deployed site or local dev server:
- Bottom tab bar shows: Min källare | Lägg till | Provning | Historik
- Tapping "Provning" shows the session list with "Ny provning" and "Gå med (kod)" buttons
- Creating a session works and opens the session detail view
- Tapping "Tillbaka" returns to the session list
- Ended sessions show in the lower section
- MealPlannerPanel is visible at the bottom of the Källare tab

- [ ] **Step 3: Push**

```bash
git push
```
