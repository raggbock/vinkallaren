import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PanelHeader, type Suggestion } from "./form-controls";
import { ActiveSessionView } from "./session-active-view";
import { SessionTastingView } from "./session-tasting-view";
import { addSessionDish, advanceReveal, deleteSessionDish, fetchSessionParticipants, fetchTastingDishes, finishReveal, saveTasting, saveTastingDishes, startSession } from "../lib/session-actions";
import { supabase } from "../lib/supabase";
import { SessionSetupView } from "./session-setup-view";
import { AddWineForm, CreateForm, HostControls, InlineError, JoinForm, s } from "./session-forms";
import type { CreateSessionInput, SessionDishRow, SessionParticipant, SessionTastingDishRow, SessionTastingInsert, SessionTastingRow, SessionToast, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WsetTastingData } from "../lib/wset-data";
import type { WineRecord } from "../types/wine";
import { ResultsDashboard } from "./results-dashboard";
import { buildSessionResults } from "../lib/session-results";
import { RevealView } from "./reveal-view";
import { UpgradePrompt } from "./upgrade-prompt";

import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export function TastingSessionPanel({
  styles, userId, isAnonymous, sessions, loading, toasts, pushToast, activeSession, activeWines, activeTastings,
  activeParticipants, activeDishes, activeTastingDishes,
  onSetActiveParticipants, onSetActiveDishes, onSetActiveTastingDishes,
  wines, searchWineNames, onBack, onFetchSessions, onCreateSession, onJoinSession, onOpenSession,
  onCloseSession, onSetActiveWines, onSetActiveTastings, onSetActiveSession,
  onOpenWset, wsetData, onSessionEnded, onSaveTastingOptimistic,
}: {
  styles: SharedStyles;
  userId: string;
  isAnonymous: boolean;
  sessions: TastingSessionRow[];
  loading: boolean;
  toasts: SessionToast[];
  pushToast: (message: string) => void;
  activeSession: TastingSessionRow | null;
  activeWines: SessionWineRow[];
  activeTastings: SessionTastingRow[];
  activeParticipants: SessionParticipant[];
  activeDishes: SessionDishRow[];
  activeTastingDishes: SessionTastingDishRow[];
  onSetActiveParticipants: React.Dispatch<React.SetStateAction<SessionParticipant[]>>;
  onSetActiveDishes: React.Dispatch<React.SetStateAction<SessionDishRow[]>>;
  onSetActiveTastingDishes: React.Dispatch<React.SetStateAction<SessionTastingDishRow[]>>;
  wines: WineRecord[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  onBack: () => void;
  onFetchSessions: () => void;
  onCreateSession: (input: CreateSessionInput) => Promise<TastingSessionRow | null>;
  onJoinSession: (code: string) => Promise<TastingSessionRow | null>;
  onOpenSession: (session: TastingSessionRow) => void;
  onCloseSession: () => void;
  onSetActiveWines: (fn: (prev: SessionWineRow[]) => SessionWineRow[]) => void;
  onSetActiveTastings: (fn: (prev: SessionTastingRow[]) => SessionTastingRow[]) => void;
  onSetActiveSession: (session: TastingSessionRow | null) => void;
  onOpenWset: (wineType?: string, wineId?: string) => void;
  wsetData: WsetTastingData | null;
  onSessionEnded: () => void;
  onSaveTastingOptimistic: (row: SessionTastingInsert) => Promise<void>;
}) {
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [tastingWine, setTastingWine] = useState<SessionWineRow | null>(null);
  const [savingTasting, setSavingTasting] = useState(false);
  const participants = activeParticipants;
  const dishes = activeDishes;
  const tastingDishes = activeTastingDishes;
  const setParticipants = onSetActiveParticipants;
  const setDishes = onSetActiveDishes;
  const setTastingDishes = onSetActiveTastingDishes;
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => { onFetchSessions(); setView("list"); setTastingWine(null); }, []);

  async function handleSaveTasting(data: {
    rating: number | null; notes: string | null; foodPairings: string[];
    wsetData?: WsetTastingData | null; dishIds: string[];
  }) {
    if (!activeSession || !tastingWine) return;
    setSavingTasting(true);
    const row: SessionTastingInsert = {
      session_id: activeSession.id, session_wine_id: tastingWine.id,
      user_id: userId, rating: data.rating, notes: data.notes,
      food_pairings: data.foodPairings, tasting_data: data.wsetData ?? null,
    };

    if (data.dishIds.length > 0) {
      // Need confirmed DB id to link dishes — use direct save
      const result = await saveTasting(row);
      if (result.error) { setSavingTasting(false); setInlineError("Kunde inte spara provning"); return; }
      await saveTastingDishes(result.data!.id, data.dishIds);
      const tdResult = await fetchTastingDishes(activeSession.id);
      if (tdResult.data) setTastingDishes(tdResult.data);
    } else {
      await onSaveTastingOptimistic(row);
    }

    setSavingTasting(false);
    setTastingWine(null);
  }

  useEffect(() => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    const refetch = () => fetchSessionParticipants(sessionId).then((r) => {
      if (r.data) setParticipants(r.data);
    });
    const channel = supabase
      .channel(`session-participants-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_participants", filter: `session_id=eq.${sessionId}` }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession?.id, setParticipants]);

  // Named "X har gått med" toast — diff participants list locally because the
  // realtime payload only carries user_id (display_name lands via refetch).
  const seenParticipantsRef = useRef<{ sessionId: string | null; ids: Set<string> }>({ sessionId: null, ids: new Set() });
  useEffect(() => {
    if (!activeSession) { seenParticipantsRef.current = { sessionId: null, ids: new Set() }; return; }
    const ref = seenParticipantsRef.current;
    if (ref.sessionId !== activeSession.id) {
      seenParticipantsRef.current = { sessionId: activeSession.id, ids: new Set(participants.map((p) => p.user_id)) };
      return;
    }
    for (const p of participants) {
      if (ref.ids.has(p.user_id)) continue;
      ref.ids.add(p.user_id);
      if (p.user_id !== userId) pushToast(`${p.display_name || "Någon"} har gått med`);
    }
  }, [participants, activeSession?.id, userId, pushToast]);

  // Dishes/tastingDishes are seeded by the hook's openSession overview RPC;
  // we only refetch tastingDishes after a save that attaches dish links.

  async function handleAddDish(name: string) {
    if (!activeSession) return;
    const r = await addSessionDish(activeSession.id, name);
    if (r.error) { setInlineError("Kunde inte lägga till maträtt"); return; }
    setDishes((prev) => [...prev, r.data!]);
  }

  async function handleRemoveDish(dishId: string) {
    const r = await deleteSessionDish(dishId);
    if (r.error) { setInlineError("Kunde inte ta bort maträtt"); return; }
    setDishes((prev) => prev.filter((d) => d.id !== dishId));
  }

  // Tasting a specific wine
  if (activeSession && tastingWine) {
    const existing = activeTastings.find((t) => t.session_wine_id === tastingWine.id && t.user_id === userId);
    const existingDishIds = tastingDishes
      .filter((td) => td.session_tasting_id === existing?.id)
      .map((td) => td.session_dish_id);
    return (
      <View style={styles.panel}>
        <SessionTastingView
          wine={tastingWine}
          format={activeSession.format}
          initialRating={existing?.rating ?? null}
          initialNotes={existing?.notes ?? null}
          initialFoodPairings={existing?.food_pairings ?? []}
          initialWsetData={wsetData}
          initialDishIds={existingDishIds}
          dishes={dishes}
          saving={savingTasting}
          onSave={handleSaveTasting}
          onOpenWset={(type) => onOpenWset(type, tastingWine.id)}
          onBack={() => setTastingWine(null)}
        />
      </View>
    );
  }

  // Results view for ended/revealed sessions
  if (activeSession && activeSession.status === "ended") {
    const results = buildSessionResults(activeWines, activeTastings, activeSession.format, activeSession.created_at, dishes, tastingDishes);
    const isHost = activeSession.host_id === userId;
    return (
      <View style={styles.panel}>
        <ResultsDashboard
          results={results}
          participants={participants}
          onBack={() => { onCloseSession(); setView("list"); }}
          isAnonymous={isAnonymous}
          isHost={isHost}
          onCreateAccount={() => setUpgradeVisible(true)}
          onStartOwnTasting={() => { onCloseSession(); setView("create"); }}
        />
        <UpgradePrompt
          visible={upgradeVisible}
          isBlocked={false}
          onUpgraded={() => setUpgradeVisible(false)}
          onDismiss={() => setUpgradeVisible(false)}
        />
      </View>
    );
  }

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
            if (r.error) { setInlineError("Kunde inte avslöja nästa vin"); return; }
            onSetActiveSession({ ...activeSession, revealed_up_to: next });
          }}
          onFinish={async () => {
            const r = await finishReveal(activeSession.id);
            if (r.error) { setInlineError("Kunde inte avsluta avslöjningen"); return; }
            onSetActiveSession({ ...activeSession, status: "ended" });
          }}
          onBack={() => { onCloseSession(); setView("list"); }}
        />
      </View>
    );
  }

  // Setup/lobby view
  if (activeSession && activeSession.status === "setup") {
    const isHost = activeSession.host_id === userId;
    return (
      <View style={styles.panel}>
        <InlineError message={inlineError} />
        <SessionSetupView
          session={activeSession}
          wines={activeWines}
          participants={participants}
          isHost={isHost}
          dishes={dishes}
          onAddDish={handleAddDish}
          onRemoveDish={handleRemoveDish}
          onStart={async () => {
            const r = await startSession(activeSession.id);
            if (r.error) { setInlineError("Kunde inte starta"); return; }
            onSetActiveSession({ ...activeSession, status: "active" });
          }}
          onBack={() => { onCloseSession(); setView("list"); }}
          onReorder={(reordered) => onSetActiveWines(() => reordered)}
        >
          {isHost ? (
            <AddWineForm sessionId={activeSession.id} wineCount={activeWines.length}
              wines={wines} searchWineNames={searchWineNames} />
          ) : null}
        </SessionSetupView>
      </View>
    );
  }

  // Active session view
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
          dishes={dishes}
          onAddDish={handleAddDish}
          onRemoveDish={handleRemoveDish}
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

  // Session list / create / join
  return (
    <SessionListView
      styles={styles} view={view} setView={setView} sessions={sessions} loading={loading}
      inlineError={inlineError} setInlineError={setInlineError}
      onBack={onBack} onCreateSession={onCreateSession} onJoinSession={onJoinSession} onOpenSession={onOpenSession}
    />
  );
}

/* ── Session list / create / join ── */

function SessionListView({ styles, view, setView, sessions, loading, inlineError, setInlineError, onBack, onCreateSession, onJoinSession, onOpenSession }: {
  styles: SharedStyles; view: "list" | "create" | "join"; setView: (v: "list" | "create" | "join") => void;
  sessions: TastingSessionRow[]; loading: boolean;
  inlineError: string | null; setInlineError: (e: string | null) => void;
  onBack: () => void;
  onCreateSession: (input: CreateSessionInput) => Promise<TastingSessionRow | null>;
  onJoinSession: (code: string) => Promise<TastingSessionRow | null>;
  onOpenSession: (session: TastingSessionRow) => void;
}) {
  return (
    <View style={styles.panel}>
      <PanelHeader title="Provningar" rightLabel="Tillbaka" onRightPress={onBack} />
      <InlineError message={inlineError} />

      {view === "create" ? (
        <CreateForm onCreate={async (input) => {
          const result = await onCreateSession(input);
          if (!result) { setInlineError("Kunde inte skapa provning"); return; }
          setView("list");
        }} onCancel={() => setView("list")} />
      ) : view === "join" ? (
        <JoinForm onJoin={async (code) => {
          const result = await onJoinSession(code);
          if (!result) { setInlineError("Kunde inte gå med — kontrollera koden"); return; }
          setView("list");
        }} onCancel={() => setView("list")} />
      ) : (
        <>
          <View style={s.actionRow}>
            <Pressable onPress={() => setView("create")} style={[styles.primaryButton, { flex: 2 }]}>
              <Text style={styles.primaryButtonText}>Ny provning</Text>
            </Pressable>
            <Pressable onPress={() => setView("join")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Gå med (kod)</Text>
            </Pressable>
          </View>
          {loading ? <Text style={local.meta}>Laddar...</Text> : null}
          {sessions.map((ses) => (
            <Pressable key={ses.id} style={local.sessionCard} onPress={() => onOpenSession(ses)}>
              <Text style={local.sessionTitle}>{ses.title}</Text>
              <Text style={local.sessionMeta}>
                {ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()} · {statusLabel(ses.status)}
              </Text>
            </Pressable>
          ))}
          {!loading && sessions.length === 0 ? <Text style={local.meta}>Inga provningar ännu.</Text> : null}
        </>
      )}
    </View>
  );
}

function statusLabel(status: TastingSessionRow["status"]): string {
  const labels: Record<string, string> = { setup: "Förbereder", active: "Pågår", revealing: "Avslöjas", ended: "Avslutad" };
  return labels[status] ?? status;
}

/* ── Local styles (only what theme doesn't cover) ── */

const local = StyleSheet.create({
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  sessionCard: { backgroundColor: colors.textLight, borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.surfaceAlt },
  sessionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sessionMeta: { color: colors.textSecondary, fontSize: 13 },
});
