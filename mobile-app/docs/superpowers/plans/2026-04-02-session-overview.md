# Session Overview Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give participants real-time progress visibility during tastings — avatar row, progress bar, per-wine participant dots, host progress matrix, and smart notifications.

**Architecture:** Extract the active session view from the 432-line tasting-session-modal.tsx into a dedicated file. Add a pure progress computation helper. Enhance the UI with progress dots, avatar row, and host matrix. No database changes — all derived from existing session_tastings via realtime subscriptions.

**Tech Stack:** React Native / Expo, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-02-tasting-experience-design.md` — Subsystem 3

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/session-progress.ts` | Pure progress computation: per-wine counts, personal progress, all-done check |
| Create | `src/components/session-active-view.tsx` | Extract + enhance the active session view from tasting-session-modal |
| Modify | `src/components/tasting-session-modal.tsx` | Remove active session view code, import from session-active-view |
| Modify | `src/hooks/useTastingSessions.ts` | Add smart toast: "Alla har smakat [vinnamn]" |

---

### Task 1: Session Progress Helper

**Files:**
- Create: `src/lib/session-progress.ts`

- [ ] **Step 1: Write the progress helper**

```typescript
import type { SessionTastingRow, SessionWineRow } from "../types/tasting-session";

export type ParticipantProgress = {
  user_id: string;
  tastingCount: number;
  lastTastedAt: string | null;
};

export type WineProgress = {
  wineId: string;
  tastings: SessionTastingRow[];
  participantsDone: Set<string>;
  averageRating: number | null;
};

export function getParticipants(tastings: SessionTastingRow[]): ParticipantProgress[] {
  const map = new Map<string, ParticipantProgress>();
  for (const t of tastings) {
    const existing = map.get(t.user_id);
    if (!existing) {
      map.set(t.user_id, { user_id: t.user_id, tastingCount: 1, lastTastedAt: t.created_at });
    } else {
      existing.tastingCount++;
      if (!existing.lastTastedAt || t.created_at > existing.lastTastedAt) {
        existing.lastTastedAt = t.created_at;
      }
    }
  }
  return Array.from(map.values());
}

export function getWineProgress(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
): Map<string, WineProgress> {
  const map = new Map<string, WineProgress>();
  for (const wine of wines) {
    const wineTastings = tastings.filter((t) => t.session_wine_id === wine.id);
    const done = new Set(wineTastings.filter((t) => t.rating != null).map((t) => t.user_id));
    const ratings = wineTastings.map((t) => t.rating).filter((r): r is number => r != null);
    map.set(wine.id, {
      wineId: wine.id,
      tastings: wineTastings,
      participantsDone: done,
      averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    });
  }
  return map;
}

export function getPersonalProgress(
  userId: string,
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
): { tasted: number; total: number } {
  const tastedWineIds = new Set(
    tastings.filter((t) => t.user_id === userId && t.rating != null).map((t) => t.session_wine_id),
  );
  return { tasted: tastedWineIds.size, total: wines.length };
}

export function isAllDone(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  participantCount: number,
): boolean {
  if (wines.length === 0 || participantCount === 0) return false;
  const progress = getWineProgress(wines, tastings);
  for (const wine of wines) {
    const wp = progress.get(wine.id);
    if (!wp || wp.participantsDone.size < participantCount) return false;
  }
  return true;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit src/lib/session-progress.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/session-progress.ts
git commit -m "feat: add session progress computation helpers"
```

---

### Task 2: Extract + Enhance Active Session View

This is the big task. Extract the active session view from tasting-session-modal.tsx and enhance it with progress tracking UI.

**Files:**
- Create: `src/components/session-active-view.tsx`
- Modify: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Create session-active-view.tsx**

This file contains the active session view (what you see when a session is open). It's extracted from tasting-session-modal.tsx lines 85-131 and 170-199 (active session render + WineCardRow), then enhanced.

```typescript
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AvatarRow } from "./avatar";
import { getPersonalProgress, getWineProgress, isAllDone } from "../lib/session-progress";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { SessionToast } from "../hooks/useTastingSessions";

type ActiveSessionViewProps = {
  session: TastingSessionRow;
  userId: string;
  wines: SessionWineRow[];
  tastings: SessionTastingRow[];
  toasts: SessionToast[];
  participants: Array<{ user_id: string; display_name: string | null; avatar_color: string | null }>;
  onTasteWine: (wine: SessionWineRow) => void;
  onBack: () => void;
  children?: React.ReactNode; // host controls + add wine form injected from parent
};

export function ActiveSessionView({
  session, userId, wines, tastings, toasts, participants,
  onTasteWine, onBack, children,
}: ActiveSessionViewProps) {
  const participantIds = useMemo(() => {
    const ids = new Set(tastings.map((t) => t.user_id));
    return ids;
  }, [tastings]);

  const progress = useMemo(() => getPersonalProgress(userId, wines, tastings), [userId, wines, tastings]);
  const wineProgress = useMemo(() => getWineProgress(wines, tastings), [wines, tastings]);

  return (
    <>
      {/* Session header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>{session.mode === "blind" ? "Blind" : "Öppen"}</Text>
            </View>
            <View style={s.badge}>
              <Text style={s.badgeText}>{session.format === "quick" ? "Snabb" : "WSET"}</Text>
            </View>
          </View>
          <Text style={s.title}>{session.title}</Text>

          {/* Participant avatars */}
          {participants.length > 0 ? (
            <View style={s.avatarSection}>
              <AvatarRow participants={participants} size={28} />
              <Text style={s.participantCount}>{participantIds.size} deltagare</Text>
            </View>
          ) : (
            <Text style={s.participantCount}>{participantIds.size} deltagare · {wines.length} viner</Text>
          )}

          {/* Personal progress bar */}
          {wines.length > 0 ? (
            <View style={s.progressSection}>
              <Text style={s.progressText}>{progress.tasted} av {progress.total} viner smakade</Text>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${(progress.tasted / progress.total) * 100}%` }]} />
              </View>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onBack}>
          <Text style={s.backLink}>Tillbaka</Text>
        </Pressable>
      </View>

      {/* Toasts */}
      {toasts.map((toast) => (
        <View key={toast.id} style={s.toast}>
          <Text style={s.toastText}>{toast.message}</Text>
        </View>
      ))}

      {/* Wine list */}
      {wines.map((wine) => (
        <EnhancedWineCard
          key={wine.id}
          wine={wine}
          userId={userId}
          wineProgress={wineProgress.get(wine.id)}
          participantCount={participantIds.size}
          sessionMode={session.mode}
          sessionStatus={session.status}
          onPress={() => session.status === "active" ? onTasteWine(wine) : null}
        />
      ))}

      {/* Host controls + add wine form from parent */}
      {children}
    </>
  );
}

/* ── Enhanced Wine Card ── */

function EnhancedWineCard({ wine, userId, wineProgress, participantCount, sessionMode, sessionStatus, onPress }: {
  wine: SessionWineRow;
  userId: string;
  wineProgress: ReturnType<typeof getWineProgress> extends Map<string, infer V> ? V : never;
  participantCount: number;
  sessionMode: string;
  sessionStatus: string;
  onPress: () => void;
}) {
  if (!wineProgress) return null;
  const myTasting = wineProgress.tastings.find((t) => t.user_id === userId);
  const hasTasted = myTasting?.rating != null;
  const allDone = wineProgress.participantsDone.size >= participantCount && participantCount > 0;

  return (
    <Pressable style={[s.wineCard, !hasTasted && s.wineCardMuted]} onPress={onPress}>
      <View style={s.wineCardHeader}>
        <Text style={s.winePosition}>{wine.position}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.wineCardName}>{wine.name}</Text>
          <Text style={s.wineCardMeta}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</Text>

          {/* Progress dots: one per participant */}
          <View style={s.dotRow}>
            {Array.from({ length: participantCount }, (_, i) => (
              <View
                key={i}
                style={[s.dot, i < wineProgress.participantsDone.size ? s.dotFilled : s.dotEmpty]}
              />
            ))}
            {sessionMode === "open" && wineProgress.averageRating != null ? (
              <Text style={s.avgRating}>{wineProgress.averageRating.toFixed(1)}</Text>
            ) : null}
          </View>
        </View>
        <View style={[s.statusBadge, hasTasted && s.statusBadgeDone]}>
          <Text style={[s.statusText, hasTasted && s.statusTextDone]}>
            {hasTasted ? "✓" : allDone ? "✓✓" : `${wineProgress.participantsDone.size}/${participantCount}`}
          </Text>
        </View>
      </View>

      {/* Show others' tastings in open mode or after reveal */}
      {(sessionMode === "open" || sessionStatus !== "active") ? (
        <View style={s.otherTastings}>
          {wineProgress.tastings.filter((t) => t.user_id !== userId && t.rating != null).map((t) => (
            <Text key={t.id} style={s.otherTasting}>{t.rating}/5{t.notes ? ` "${t.notes}"` : ""}</Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ── Exported helper for host to check all-done state ── */
export { isAllDone } from "../lib/session-progress";

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 999,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: "#ead8ca",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#6f1d1b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    color: "#231815",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  participantCount: {
    color: "#564a40",
    fontSize: 13,
    marginBottom: 8,
  },
  progressSection: {
    gap: 4,
  },
  progressText: {
    color: "#564a40",
    fontSize: 12,
    fontWeight: "600",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#ead8ca",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6f1d1b",
    borderRadius: 3,
  },
  backLink: {
    color: "#6f1d1b",
    fontSize: 14,
    fontWeight: "600",
  },
  toast: {
    backgroundColor: "#6f1d1b",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  toastText: {
    color: "#fffaf5",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  wineCard: {
    backgroundColor: "#fffaf5",
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  wineCardMuted: {
    opacity: 0.6,
  },
  wineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  winePosition: {
    color: "#6f1d1b",
    fontSize: 20,
    fontWeight: "700",
    width: 28,
  },
  wineCardName: {
    color: "#231815",
    fontSize: 15,
    fontWeight: "600",
  },
  wineCardMeta: {
    color: "#564a40",
    fontSize: 13,
  },
  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: "#6f1d1b",
  },
  dotEmpty: {
    backgroundColor: "#ead8ca",
  },
  avgRating: {
    color: "#6f1d1b",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  statusBadge: {
    backgroundColor: "#ead8ca",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeDone: {
    backgroundColor: "#6f1d1b",
  },
  statusText: {
    color: "#6f1d1b",
    fontSize: 12,
    fontWeight: "700",
  },
  statusTextDone: {
    color: "#fffaf5",
  },
  otherTastings: {
    gap: 4,
    paddingLeft: 40,
  },
  otherTasting: {
    color: "#564a40",
    fontSize: 13,
  },
});
```

- [ ] **Step 2: Update tasting-session-modal.tsx to use the new component**

In `src/components/tasting-session-modal.tsx`:

1. Add import:
```typescript
import { ActiveSessionView } from "./session-active-view";
```

2. The `ParticipantBadge` component needs to pass participants to `ActiveSessionView`. But actually, `ActiveSessionView` receives `participants` as a prop. The parent (`TastingSessionPanel`) needs to fetch participants. We already have `fetchSessionParticipants` — add a state for it.

In `TastingSessionPanel`, add state for participants:
```typescript
  const [participants, setParticipants] = useState<{ user_id: string; display_name: string; avatar_color: string | null }[]>([]);
```

And fetch when session opens:
```typescript
  useEffect(() => {
    if (!activeSession) { setParticipants([]); return; }
    fetchSessionParticipants(activeSession.id).then((r) => {
      if (r.data) setParticipants(r.data);
    });
  }, [activeSession?.id, activeTastings.length]);
```

3. Replace the active session view block (the `if (activeSession)` block around lines 86-131) with:

```typescript
  if (activeSession) {
    const isHost = activeSession.host_id === userId;
    return (
      <View style={styles.panel}>
        <ActiveSessionView
          session={activeSession}
          userId={userId}
          wines={activeWines}
          tastings={activeTastings}
          toasts={toasts}
          participants={participants}
          onTasteWine={(wine) => activeSession.status === "active" ? setTastingWine(wine) : null}
          onBack={() => { onCloseSession(); setView("list"); }}
        >
          {isHost && activeSession.status === "active" ? (
            <AddWineForm sessionId={activeSession.id} wineCount={activeWines.length}
              wines={wines} searchWineNames={searchWineNames} />
          ) : null}
          {isHost ? (
            <HostControls session={activeSession} onSetSession={onSetActiveSession}
              activeTastings={activeTastings} activeWines={activeWines} participantCount={participants.length}
              onEnd={() => { onCloseSession(); setView("list"); onSessionEnded(); }} />
          ) : null}
        </ActiveSessionView>
      </View>
    );
  }
```

4. Remove the old `WineCardRow` component and its associated styles (since they're now in session-active-view.tsx). Remove styles: `wineCard`, `wineCardHeader`, `winePosition`, `wineCardName`, `wineCardMeta`, `statusBadge`, `statusText`, `otherTastings`, `otherTasting`, `toast`, `toastText` from the local stylesheet.

5. Remove the `ParticipantBadge` component entirely (participant display is now handled by `ActiveSessionView` directly with its avatar row).

- [ ] **Step 3: Update HostControls to show pulsing reveal button**

Update the `HostControls` function to accept `activeTastings`, `activeWines`, and `participantCount` props, and highlight the reveal button when all participants have tasted all wines.

Change the function signature to:
```typescript
function HostControls({ session, onSetSession, onEnd, activeTastings, activeWines, participantCount }: {
  session: TastingSessionRow; onSetSession: (s: TastingSessionRow | null) => void; onEnd: () => void;
  activeTastings: SessionTastingRow[]; activeWines: SessionWineRow[]; participantCount: number;
}) {
```

Add at the top of the function:
```typescript
  const allDone = isAllDone(activeWines, activeTastings, participantCount);
```

And import `isAllDone` from `./session-active-view`.

For the reveal button, when `allDone` is true, add a highlighted style:
```typescript
      {session.status === "active" && session.mode === "blind" ? (
        <Pressable onPress={() => confirmAction("Avslöja viner?", "Alla deltagare kommer se varandras betyg och noteringar.", async () => { const r = await revealSession(session.id); if (r.error) { showError("Kunde inte avslöja", r.error); return; } onSetSession({ ...session, status: "revealed" }); })}
          style={[s.hostButton, allDone && s.hostButtonHighlight]}>
          <Text style={s.hostButtonText}>{allDone ? "Alla klara — Avslöja!" : "Avslöja"}</Text>
        </Pressable>
      ) : null}
```

Add style:
```typescript
  hostButtonHighlight: { backgroundColor: "#f4c38c", borderWidth: 2, borderColor: "#6f1d1b" },
```

- [ ] **Step 4: Verify all files compile**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/components/session-active-view.tsx src/components/tasting-session-modal.tsx
git commit -m "feat: extract and enhance active session view with progress tracking"
```

---

### Task 3: Smart Toast — "Alla har smakat [vinnamn]"

**Files:**
- Modify: `src/hooks/useTastingSessions.ts`

- [ ] **Step 1: Update the realtime handler to detect all-done per wine**

In `useTastingSessions.ts`, the INSERT handler for tastings (around line 95-101) currently pushes generic toasts. Enhance it to detect when all participants have tasted a specific wine.

The challenge: the hook doesn't know the total participant count directly. But we can derive it from the tastings — count unique user_ids.

After the INSERT handler updates `setActiveTastings`, add a check:

In the INSERT callback, after updating the tastings state, check if the newly inserted tasting completes a wine for all known participants. We need access to `activeWines` — but it's already in the hook's state.

Update the INSERT handler to:

```typescript
          if (payload.eventType === "INSERT") {
            const tasting = payload.new as SessionTastingRow;
            setActiveTastings((prev) => {
              const next = [...prev.filter((t) => t.id !== tasting.id), tasting];
              const isNewParticipant = !prev.some((t) => t.user_id === tasting.user_id);
              if (isNewParticipant && tasting.user_id !== userId) pushToast("Ny deltagare gick med!");

              // Check if all participants have now tasted this wine
              if (tasting.rating != null && tasting.user_id !== userId) {
                const participants = new Set(next.map((t) => t.user_id));
                const wineTastings = next.filter((t) => t.session_wine_id === tasting.session_wine_id && t.rating != null);
                if (wineTastings.length === participants.size && participants.size > 1) {
                  // Find wine name from activeWines ref
                  const wineName = activeWinesRef.current.find((w) => w.id === tasting.session_wine_id)?.name;
                  if (wineName) pushToast(`Alla har smakat ${wineName}`);
                }
              }
              return next;
            });
```

For this to work, we need a ref for activeWines since the effect closure can't see the current state. Add near the top of the hook:

```typescript
  const activeWinesRef = useRef<SessionWineRow[]>([]);
  useEffect(() => { activeWinesRef.current = activeWines; }, [activeWines]);
```

Also add `useRef` to the imports.

- [ ] **Step 2: Verify and commit**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/hooks/useTastingSessions.ts
git commit -m "feat: add smart toast when all participants have tasted a wine"
```
