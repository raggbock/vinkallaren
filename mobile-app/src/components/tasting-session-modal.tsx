import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { AutocompleteInput, Expandable, LabeledInput, SuggestionRow } from "./form-controls";
import type { Suggestion } from "./form-controls";
import { SessionTastingView } from "./session-tasting-view";
import { addWineToSession, buildShareMessage, endSession, fetchSessionParticipants, revealSession, saveTasting } from "../lib/session-actions";
import { showError } from "../lib/show-error";
import type { CreateSessionInput, SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WsatTastingData } from "../lib/wsat-data";
import type { WineRecord } from "../types/wine";
import type { SessionToast } from "../hooks/useTastingSessions";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export function TastingSessionPanel({
  styles, userId, sessions, loading, toasts, activeSession, activeWines, activeTastings,
  wines, searchWineNames, onBack, onFetchSessions, onCreateSession, onJoinSession, onOpenSession,
  onCloseSession, onSetActiveWines, onSetActiveTastings, onSetActiveSession,
  onOpenWsat, wsatData, onSessionEnded,
}: {
  styles: SharedStyles;
  userId: string;
  sessions: TastingSessionRow[];
  loading: boolean;
  toasts: SessionToast[];
  activeSession: TastingSessionRow | null;
  activeWines: SessionWineRow[];
  activeTastings: SessionTastingRow[];
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
  onOpenWsat: () => void;
  wsatData: WsatTastingData | null;
  onSessionEnded: () => void;
}) {
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [tastingWine, setTastingWine] = useState<SessionWineRow | null>(null);
  const [savingTasting, setSavingTasting] = useState(false);

  useEffect(() => { onFetchSessions(); setView("list"); setTastingWine(null); }, []);

  // Tasting a specific wine
  if (activeSession && tastingWine) {
    const existing = activeTastings.find(
      (t) => t.session_wine_id === tastingWine.id && t.user_id === userId,
    );
    return (
      <View style={styles.panel}>
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
              session_id: activeSession.id, session_wine_id: tastingWine.id,
              user_id: userId, rating: data.rating, notes: data.notes,
              food_pairings: data.foodPairings, tasting_data: data.wsatData ?? null,
            });
            setSavingTasting(false);
            if (result.error) { showError("Kunde inte spara provning", result.error); return; }
            setTastingWine(null);
          }}
          onOpenWsat={onOpenWsat}
          onBack={() => setTastingWine(null)}
        />
      </View>
    );
  }

  // Active session view
  if (activeSession) {
    const isHost = activeSession.host_id === userId;
    const participantCount = new Set(activeTastings.map((t) => t.user_id)).size;
    return (
      <View style={styles.panel}>
        <View style={[styles.panelHeaderRow, { zIndex: 999 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>
              {activeSession.mode === "blind" ? "Blindprovning" : "Öppen provning"} · {activeSession.format.toUpperCase()}
            </Text>
            <Text style={styles.panelTitle}>{activeSession.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, zIndex: 999 }}>
              <ParticipantBadge sessionId={activeSession.id} count={participantCount} />
              <Text style={s.meta}> · {activeWines.length} viner</Text>
            </View>
          </View>
          <Pressable onPress={() => { onCloseSession(); setView("list"); }}>
            <Text style={styles.linkText}>Tillbaka</Text>
          </Pressable>
        </View>

        {toasts.map((toast) => (
          <View key={toast.id} style={s.toast}>
            <Text style={s.toastText}>{toast.message}</Text>
          </View>
        ))}

        {activeWines.map((wine) => (
          <WineCardRow key={wine.id} wine={wine} userId={userId}
            activeTastings={activeTastings} sessionStatus={activeSession.status}
            sessionMode={activeSession.mode}
            onPress={() => activeSession.status === "active" ? setTastingWine(wine) : null} />
        ))}

        {isHost && activeSession.status === "active" ? (
          <AddWineForm sessionId={activeSession.id} wineCount={activeWines.length}
            wines={wines} searchWineNames={searchWineNames} />
        ) : null}

        {isHost ? (
          <HostControls session={activeSession} onSetSession={onSetActiveSession}
            onEnd={() => { onCloseSession(); setView("list"); onSessionEnded(); }} />
        ) : null}
      </View>
    );
  }

  // Session list / create / join
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Provningar</Text>
        <Pressable onPress={onBack}><Text style={styles.linkText}>Tillbaka</Text></Pressable>
      </View>

      {view === "create" ? (
        <CreateForm onCreate={async (input) => { await onCreateSession(input); setView("list"); }}
          onCancel={() => setView("list")} />
      ) : view === "join" ? (
        <JoinForm onJoin={async (code) => { await onJoinSession(code); setView("list"); }}
          onCancel={() => setView("list")} />
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
          {loading ? <Text style={s.meta}>Laddar...</Text> : null}
          {sessions.map((ses) => (
            <Pressable key={ses.id} style={s.sessionCard} onPress={() => onOpenSession(ses)}>
              <Text style={s.sessionTitle}>{ses.title}</Text>
              <Text style={s.sessionMeta}>
                {ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()} · {ses.status === "active" ? "Pågår" : ses.status === "revealed" ? "Avslöjad" : "Avslutad"}
              </Text>
            </Pressable>
          ))}
          {!loading && sessions.length === 0 ? <Text style={s.meta}>Inga provningar ännu.</Text> : null}
        </>
      )}
    </View>
  );
}

/* ── Wine card row ── */

function WineCardRow({ wine, userId, activeTastings, sessionStatus, sessionMode, onPress }: {
  wine: SessionWineRow; userId: string; activeTastings: SessionTastingRow[];
  sessionStatus: string; sessionMode: string; onPress: () => void;
}) {
  const mine = activeTastings.find((t) => t.session_wine_id === wine.id && t.user_id === userId);
  const total = activeTastings.filter((t) => t.session_wine_id === wine.id).length;
  return (
    <Pressable style={s.wineCard} onPress={onPress}>
      <View style={s.wineCardHeader}>
        <Text style={s.winePosition}>{wine.position}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.wineCardName}>{wine.name}</Text>
          <Text style={s.wineCardMeta}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={[s.statusBadge, mine && { backgroundColor: "#6f1d1b" }]}>
          <Text style={[s.statusText, mine && { color: "#fffaf5" }]}>{mine ? "✓" : `${total} st`}</Text>
        </View>
      </View>
      {(sessionMode === "open" || sessionStatus !== "active") ? (
        <View style={s.otherTastings}>
          {activeTastings.filter((t) => t.session_wine_id === wine.id && t.user_id !== userId).map((t) => (
            <Text key={t.id} style={s.otherTasting}>{t.rating ? `${t.rating}/5` : "—"}{t.notes ? ` "${t.notes}"` : ""}</Text>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/* ── Host controls ── */

function HostControls({ session, onSetSession, onEnd }: {
  session: TastingSessionRow; onSetSession: (s: TastingSessionRow | null) => void; onEnd: () => void;
}) {
  return (
    <View style={s.hostControls}>
      <Pressable onPress={() => { Clipboard.setStringAsync(buildShareMessage(session.title, session.join_code)); Alert.alert("Kopierat!", "Klistra in i valfri chatt."); }} style={s.hostButton}>
        <Text style={s.hostButtonText}>Dela kod: {session.join_code}</Text>
      </Pressable>
      {session.status === "active" && session.mode === "blind" ? (
        <Pressable onPress={() => Alert.alert("Avslöja viner?", "Alla deltagare kommer se varandras betyg och noteringar.", [
          { text: "Avbryt", style: "cancel" },
          { text: "Avslöja", onPress: async () => { const r = await revealSession(session.id); if (r.error) { showError("Kunde inte avslöja", r.error); return; } onSetSession({ ...session, status: "revealed" }); } },
        ])} style={s.hostButton}>
          <Text style={s.hostButtonText}>Avslöja</Text>
        </Pressable>
      ) : null}
      {session.status !== "ended" ? (
        <Pressable onPress={() => Alert.alert("Avsluta provning?", "Provningen avslutas och sparas i historiken.", [
          { text: "Avbryt", style: "cancel" },
          { text: "Avsluta", style: "destructive", onPress: async () => { const r = await endSession(session.id); if (r.error) { showError("Kunde inte avsluta", r.error); return; } onSetSession({ ...session, status: "ended" }); onEnd(); } },
        ])} style={[s.hostButton, { backgroundColor: "#ead8ca" }]}>
          <Text style={[s.hostButtonText, { color: "#6f1d1b" }]}>Avsluta</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Create session form ── */

function CreateForm({ onCreate, onCancel }: {
  onCreate: (input: CreateSessionInput) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"blind" | "open">("blind");
  const [format, setFormat] = useState<"quick" | "wset">("quick");
  const [freeOrder, setFreeOrder] = useState(false);
  return (
    <View style={s.formSection}>
      <LabeledInput label="Titel" value={title} onChangeText={setTitle} placeholder="t.ex. Italiensk kväll" />
      <SuggestionRow title="Läge" options={["Blind", "Öppen"]}
        selected={mode === "blind" ? "Blind" : "Öppen"}
        onSelect={(v: string) => setMode(v === "Blind" ? "blind" : "open")} />
      <SuggestionRow title="Format" options={["Snabb", "WSET"]}
        selected={format === "quick" ? "Snabb" : "WSET"}
        onSelect={(v: string) => setFormat(v === "Snabb" ? "quick" : "wset")} />
      <SuggestionRow title="Ordning" options={["I ordning", "Valfri"]}
        selected={freeOrder ? "Valfri" : "I ordning"}
        onSelect={(v: string) => setFreeOrder(v === "Valfri")} />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (!title.trim()) { Alert.alert("Titel saknas"); return; } onCreate({ title: title.trim(), mode, format, free_order: freeOrder }); }} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>Skapa</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={s.secondaryBtn}>
          <Text style={s.secondaryBtnText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Join session form ── */

function JoinForm({ onJoin, onCancel }: { onJoin: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  return (
    <View style={s.formSection}>
      <LabeledInput label="Provningskod" value={code}
        onChangeText={(v) => setCode(v.toUpperCase())} placeholder="ABC123" autoCapitalize="characters" />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (code.length < 6) { Alert.alert("Skriv in en 6-teckens kod"); return; } onJoin(code); }} style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>Gå med</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={s.secondaryBtn}>
          <Text style={s.secondaryBtnText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Add wine form ── */

function AddWineForm({ sessionId, wineCount, wines, searchWineNames }: {
  sessionId: string; wineCount: number; wines: WineRecord[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<"manual" | "cellar">("manual");
  const [name, setName] = useState("");
  const [producer, setProducer] = useState("");
  const [vintage, setVintage] = useState("");
  const [cellarFilter, setCellarFilter] = useState("");
  const [selectedWineId, setSelectedWineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function prefill(wineName: string, wineProducer: string | null, wineVintage: number | null, wineId?: string | null) {
    setName(wineName);
    setProducer(wineProducer || "");
    setVintage(wineVintage ? String(wineVintage) : "");
    setSelectedWineId(wineId || null);
  }

  const filteredCellarWines = cellarFilter.length >= 2
    ? wines.filter((w) => w.name.toLowerCase().includes(cellarFilter.toLowerCase())).slice(0, 8)
    : wines.slice(0, 8);

  async function handleAdd() {
    if (!name.trim()) { Alert.alert("Namn saknas"); return; }
    setSaving(true);
    const result = await addWineToSession({
      session_id: sessionId, position: wineCount + 1, name: name.trim(),
      producer: producer.trim() || null, vintage: vintage ? Number(vintage) : null,
      wine_id: selectedWineId,
    });
    setSaving(false);
    if (result.error) { showError("Kunde inte lägga till vin", result.error); return; }
    setName(""); setProducer(""); setVintage(""); setCellarFilter("");
    setSelectedWineId(null); setExpanded(false);
  }

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>{expanded ? "Dölj" : "+ Lägg till vin"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        <View style={s.formSection}>
          <SuggestionRow title="Källa" options={["Sök", "Från källaren"]}
            selected={source === "manual" ? "Sök" : "Från källaren"}
            onSelect={(v: string) => setSource(v === "Sök" ? "manual" : "cellar")} />

          {source === "cellar" ? (
            <>
              <LabeledInput label="Filtrera" value={cellarFilter} onChangeText={setCellarFilter} placeholder="Sök bland dina viner..." />
              {filteredCellarWines.map((w) => (
                <Pressable key={w.id} style={s.cellarPick} onPress={() => prefill(w.name, w.producer, w.vintage, w.id)}>
                  <Text style={s.cellarPickName}>{w.name}</Text>
                  <Text style={s.cellarPickMeta}>{[w.producer, w.vintage].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <AutocompleteInput label="Sök vin" value={name} onChangeText={setName}
              onOptionSelected={(v, parentName) => prefill(v, parentName || null, null)}
              options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
          )}

          <LabeledInput label="Namn" value={name} onChangeText={setName} placeholder="t.ex. Barolo 2018" />
          <LabeledInput label="Producent" value={producer} onChangeText={setProducer} />
          <LabeledInput label="Årgång" value={vintage} onChangeText={setVintage} keyboardType="number-pad" />

          <Pressable onPress={handleAdd} style={s.primaryBtn} disabled={saving}>
            <Text style={s.primaryBtnText}>{saving ? "Lägger till..." : "Lägg till"}</Text>
          </Pressable>
        </View>
      </Expandable>
    </View>
  );
}

/* ── Participant hover badge ── */

function ParticipantBadge({ sessionId, count }: { sessionId: string; count: number }) {
  const [names, setNames] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function handleHover() {
    setShowTooltip(true);
    if (!fetched) {
      const result = await fetchSessionParticipants(sessionId);
      if (result.data) setNames(result.data.map((p) => p.display_name || "Anonym"));
      setFetched(true);
    }
  }

  // Re-fetch when count changes
  useEffect(() => { setFetched(false); }, [count]);

  return (
    <View>
      <Pressable
        onHoverIn={handleHover} onHoverOut={() => setShowTooltip(false)}
        onPress={async () => {
          if (!fetched) {
            const result = await fetchSessionParticipants(sessionId);
            if (result.data) setNames(result.data.map((p) => p.display_name || "Anonym"));
            setFetched(true);
          }
          setShowTooltip((v) => !v);
        }}
      >
        <Text style={[s.meta, { textDecorationLine: "underline" }]}>{count} deltagare</Text>
      </Pressable>
      {showTooltip && names.length > 0 ? (
        <View style={s.tooltip}>
          {names.map((name, i) => (
            <Text key={i} style={s.tooltipText}>{name}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ── Local styles (only what theme doesn't cover) ── */

const s = StyleSheet.create({
  eyebrow: { color: "#6f1d1b", fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  meta: { color: "#564a40", fontSize: 13, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fffaf5", fontWeight: "700", fontSize: 15 },
  secondaryBtn: { flex: 1, backgroundColor: "#ead8ca", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: "#6f1d1b", fontWeight: "700" },
  sessionCard: { backgroundColor: "#fffaf5", borderRadius: 18, padding: 14, gap: 4, borderWidth: 1, borderColor: "#ead8ca" },
  sessionTitle: { color: "#231815", fontSize: 16, fontWeight: "700" },
  sessionMeta: { color: "#564a40", fontSize: 13 },
  formSection: { gap: 12 },
  wineCard: { backgroundColor: "#fffaf5", borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: "#ead8ca" },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  winePosition: { color: "#6f1d1b", fontSize: 20, fontWeight: "700", width: 28 },
  wineCardName: { color: "#231815", fontSize: 15, fontWeight: "600" },
  wineCardMeta: { color: "#564a40", fontSize: 13 },
  statusBadge: { backgroundColor: "#ead8ca", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: "#6f1d1b", fontSize: 12, fontWeight: "700" },
  otherTastings: { gap: 4, paddingLeft: 40 },
  otherTasting: { color: "#564a40", fontSize: 13 },
  hostControls: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  hostButton: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  hostButtonText: { color: "#fffaf5", fontWeight: "700", fontSize: 13 },
  tooltip: { position: "absolute" as const, top: 22, left: 0, backgroundColor: "#231815", borderRadius: 10, padding: 10, gap: 2, zIndex: 999, minWidth: 140, elevation: 10 },
  tooltipText: { color: "#fffaf5", fontSize: 13 },
  toast: { backgroundColor: "#6f1d1b", borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  toastText: { color: "#fffaf5", fontSize: 13, fontWeight: "600", textAlign: "center" as const },
  cellarPick: { backgroundColor: "#fffaf5", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#ead8ca" },
  cellarPickName: { color: "#231815", fontSize: 14, fontWeight: "600" },
  cellarPickMeta: { color: "#564a40", fontSize: 12 },
});
