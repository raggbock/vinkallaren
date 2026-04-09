# Tasting Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collaborative wine tasting sessions with blind/open modes, realtime updates, and shareable join codes.

**Architecture:** New Supabase tables with RLS + RPC for join flow. A dedicated hook (`useTastingSessions`) manages CRUD and Supabase Realtime subscriptions. UI is a fullscreen modal opened from Min källare, with list/session/tasting views. Reuses existing `WsatTastingModal` for WSET format.

**Tech Stack:** Supabase (tables, RLS, Realtime, RPC), React Native, TypeScript, existing AnimatedModal component.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260401120000_tasting_sessions.sql` | Create | Tables, RLS, indexes, RPC, realtime |
| `src/types/tasting-session.ts` | Create | Type definitions for sessions, wines, tastings |
| `src/lib/session-actions.ts` | Create | Create, join, add wine, save tasting, reveal, end |
| `src/hooks/useTastingSessions.ts` | Create | Session list, active session state, realtime |
| `src/components/tasting-session-modal.tsx` | Create | Main modal: list + active session views |
| `src/components/session-tasting-view.tsx` | Create | Per-wine tasting form (quick or WSET) |
| `src/components/min-kallare-panel.tsx` | Modify | Add "Provningar" button |
| `App.tsx` | Modify | Wire up hook + modal |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260401120000_tasting_sessions.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- tasting_sessions
create table if not exists public.tasting_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  join_code text unique not null,
  mode text not null check (mode in ('blind', 'open')),
  format text not null check (format in ('quick', 'wset')),
  free_order boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revealed', 'ended')),
  created_at timestamptz not null default now()
);

-- session_wines
create table if not exists public.session_wines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  position integer not null,
  name text not null,
  producer text,
  country text,
  region text,
  grape text,
  vintage integer,
  type text,
  wine_id uuid references public.wines (id) on delete set null,
  created_at timestamptz not null default now()
);

-- session_tastings
create table if not exists public.session_tastings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  session_wine_id uuid not null references public.session_wines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer check (rating is null or rating between 1 and 5),
  notes text,
  food_pairings text[] default '{}',
  tasting_data jsonb default null,
  created_at timestamptz not null default now(),
  unique (session_wine_id, user_id)
);

-- Indexes
create index idx_tasting_sessions_host on tasting_sessions (host_id);
create index idx_tasting_sessions_join_code on tasting_sessions (join_code);
create index idx_session_wines_session on session_wines (session_id);
create index idx_session_tastings_session on session_tastings (session_id);
create index idx_session_tastings_user on session_tastings (user_id);

-- RLS: tasting_sessions
alter table tasting_sessions enable row level security;

create policy "sessions_select" on tasting_sessions for select using (
  host_id = auth.uid()
  or exists (select 1 from session_tastings st where st.session_id = tasting_sessions.id and st.user_id = auth.uid())
);
create policy "sessions_insert" on tasting_sessions for insert with check (host_id = auth.uid());
create policy "sessions_update" on tasting_sessions for update using (host_id = auth.uid());
create policy "sessions_delete" on tasting_sessions for delete using (host_id = auth.uid());

-- RLS: session_wines
alter table session_wines enable row level security;

create policy "session_wines_select" on session_wines for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_wines.session_id
    and (ts.host_id = auth.uid() or exists (select 1 from session_tastings st where st.session_id = ts.id and st.user_id = auth.uid()))
  )
);
create policy "session_wines_insert" on session_wines for insert with check (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);
create policy "session_wines_update" on session_wines for update using (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);
create policy "session_wines_delete" on session_wines for delete using (
  exists (select 1 from tasting_sessions ts where ts.id = session_wines.session_id and ts.host_id = auth.uid())
);

-- RLS: session_tastings
alter table session_tastings enable row level security;

create policy "session_tastings_select_own" on session_tastings for select using (user_id = auth.uid());
create policy "session_tastings_select_others" on session_tastings for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_tastings.session_id
    and (ts.mode = 'open' or ts.status in ('revealed', 'ended') or ts.host_id = auth.uid())
  )
);
create policy "session_tastings_insert" on session_tastings for insert with check (
  user_id = auth.uid()
  and exists (select 1 from tasting_sessions ts where ts.id = session_tastings.session_id and ts.status = 'active')
);
create policy "session_tastings_update" on session_tastings for update using (
  user_id = auth.uid()
  and exists (select 1 from tasting_sessions ts where ts.id = session_tastings.session_id and ts.status = 'active')
);
create policy "session_tastings_delete" on session_tastings for delete using (user_id = auth.uid());

-- RPC: join session by code (bypasses RLS for lookup)
create or replace function public.join_session_by_code(code text)
returns json
language plpgsql security definer
as $$
declare
  sess record;
begin
  select id, title, host_id, mode, format, free_order, status
  into sess
  from tasting_sessions
  where join_code = upper(code) and status = 'active';

  if not found then
    return json_build_object('error', 'Session not found or not active');
  end if;

  return json_build_object(
    'id', sess.id,
    'title', sess.title,
    'host_id', sess.host_id,
    'mode', sess.mode,
    'format', sess.format,
    'free_order', sess.free_order,
    'status', sess.status
  );
end;
$$;

-- Enable realtime
alter publication supabase_realtime add table session_tastings;
alter publication supabase_realtime add table tasting_sessions;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run: `mcp__plugin_supabase_supabase__apply_migration` with project_id `gonspypbhqvfvpgwsdtu`, name `tasting_sessions`, and the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260401120000_tasting_sessions.sql
git commit -m "feat: add tasting_sessions DB schema, RLS, RPC, and realtime"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/tasting-session.ts`

- [ ] **Step 1: Write type definitions**

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

export type SessionWineRow = {
  id: string;
  session_id: string;
  position: number;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
  type: string | null;
  wine_id: string | null;
  created_at: string;
};

export type SessionTastingRow = {
  id: string;
  session_id: string;
  session_wine_id: string;
  user_id: string;
  rating: number | null;
  notes: string | null;
  food_pairings: string[];
  tasting_data: Record<string, unknown> | null;
  created_at: string;
};

export type SessionWineInsert = {
  session_id: string;
  position: number;
  name: string;
  producer?: string | null;
  country?: string | null;
  region?: string | null;
  grape?: string | null;
  vintage?: number | null;
  type?: string | null;
  wine_id?: string | null;
};

export type SessionTastingInsert = {
  session_id: string;
  session_wine_id: string;
  user_id: string;
  rating?: number | null;
  notes?: string | null;
  food_pairings?: string[];
  tasting_data?: Record<string, unknown> | null;
};

export type CreateSessionInput = {
  title: string;
  mode: "blind" | "open";
  format: "quick" | "wset";
  free_order: boolean;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/tasting-session.ts
git commit -m "feat: add tasting session type definitions"
```

---

### Task 3: Session Actions

**Files:**
- Create: `src/lib/session-actions.ts`

- [ ] **Step 1: Write session action functions**

```typescript
import { Alert } from "react-native";
import { supabase } from "./supabase";
import type {
  CreateSessionInput,
  SessionTastingInsert,
  SessionWineInsert,
  TastingSessionRow,
  SessionWineRow,
  SessionTastingRow,
} from "../types/tasting-session";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createSession(userId: string, input: CreateSessionInput): Promise<TastingSessionRow | null> {
  const joinCode = generateJoinCode();
  const { data, error } = await supabase
    .from("tasting_sessions")
    .insert({ host_id: userId, title: input.title, join_code: joinCode, mode: input.mode, format: input.format, free_order: input.free_order })
    .select("*")
    .single();
  if (error) { Alert.alert("Kunde inte skapa provning", error.message); return null; }
  return data as TastingSessionRow;
}

export async function joinSessionByCode(code: string): Promise<TastingSessionRow | null> {
  const { data, error } = await supabase.rpc("join_session_by_code", { code: code.toUpperCase() });
  if (error) { Alert.alert("Kunde inte gå med", error.message); return null; }
  if (data?.error) { Alert.alert("Hittades inte", "Ingen aktiv provning med den koden."); return null; }
  return data as TastingSessionRow;
}

export async function fetchSessionWines(sessionId: string): Promise<SessionWineRow[]> {
  const { data, error } = await supabase
    .from("session_wines")
    .select("*")
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  if (error) { Alert.alert("Kunde inte hämta viner", error.message); return []; }
  return (data ?? []) as SessionWineRow[];
}

export async function fetchSessionTastings(sessionId: string): Promise<SessionTastingRow[]> {
  const { data, error } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("session_id", sessionId);
  if (error) { Alert.alert("Kunde inte hämta provningar", error.message); return []; }
  return (data ?? []) as SessionTastingRow[];
}

export async function addWineToSession(wine: SessionWineInsert): Promise<SessionWineRow | null> {
  const { data, error } = await supabase.from("session_wines").insert(wine).select("*").single();
  if (error) { Alert.alert("Kunde inte lägga till vin", error.message); return null; }
  return data as SessionWineRow;
}

export async function saveTasting(tasting: SessionTastingInsert): Promise<SessionTastingRow | null> {
  const { data, error } = await supabase
    .from("session_tastings")
    .upsert(tasting, { onConflict: "session_wine_id,user_id" })
    .select("*")
    .single();
  if (error) { Alert.alert("Kunde inte spara provning", error.message); return null; }
  return data as SessionTastingRow;
}

export async function revealSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "revealed" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avslöja", error.message); return false; }
  return true;
}

export async function endSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from("tasting_sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) { Alert.alert("Kunde inte avsluta", error.message); return false; }
  return true;
}

export function buildShareMessage(title: string, joinCode: string): string {
  return `Vinprovning: ${title} — Gå med med kod: ${joinCode}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/session-actions.ts
git commit -m "feat: add session action functions (create, join, tasting, reveal, end)"
```

---

### Task 4: Tasting Sessions Hook

**Files:**
- Create: `src/hooks/useTastingSessions.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  createSession,
  fetchSessionTastings,
  fetchSessionWines,
  joinSessionByCode,
} from "../lib/session-actions";
import type {
  CreateSessionInput,
  SessionTastingRow,
  SessionWineRow,
  TastingSessionRow,
} from "../types/tasting-session";

export function useTastingSessions(userId: string) {
  const [sessions, setSessions] = useState<TastingSessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Active session state
  const [activeSession, setActiveSession] = useState<TastingSessionRow | null>(null);
  const [activeWines, setActiveWines] = useState<SessionWineRow[]>([]);
  const [activeTastings, setActiveTastings] = useState<SessionTastingRow[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasting_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setSessions(data as TastingSessionRow[]);
    setLoading(false);
  }, []);

  const openSession = useCallback(async (session: TastingSessionRow) => {
    setActiveSession(session);
    const [wines, tastings] = await Promise.all([
      fetchSessionWines(session.id),
      fetchSessionTastings(session.id),
    ]);
    setActiveWines(wines);
    setActiveTastings(tastings);
  }, []);

  const closeSession = useCallback(() => {
    setActiveSession(null);
    setActiveWines([]);
    setActiveTastings([]);
  }, []);

  const handleCreate = useCallback(async (input: CreateSessionInput) => {
    const session = await createSession(userId, input);
    if (session) {
      setSessions((prev) => [session, ...prev]);
      await openSession(session);
    }
    return session;
  }, [userId, openSession]);

  const handleJoin = useCallback(async (code: string) => {
    const session = await joinSessionByCode(code);
    if (session) {
      setSessions((prev) => {
        if (prev.some((s) => s.id === session.id)) return prev;
        return [session, ...prev];
      });
      await openSession(session);
    }
    return session;
  }, [openSession]);

  // Realtime: subscribe to tastings + session status when a session is open
  useEffect(() => {
    if (!activeSession) return;
    const sessionId = activeSession.id;

    const tastingsChannel = supabase
      .channel(`session-tastings-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_tastings", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setActiveTastings((prev) => [...prev.filter((t) => t.id !== (payload.new as SessionTastingRow).id), payload.new as SessionTastingRow]);
          } else if (payload.eventType === "UPDATE") {
            setActiveTastings((prev) => prev.map((t) => t.id === (payload.new as SessionTastingRow).id ? payload.new as SessionTastingRow : t));
          } else if (payload.eventType === "DELETE") {
            setActiveTastings((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`session-status-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasting_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as TastingSessionRow;
          setActiveSession(updated);
          setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          // Re-fetch tastings when revealed (RLS opens up, we now see others' data)
          if (updated.status === "revealed") {
            fetchSessionTastings(sessionId).then(setActiveTastings);
          }
        }
      )
      .subscribe();

    // Also subscribe to new wines added by host
    const winesChannel = supabase
      .channel(`session-wines-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "session_wines", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setActiveWines((prev) => [...prev, payload.new as SessionWineRow].sort((a, b) => a.position - b.position));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tastingsChannel);
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(winesChannel);
    };
  }, [activeSession?.id]);

  return {
    sessions,
    loading,
    activeSession,
    activeWines,
    activeTastings,
    fetchSessions,
    openSession,
    closeSession,
    createSession: handleCreate,
    joinSession: handleJoin,
    setActiveWines,
    setActiveTastings,
    setActiveSession,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTastingSessions.ts
git commit -m "feat: add useTastingSessions hook with realtime subscriptions"
```

---

### Task 5: Session Tasting View Component

**Files:**
- Create: `src/components/session-tasting-view.tsx`

- [ ] **Step 1: Write the tasting form component**

This component handles the per-wine tasting form — quick (rating + notes + food) or WSET.

```typescript
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LabeledInput, SuggestionRow } from "./form-controls";
import type { SessionWineRow } from "../types/tasting-session";
import type { WsatTastingData } from "../lib/wsat-data";
import { buildWsatSummary } from "../lib/wsat-data";

export function SessionTastingView({
  wine,
  format,
  initialRating,
  initialNotes,
  initialFoodPairings,
  initialWsatData,
  saving,
  onSave,
  onOpenWsat,
  onBack,
}: {
  wine: SessionWineRow;
  format: "quick" | "wset";
  initialRating: number | null;
  initialNotes: string | null;
  initialFoodPairings: string[];
  initialWsatData: WsatTastingData | null;
  saving: boolean;
  onSave: (data: { rating: number | null; notes: string | null; foodPairings: string[]; wsatData: WsatTastingData | null }) => void;
  onOpenWsat: () => void;
  onBack: () => void;
}) {
  const [rating, setRating] = useState(initialRating ? String(initialRating) : "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [foodPairings, setFoodPairings] = useState(initialFoodPairings.join(", "));

  function handleSave() {
    const pairings = foodPairings.split(",").map((s) => s.trim()).filter(Boolean);
    onSave({
      rating: rating ? Number(rating) : null,
      notes: notes.trim() || null,
      foodPairings: pairings,
      wsatData: initialWsatData,
    });
  }

  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={localStyles.position}>Vin {wine.position}</Text>
          <Text style={localStyles.wineName}>{wine.name}</Text>
          <Text style={localStyles.wineMeta}>
            {[wine.producer, wine.vintage, wine.country].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Pressable onPress={onBack}>
          <Text style={localStyles.backText}>Tillbaka</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={localStyles.form} keyboardShouldPersistTaps="handled">
        <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={setRating} />

        {format === "wset" ? (
          initialWsatData ? (
            <Pressable onPress={onOpenWsat} style={localStyles.wsatCard}>
              <Text style={localStyles.wsatLabel}>WSET Tasting</Text>
              <Text style={localStyles.wsatSummary}>{buildWsatSummary(initialWsatData)}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onOpenWsat} style={localStyles.wsatButton}>
              <Text style={localStyles.wsatButtonText}>WSET Tasting</Text>
            </Pressable>
          )
        ) : null}

        <LabeledInput label="Smaknotering" value={notes} onChangeText={setNotes} placeholder="t.ex. mörk frukt, bra syra" multiline />
        <LabeledInput label="Passar till" value={foodPairings} onChangeText={setFoodPairings} placeholder="lamm, pasta, ost" />

        <Pressable onPress={handleSave} style={localStyles.saveButton} disabled={saving}>
          <Text style={localStyles.saveButtonText}>{saving ? "Sparar..." : "Spara provning"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  position: { color: "#6f1d1b", fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  wineName: { color: "#2b1714", fontSize: 20, fontWeight: "700" },
  wineMeta: { color: "#8a7568", fontSize: 13, marginTop: 2 },
  backText: { color: "#6f1d1b", fontSize: 15, fontWeight: "600" },
  form: { gap: 14, paddingBottom: 24 },
  wsatCard: { backgroundColor: "#ead8ca", borderRadius: 12, padding: 12, gap: 4 },
  wsatLabel: { color: "#6f1d1b", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  wsatSummary: { color: "#564a40", fontSize: 13, lineHeight: 18 },
  wsatButton: { backgroundColor: "#ead8ca", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  wsatButtonText: { color: "#6f1d1b", fontWeight: "700" },
  saveButton: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fffaf5", fontWeight: "700", fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session-tasting-view.tsx
git commit -m "feat: add SessionTastingView component for per-wine tasting form"
```

---

### Task 6: Main Tasting Session Modal

**Files:**
- Create: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Write the modal component**

This is the largest file. It contains three views: session list, active session, and create form. The tasting view is in a separate component (Task 5). Target: under 300 lines.

```typescript
import { useEffect, useState } from "react";
import { Alert, Clipboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnimatedModal } from "./animated-modal";
import { Expandable, LabeledInput, SuggestionRow } from "./form-controls";
import { SessionTastingView } from "./session-tasting-view";
import {
  addWineToSession,
  buildShareMessage,
  endSession,
  revealSession,
  saveTasting,
} from "../lib/session-actions";
import type {
  CreateSessionInput,
  SessionTastingRow,
  SessionWineRow,
  TastingSessionRow,
} from "../types/tasting-session";
import type { WsatTastingData } from "../lib/wsat-data";
import type { WineRecord } from "../types/wine";

export function TastingSessionModal({
  visible,
  userId,
  sessions,
  loading,
  activeSession,
  activeWines,
  activeTastings,
  wines,
  onClose,
  onFetchSessions,
  onCreateSession,
  onJoinSession,
  onOpenSession,
  onCloseSession,
  onSetActiveWines,
  onSetActiveTastings,
  onSetActiveSession,
  onOpenWsat,
  wsatData,
}: {
  visible: boolean;
  userId: string;
  sessions: TastingSessionRow[];
  loading: boolean;
  activeSession: TastingSessionRow | null;
  activeWines: SessionWineRow[];
  activeTastings: SessionTastingRow[];
  wines: WineRecord[];
  onClose: () => void;
  onFetchSessions: () => void;
  onCreateSession: (input: CreateSessionInput) => Promise<TastingSessionRow | null>;
  onJoinSession: (code: string) => Promise<TastingSessionRow | null>;
  onOpenSession: (session: TastingSessionRow) => void;
  onCloseSession: () => void;
  onSetActiveWines: (fn: (prev: SessionWineRow[]) => SessionWineRow[]) => void;
  onSetActiveTastings: (fn: (prev: SessionTastingRow[]) => SessionTastingRow[]) => void;
  onSetActiveSession: (session: TastingSessionRow | null) => void;
  onOpenWsat: () => void;
  wsatData: WsatTastingData | null;
}) {
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [tastingWine, setTastingWine] = useState<SessionWineRow | null>(null);
  const [savingTasting, setSavingTasting] = useState(false);

  useEffect(() => {
    if (visible) { onFetchSessions(); setView("list"); setTastingWine(null); }
  }, [visible]);

  // If tasting a specific wine
  if (activeSession && tastingWine) {
    const existing = activeTastings.find((t) => t.session_wine_id === tastingWine.id && t.user_id === userId);
    return (
      <AnimatedModal visible={visible} onClose={onClose}>
        <SafeAreaView style={s.screen}>
          <SessionTastingView
            wine={tastingWine}
            format={activeSession.format}
            initialRating={existing?.rating ?? null}
            initialNotes={existing?.notes ?? null}
            initialFoodPairings={existing?.food_pairings ?? []}
            initialWsatData={wsatData}
            saving={savingTasting}
            onSave={async (data) => {
              setSavingTasting(true);
              const result = await saveTasting({
                session_id: activeSession.id,
                session_wine_id: tastingWine.id,
                user_id: userId,
                rating: data.rating,
                notes: data.notes,
                food_pairings: data.foodPairings,
                tasting_data: data.wsatData ?? null,
              });
              setSavingTasting(false);
              if (result) setTastingWine(null);
            }}
            onOpenWsat={onOpenWsat}
            onBack={() => setTastingWine(null)}
          />
        </SafeAreaView>
      </AnimatedModal>
    );
  }

  // If viewing an active session
  if (activeSession) {
    const isHost = activeSession.host_id === userId;
    const participantCount = new Set(activeTastings.map((t) => t.user_id)).size;
    return (
      <AnimatedModal visible={visible} onClose={onClose}>
        <SafeAreaView style={s.screen}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>{activeSession.mode === "blind" ? "Blindprovning" : "Öppen provning"} · {activeSession.format.toUpperCase()}</Text>
              <Text style={s.title}>{activeSession.title}</Text>
              <Text style={s.meta}>{participantCount} deltagare · {activeWines.length} viner</Text>
            </View>
            <Pressable onPress={() => { onCloseSession(); setView("list"); }}>
              <Text style={s.linkText}>Tillbaka</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content}>
            {activeWines.map((wine) => {
              const myTasting = activeTastings.find((t) => t.session_wine_id === wine.id && t.user_id === userId);
              const totalTastings = activeTastings.filter((t) => t.session_wine_id === wine.id).length;
              return (
                <Pressable key={wine.id} style={s.wineCard} onPress={() => activeSession.status === "active" ? setTastingWine(wine) : null}>
                  <View style={s.wineCardHeader}>
                    <Text style={s.winePosition}>{wine.position}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.wineCardName}>{wine.name}</Text>
                      <Text style={s.wineCardMeta}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <View style={s.statusBadge}>
                      <Text style={s.statusText}>{myTasting ? "✓" : `${totalTastings} st`}</Text>
                    </View>
                  </View>
                  {(activeSession.mode === "open" || activeSession.status !== "active") ? (
                    <View style={s.otherTastings}>
                      {activeTastings.filter((t) => t.session_wine_id === wine.id && t.user_id !== userId).map((t) => (
                        <Text key={t.id} style={s.otherTasting}>{t.rating ? `${t.rating}/5` : "—"}{t.notes ? ` "${t.notes}"` : ""}</Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}

            {isHost && activeSession.status === "active" ? (
              <AddWineToSessionForm sessionId={activeSession.id} wineCount={activeWines.length} wines={wines} onAdded={(wine) => onSetActiveWines((prev) => [...prev, wine])} />
            ) : null}
          </ScrollView>

          {isHost ? (
            <View style={s.hostControls}>
              <Pressable onPress={() => { Clipboard.setString(buildShareMessage(activeSession.title, activeSession.join_code)); Alert.alert("Kopierat!", "Klistra in i valfri chatt."); }} style={s.hostButton}>
                <Text style={s.hostButtonText}>Dela kod: {activeSession.join_code}</Text>
              </Pressable>
              {activeSession.status === "active" && activeSession.mode === "blind" ? (
                <Pressable onPress={async () => { if (await revealSession(activeSession.id)) onSetActiveSession({ ...activeSession, status: "revealed" }); }} style={s.hostButton}>
                  <Text style={s.hostButtonText}>Avslöja</Text>
                </Pressable>
              ) : null}
              {activeSession.status !== "ended" ? (
                <Pressable onPress={async () => { if (await endSession(activeSession.id)) onSetActiveSession({ ...activeSession, status: "ended" }); }} style={[s.hostButton, { backgroundColor: "#ead8ca" }]}>
                  <Text style={[s.hostButtonText, { color: "#6f1d1b" }]}>Avsluta</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </SafeAreaView>
      </AnimatedModal>
    );
  }

  // Session list / create / join views
  return (
    <AnimatedModal visible={visible} onClose={onClose}>
      <SafeAreaView style={s.screen}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Vinprovning</Text>
            <Text style={s.title}>Provningar</Text>
          </View>
          <Pressable onPress={onClose}>
            <Text style={s.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          {view === "create" ? (
            <CreateSessionForm onCreate={async (input) => { await onCreateSession(input); setView("list"); }} onCancel={() => setView("list")} />
          ) : view === "join" ? (
            <JoinSessionForm onJoin={async (code) => { await onJoinSession(code); setView("list"); }} onCancel={() => setView("list")} />
          ) : (
            <>
              <View style={s.actionRow}>
                <Pressable onPress={() => setView("create")} style={s.primaryBtn}><Text style={s.primaryBtnText}>Ny provning</Text></Pressable>
                <Pressable onPress={() => setView("join")} style={s.secondaryBtn}><Text style={s.secondaryBtnText}>Gå med (kod)</Text></Pressable>
              </View>
              {loading ? <Text style={s.meta}>Laddar...</Text> : null}
              {sessions.map((session) => (
                <Pressable key={session.id} style={s.sessionCard} onPress={() => onOpenSession(session)}>
                  <Text style={s.sessionTitle}>{session.title}</Text>
                  <Text style={s.sessionMeta}>{session.mode === "blind" ? "Blind" : "Öppen"} · {session.format.toUpperCase()} · {session.status === "active" ? "Pågår" : session.status === "revealed" ? "Avslöjad" : "Avslutad"}</Text>
                </Pressable>
              ))}
              {!loading && sessions.length === 0 ? <Text style={s.meta}>Inga provningar ännu.</Text> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AnimatedModal>
  );
}

// --- Sub-components ---

function CreateSessionForm({ onCreate, onCancel }: { onCreate: (input: CreateSessionInput) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"blind" | "open">("blind");
  const [format, setFormat] = useState<"quick" | "wset">("quick");
  const [freeOrder, setFreeOrder] = useState(false);
  return (
    <View style={s.formSection}>
      <LabeledInput label="Titel" value={title} onChangeText={setTitle} placeholder="t.ex. Italiensk kväll" />
      <SuggestionRow title="Läge" options={["Blind", "Öppen"]} selected={mode === "blind" ? "Blind" : "Öppen"} onSelect={(v) => setMode(v === "Blind" ? "blind" : "open")} />
      <SuggestionRow title="Format" options={["Snabb", "WSET"]} selected={format === "quick" ? "Snabb" : "WSET"} onSelect={(v) => setFormat(v === "Snabb" ? "quick" : "wset")} />
      <SuggestionRow title="Ordning" options={["I ordning", "Valfri"]} selected={freeOrder ? "Valfri" : "I ordning"} onSelect={(v) => setFreeOrder(v === "Valfri")} />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (!title.trim()) { Alert.alert("Titel saknas"); return; } onCreate({ title: title.trim(), mode, format, free_order: freeOrder }); }} style={s.primaryBtn}><Text style={s.primaryBtnText}>Skapa</Text></Pressable>
        <Pressable onPress={onCancel} style={s.secondaryBtn}><Text style={s.secondaryBtnText}>Avbryt</Text></Pressable>
      </View>
    </View>
  );
}

function JoinSessionForm({ onJoin, onCancel }: { onJoin: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  return (
    <View style={s.formSection}>
      <LabeledInput label="Provningskod" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (code.length < 6) { Alert.alert("Skriv in en 6-teckens kod"); return; } onJoin(code); }} style={s.primaryBtn}><Text style={s.primaryBtnText}>Gå med</Text></Pressable>
        <Pressable onPress={onCancel} style={s.secondaryBtn}><Text style={s.secondaryBtnText}>Avbryt</Text></Pressable>
      </View>
    </View>
  );
}

function AddWineToSessionForm({ sessionId, wineCount, wines, onAdded }: { sessionId: string; wineCount: number; wines: WineRecord[]; onAdded: (wine: SessionWineRow) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [producer, setProducer] = useState("");
  const [vintage, setVintage] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) { Alert.alert("Namn saknas"); return; }
    setSaving(true);
    const result = await addWineToSession({
      session_id: sessionId, position: wineCount + 1,
      name: name.trim(), producer: producer.trim() || null,
      vintage: vintage ? Number(vintage) : null, type: type || null,
    });
    setSaving(false);
    if (result) { onAdded(result); setName(""); setProducer(""); setVintage(""); setType(""); setExpanded(false); }
  }

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>{expanded ? "Dölj" : "＋ Lägg till vin"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        <View style={s.formSection}>
          <LabeledInput label="Namn" value={name} onChangeText={setName} placeholder="t.ex. Barolo 2018" />
          <LabeledInput label="Producent" value={producer} onChangeText={setProducer} />
          <View style={s.actionRow}>
            <LabeledInput label="Årgång" value={vintage} onChangeText={setVintage} keyboardType="number-pad" />
            <SuggestionRow title="Typ" options={["Rött", "Vitt", "Mousserande", "Sött"]} selected={type} onSelect={setType} />
          </View>
          <Pressable onPress={handleAdd} style={s.primaryBtn} disabled={saving}>
            <Text style={s.primaryBtnText}>{saving ? "Lägger till..." : "Lägg till"}</Text>
          </Pressable>
        </View>
      </Expandable>
    </View>
  );
}

// --- Styles ---

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#2b1714", padding: 18, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  eyebrow: { color: "#f4c38c", fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  title: { color: "#fff6ee", fontSize: 24, fontWeight: "700" },
  meta: { color: "#c9a87c", fontSize: 13, marginTop: 2 },
  linkText: { color: "#f4c38c", fontSize: 15, fontWeight: "600" },
  content: { gap: 12, paddingBottom: 24 },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fffaf5", fontWeight: "700", fontSize: 15 },
  secondaryBtn: { flex: 1, backgroundColor: "#3d2220", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#c9a87c", fontWeight: "700" },
  sessionCard: { backgroundColor: "#3d2220", borderRadius: 14, padding: 14, gap: 4 },
  sessionTitle: { color: "#fff6ee", fontSize: 16, fontWeight: "700" },
  sessionMeta: { color: "#c9a87c", fontSize: 13 },
  formSection: { gap: 12 },
  wineCard: { backgroundColor: "#3d2220", borderRadius: 14, padding: 14, gap: 8 },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  winePosition: { color: "#f4c38c", fontSize: 20, fontWeight: "700", width: 28 },
  wineCardName: { color: "#fff6ee", fontSize: 15, fontWeight: "600" },
  wineCardMeta: { color: "#c9a87c", fontSize: 13 },
  statusBadge: { backgroundColor: "#6f1d1b", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: "#fff6ee", fontSize: 12, fontWeight: "700" },
  otherTastings: { gap: 4, paddingLeft: 40 },
  otherTasting: { color: "#c9a87c", fontSize: 13 },
  hostControls: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  hostButton: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  hostButtonText: { color: "#fff6ee", fontWeight: "700", fontSize: 13 },
});
```

- [ ] **Step 2: Verify line count is under 300**

Run: `wc -l src/components/tasting-session-modal.tsx`
Expected: under 300 lines

- [ ] **Step 3: Commit**

```bash
git add src/components/tasting-session-modal.tsx
git commit -m "feat: add TastingSessionModal with list, session, create, and join views"
```

---

### Task 7: Wire Up in Min Källare Panel and App.tsx

**Files:**
- Modify: `src/components/min-kallare-panel.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Add "Provningar" button to Min Källare panel**

In `src/components/min-kallare-panel.tsx`, add a new prop `onOpenTastingSessions` and a button before the StorageSpaceForm:

Add to props interface:
```typescript
  onOpenTastingSessions: () => void;
```

Add to destructured props:
```typescript
  onOpenTastingSessions,
```

Add button before `<StorageSpaceForm>`:
```jsx
<Pressable onPress={onOpenTastingSessions} style={styles.secondaryButton}>
  <Text style={styles.secondaryButtonText}>Provningar</Text>
</Pressable>
```

- [ ] **Step 2: Wire up hook and modal in App.tsx**

Add imports:
```typescript
import { TastingSessionModal } from "./src/components/tasting-session-modal";
import { useTastingSessions } from "./src/hooks/useTastingSessions";
```

Add hook call (after other hooks, around line 101):
```typescript
const tastingSessions = useTastingSessions(session.user.id);
```

Add state:
```typescript
const [tastingSessionsVisible, setTastingSessionsVisible] = useState(false);
const [sessionWsatData, setSessionWsatData] = useState<WsatTastingData | null>(null);
const [sessionWsatVisible, setSessionWsatVisible] = useState(false);
```

Add prop to MinKallarePanel:
```typescript
onOpenTastingSessions={() => setTastingSessionsVisible(true)}
```

Add modals (next to other modals in JSX):
```jsx
<TastingSessionModal
  visible={tastingSessionsVisible}
  userId={session.user.id}
  sessions={tastingSessions.sessions}
  loading={tastingSessions.loading}
  activeSession={tastingSessions.activeSession}
  activeWines={tastingSessions.activeWines}
  activeTastings={tastingSessions.activeTastings}
  wines={data.wines}
  onClose={() => { setTastingSessionsVisible(false); tastingSessions.closeSession(); }}
  onFetchSessions={tastingSessions.fetchSessions}
  onCreateSession={tastingSessions.createSession}
  onJoinSession={tastingSessions.joinSession}
  onOpenSession={tastingSessions.openSession}
  onCloseSession={tastingSessions.closeSession}
  onSetActiveWines={tastingSessions.setActiveWines}
  onSetActiveTastings={tastingSessions.setActiveTastings}
  onSetActiveSession={tastingSessions.setActiveSession}
  onOpenWsat={() => setSessionWsatVisible(true)}
  wsatData={sessionWsatData}
/>
<WsatTastingModal
  visible={sessionWsatVisible}
  wineType=""
  initialData={sessionWsatData}
  onSave={(d) => setSessionWsatData(d)}
  onClose={() => setSessionWsatVisible(false)}
/>
```

- [ ] **Step 3: Verify App.tsx stays under 500 lines**

If over 500 lines, extract the tasting session modal wiring into a helper or reduce other code. The modal props can be spread from a `useMemo` object to save lines.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/min-kallare-panel.tsx App.tsx
git commit -m "feat: wire up tasting sessions in MinKallarePanel and App.tsx"
```

---

### Task 8: Integration Test — Full Flow

**Files:** None (manual testing)

- [ ] **Step 1: Test create session**
1. Open the app, go to Min källare
2. Tap "Provningar"
3. Tap "Ny provning"
4. Fill in title "Test", select Blind, WSET, I ordning
5. Tap "Skapa"
6. Verify session appears in active view

- [ ] **Step 2: Test add wines**
1. In the active session, tap "Lägg till vin"
2. Add 2 wines with name, producer, vintage
3. Verify they appear in the wine list ordered by position

- [ ] **Step 3: Test share code**
1. Tap "Dela kod: XXXXXX"
2. Verify clipboard contains the share message

- [ ] **Step 4: Test tasting flow**
1. Tap a wine card
2. Fill in rating, notes, food pairings
3. If WSET: tap WSET Tasting, fill in, save
4. Tap "Spara provning"
5. Verify the wine shows ✓ badge

- [ ] **Step 5: Test blind mode**
1. In blind mode, verify other participants' tastings are NOT visible
2. Tap "Avslöja"
3. Verify other participants' tastings now appear

- [ ] **Step 6: Test join flow**
1. Open app in a second browser/device
2. Tap "Provningar" → "Gå med (kod)"
3. Enter the join code
4. Verify session opens with wine list

- [ ] **Step 7: Test realtime**
1. With two sessions open, submit a tasting in one
2. Verify the tasting count updates in the other session in real-time

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: tasting sessions — complete implementation"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| DB tables + RLS | Task 1 |
| Type definitions | Task 2 |
| Create/join/reveal/end actions | Task 3 |
| Realtime subscriptions | Task 4 |
| Per-wine tasting form | Task 5 |
| Session modal (list/create/join/active) | Task 6 |
| Wire up in app | Task 7 |
| Blind/open mode | Task 1 (RLS) + Task 6 (UI) |
| WSET format support | Task 5 + Task 7 (WsatTastingModal) |
| Food pairings | Task 1 (column) + Task 5 (form) |
| Share code clipboard | Task 3 (buildShareMessage) + Task 6 (button) |
| Host controls (reveal/end) | Task 6 |
| Join by code RPC | Task 1 (RPC) + Task 3 (joinSessionByCode) |
| Add wines from cellar or manual | Task 6 (AddWineToSessionForm) |
| Free order option | Task 1 (column) + Task 6 (create form) |
