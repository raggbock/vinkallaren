# Reveal Ceremony — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dramatic, host-controlled wine-by-wine reveal ceremony for blind tasting sessions, replacing the instant reveal.

**Architecture:** New `revealing` status with `revealed_up_to` counter on tasting_sessions. RLS releases others' tastings per-wine as host advances. RevealView component shows one wine at a time with fade-in animations. After last wine, transitions to results dashboard.

**Tech Stack:** React Native / Expo, Supabase (Postgres + RLS + Realtime), React Native Animated API

**Spec:** `docs/superpowers/specs/2026-04-02-tasting-experience-design.md` — Subsystem 5

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260402200000_reveal_ceremony.sql` | Add revealed_up_to, update status constraint + RLS |
| Modify | `src/types/tasting-session.ts:9` | Update status type, add revealed_up_to field |
| Modify | `src/lib/session-actions.ts` | Update revealSession, add advanceReveal + finishReveal |
| Create | `src/components/reveal-view.tsx` | Reveal ceremony UI with animations |
| Modify | `src/components/tasting-session-modal.tsx` | Add revealing state, update HostControls |
| Modify | `src/hooks/useTastingSessions.ts:136` | Re-fetch tastings on any non-active status change |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402200000_reveal_ceremony.sql`

This migration must be applied via Supabase MCP tool — subagents cannot do this.

- [ ] **Step 1: Write and apply the migration**

```sql
-- Add revealed_up_to column
ALTER TABLE tasting_sessions ADD COLUMN revealed_up_to INTEGER NOT NULL DEFAULT 0;

-- Migrate any existing 'revealed' sessions to 'ended'
UPDATE tasting_sessions SET status = 'ended' WHERE status = 'revealed';

-- Replace status CHECK constraint: revealed → revealing
ALTER TABLE tasting_sessions DROP CONSTRAINT tasting_sessions_status_check;
ALTER TABLE tasting_sessions ADD CONSTRAINT tasting_sessions_status_check
  CHECK (status IN ('active', 'revealing', 'ended'));

-- Update RLS: during 'revealing', show others' tastings only for revealed wines
DROP POLICY session_tastings_select_others ON session_tastings;
CREATE POLICY session_tastings_select_others ON session_tastings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasting_sessions ts
    WHERE ts.id = session_tastings.session_id
    AND (
      ts.mode = 'open'
      OR ts.status = 'ended'
      OR ts.host_id = auth.uid()
      OR (ts.status = 'revealing' AND EXISTS (
        SELECT 1 FROM session_wines sw
        WHERE sw.id = session_tastings.session_wine_id
        AND sw.position <= ts.revealed_up_to
      ))
    )
  )
);
```

- [ ] **Step 2: Save migration file and commit**

```bash
git add supabase/migrations/20260402200000_reveal_ceremony.sql
git commit -m "feat: add reveal ceremony DB migration with revealed_up_to and RLS"
```

---

### Task 2: Types and Session Actions

**Files:**
- Modify: `src/types/tasting-session.ts:1-11`
- Modify: `src/lib/session-actions.ts`

- [ ] **Step 1: Update TastingSessionRow type**

In `src/types/tasting-session.ts`, change the `TastingSessionRow` type:

From:
```typescript
export type TastingSessionRow = {
  id: string;
  host_id: string;
  title: string;
  join_code: string;
  mode: "blind" | "open";
  format: "quick" | "wset";
  free_order: boolean;
  status: "active" | "revealed" | "ended";
  created_at: string;
};
```

To:
```typescript
export type TastingSessionRow = {
  id: string;
  host_id: string;
  title: string;
  join_code: string;
  mode: "blind" | "open";
  format: "quick" | "wset";
  free_order: boolean;
  status: "active" | "revealing" | "ended";
  revealed_up_to: number;
  created_at: string;
};
```

- [ ] **Step 2: Update revealSession and add advanceReveal + finishReveal**

In `src/lib/session-actions.ts`, change `revealSession`:

From:
```typescript
export async function revealSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealed" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}
```

To:
```typescript
export async function revealSession(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealing", revealed_up_to: 1 }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function advanceReveal(sessionId: string, nextPosition: number): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ revealed_up_to: nextPosition }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function finishReveal(sessionId: string): Promise<Result<true>> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) return fail(error.message);
  return ok(true);
}
```

- [ ] **Step 3: Update useTastingSessions.ts realtime handler**

In `src/hooks/useTastingSessions.ts`, change the session update handler (around line 132-138):

From:
```typescript
        (payload) => {
          const updated = payload.new as TastingSessionRow;
          setActiveSession(updated);
          setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          // Re-fetch tastings when revealed (RLS opens up, we now see others' data)
          if (updated.status === "revealed") {
            fetchSessionTastings(sessionId).then((r) => { if (r.data) setActiveTastings(r.data); });
          }
        }
```

To:
```typescript
        (payload) => {
          const updated = payload.new as TastingSessionRow;
          setActiveSession(updated);
          setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          // Re-fetch tastings when status changes or reveal advances (RLS opens up progressively)
          if (updated.status !== "active") {
            fetchSessionTastings(sessionId).then((r) => { if (r.data) setActiveTastings(r.data); });
          }
        }
```

- [ ] **Step 4: Update all references to "revealed" status in the codebase**

In `src/components/tasting-session-modal.tsx`:

Change the results dashboard check (line 96):
From: `if (activeSession && (activeSession.status === "ended" || activeSession.status === "revealed"))`
To: `if (activeSession && activeSession.status === "ended")`

Change the HostControls reveal button (line 188):
From: `onSetSession({ ...session, status: "revealed" })`
To: `onSetSession({ ...session, status: "revealing", revealed_up_to: 1 })`

Change the confirmation dialog text (line 188):
From: `"Avslöja viner?", "Alla deltagare kommer se varandras betyg och noteringar."`
To: `"Starta avslöjningen?", "Alla kommer se resultaten ett vin i taget."`

Change the session list status display (line 164):
From: `ses.status === "revealed" ? "Avslöjad"`
To: `ses.status === "revealing" ? "Avslöjas"`

- [ ] **Step 5: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add src/types/tasting-session.ts src/lib/session-actions.ts src/hooks/useTastingSessions.ts src/components/tasting-session-modal.tsx
git commit -m "feat: update types and actions for reveal ceremony (revealing status + advanceReveal)"
```

---

### Task 3: Reveal View Component

**Files:**
- Create: `src/components/reveal-view.tsx`

- [ ] **Step 1: Create the RevealView component**

```typescript
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./avatar";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";

type Participant = { user_id: string; display_name: string; avatar_color: string | null };

type Props = {
  session: TastingSessionRow;
  wines: SessionWineRow[];
  tastings: SessionTastingRow[];
  participants: Participant[];
  isHost: boolean;
  onAdvance: () => void;
  onFinish: () => void;
  onBack: () => void;
};

export function RevealView({ session, wines, tastings, participants, isHost, onAdvance, onFinish, onBack }: Props) {
  const currentWine = wines.find((w) => w.position === session.revealed_up_to) ?? null;
  const isLast = session.revealed_up_to >= wines.length;
  const wineTastings = currentWine ? tastings.filter((t) => t.session_wine_id === currentWine.id) : [];
  const participantMap = new Map(participants.map((p) => [p.user_id, p]));

  return (
    <View style={s.container}>
      {/* Progress indicator */}
      <View style={s.topRow}>
        <Pressable onPress={onBack}>
          <Text style={s.backText}>Tillbaka</Text>
        </Pressable>
        <Text style={s.progress}>{session.revealed_up_to} / {wines.length}</Text>
      </View>

      {currentWine ? (
        <RevealCard
          key={currentWine.id}
          wine={currentWine}
          tastings={wineTastings}
          participantMap={participantMap}
        />
      ) : null}

      {/* Host controls */}
      {isHost ? (
        <View style={s.controls}>
          {isLast ? (
            <Pressable onPress={onFinish} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Visa resultat</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onAdvance} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Nästa vin</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={s.waitText}>
          {isLast ? "Värden visar snart resultaten..." : "Väntar på att värden avslöjar nästa vin..."}
        </Text>
      )}

      {/* Previously revealed wines (collapsed) */}
      {wines.filter((w) => w.position < session.revealed_up_to).reverse().map((w) => {
        const wt = tastings.filter((t) => t.session_wine_id === w.id);
        const ratings = wt.map((t) => t.rating).filter((r): r is number => r != null);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
        return (
          <View key={w.id} style={s.prevWine}>
            <Text style={s.prevPosition}>{w.position}</Text>
            <Text style={s.prevName}>{w.name}</Text>
            {avg ? <Text style={s.prevRating}>{avg}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function RevealCard({ wine, tastings, participantMap }: {
  wine: SessionWineRow;
  tastings: SessionTastingRow[];
  participantMap: Map<string, Participant>;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [showRatings, setShowRatings] = useState(false);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    setShowRatings(false);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => setShowRatings(true), 300);
    });
  }, [wine.id]);

  const ratings = tastings.map((t) => t.rating).filter((r): r is number => r != null);
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const spread = ratings.length >= 2 ? Math.sqrt(ratings.reduce((sum, r) => sum + (r - avg!) ** 2, 0) / ratings.length) : 0;

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={s.winePosition}>Vin #{wine.position}</Text>
      <Text style={s.wineName}>{wine.name}</Text>
      <Text style={s.wineMeta}>
        {[wine.producer, wine.country, wine.vintage].filter(Boolean).join(" · ")}
      </Text>

      {showRatings ? (
        <View style={s.ratingsSection}>
          {tastings.filter((t) => t.rating != null).map((t, i) => {
            const p = participantMap.get(t.user_id);
            return (
              <RatingRow key={t.id} participant={p ?? null} rating={t.rating!} notes={t.notes} delay={i * 200} />
            );
          })}
          {avg != null ? (
            <View style={s.summaryRow}>
              <Text style={s.avgLabel}>Snitt: {avg.toFixed(1)}/5</Text>
              <View style={[s.consensusBadge, spread < 0.8 ? s.consensusHigh : s.consensusLow]}>
                <Text style={[s.consensusText, spread < 0.8 ? s.consensusTextHigh : s.consensusTextLow]}>
                  {spread < 0.8 ? "Eniga" : "Delade"}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function RatingRow({ participant, rating, notes, delay }: {
  participant: Participant | null; rating: number; notes: string | null; delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.ratingRow, { opacity: fadeAnim }]}>
      <Avatar displayName={participant?.display_name ?? null} userId={participant?.user_id ?? ""} avatarColor={participant?.avatar_color} size={28} />
      <Text style={s.ratingName}>{participant?.display_name ?? "Anonym"}</Text>
      <Text style={s.ratingValue}>{rating}/5</Text>
      {notes ? <Text style={s.ratingNotes} numberOfLines={1}>"{notes}"</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backText: { color: "#6f1d1b", fontWeight: "600", fontSize: 14 },
  progress: { color: "#564a40", fontSize: 13, fontWeight: "700" },
  card: { backgroundColor: "#fffaf5", borderRadius: 22, padding: 20, gap: 8, borderWidth: 1, borderColor: "#ead8ca" },
  winePosition: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  wineName: { color: "#231815", fontSize: 22, fontWeight: "800" },
  wineMeta: { color: "#564a40", fontSize: 14 },
  ratingsSection: { marginTop: 12, gap: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingName: { color: "#231815", fontSize: 14, fontWeight: "600", flex: 1 },
  ratingValue: { color: "#6f1d1b", fontSize: 16, fontWeight: "800" },
  ratingNotes: { color: "#564a40", fontSize: 12, flex: 1 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ead8ca" },
  avgLabel: { color: "#6f1d1b", fontSize: 16, fontWeight: "800" },
  consensusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  consensusHigh: { backgroundColor: "rgba(120,180,100,0.15)" },
  consensusLow: { backgroundColor: "rgba(200,120,80,0.15)" },
  consensusText: { fontSize: 12, fontWeight: "700" },
  consensusTextHigh: { color: "#5a8a4a" },
  consensusTextLow: { color: "#c87850" },
  controls: { marginTop: 4 },
  primaryBtn: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fffaf5", fontWeight: "700", fontSize: 16 },
  waitText: { color: "#564a40", fontSize: 14, textAlign: "center", fontStyle: "italic" },
  prevWine: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ead8ca", borderRadius: 12, padding: 10 },
  prevPosition: { color: "#6f1d1b", fontSize: 14, fontWeight: "700", width: 24 },
  prevName: { color: "#231815", fontSize: 14, fontWeight: "600", flex: 1 },
  prevRating: { color: "#6f1d1b", fontSize: 14, fontWeight: "700" },
});
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/reveal-view.tsx
git commit -m "feat: add reveal ceremony view with staggered rating animations"
```

---

### Task 4: Wire Reveal View into Session Flow

**Files:**
- Modify: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Add imports**

Add at top of tasting-session-modal.tsx:

```typescript
import { RevealView } from "./reveal-view";
import { advanceReveal, finishReveal } from "../lib/session-actions";
```

- [ ] **Step 2: Add revealing state handler**

In the `TastingSessionPanel` function, between the results dashboard check (`if (activeSession && activeSession.status === "ended")`) and the active session view (`if (activeSession)`), add:

```typescript
  // Reveal ceremony for blind sessions
  if (activeSession && activeSession.status === "revealing") {
    const isHost = activeSession.host_id === userId;
    return (
      <View style={styles.panel}>
        <RevealView
          session={activeSession}
          wines={activeWines}
          tastings={activeTastings}
          participants={participants}
          isHost={isHost}
          onAdvance={async () => {
            const next = activeSession.revealed_up_to + 1;
            const r = await advanceReveal(activeSession.id, next);
            if (r.error) { showError("Kunde inte avslöja nästa vin", r.error); return; }
            onSetActiveSession({ ...activeSession, revealed_up_to: next });
          }}
          onFinish={async () => {
            const r = await finishReveal(activeSession.id);
            if (r.error) { showError("Kunde inte avsluta avslöjningen", r.error); return; }
            onSetActiveSession({ ...activeSession, status: "ended" });
          }}
          onBack={() => { onCloseSession(); setView("list"); }}
        />
      </View>
    );
  }
```

- [ ] **Step 3: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 4: Commit**

```bash
git add src/components/tasting-session-modal.tsx
git commit -m "feat: wire reveal ceremony into session flow with host advance controls"
```
