import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Expandable, LabeledInput, SuggestionRow } from "./form-controls";
import { SessionTastingView } from "./session-tasting-view";
import { addWineToSession, buildShareMessage, endSession, revealSession, saveTasting } from "../lib/session-actions";
import type { CreateSessionInput, SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WsatTastingData } from "../lib/wsat-data";
import type { WineRecord } from "../types/wine";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export function TastingSessionPanel({
  styles, userId, sessions, loading, activeSession, activeWines, activeTastings,
  wines, onBack, onFetchSessions, onCreateSession, onJoinSession, onOpenSession,
  onCloseSession, onSetActiveWines, onSetActiveTastings, onSetActiveSession,
  onOpenWsat, wsatData,
}: {
  styles: SharedStyles;
  userId: string;
  sessions: TastingSessionRow[];
  loading: boolean;
  activeSession: TastingSessionRow | null;
  activeWines: SessionWineRow[];
  activeTastings: SessionTastingRow[];
  wines: WineRecord[];
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
            if (result) setTastingWine(null);
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
        <View style={styles.panelHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>
              {activeSession.mode === "blind" ? "Blindprovning" : "Öppen provning"} · {activeSession.format.toUpperCase()}
            </Text>
            <Text style={styles.panelTitle}>{activeSession.title}</Text>
            <Text style={s.meta}>{participantCount} deltagare · {activeWines.length} viner</Text>
          </View>
          <Pressable onPress={() => { onCloseSession(); setView("list"); }}>
            <Text style={styles.linkText}>Tillbaka</Text>
          </Pressable>
        </View>

        {activeWines.map((wine) => (
          <WineCardRow key={wine.id} wine={wine} userId={userId}
            activeTastings={activeTastings} sessionStatus={activeSession.status}
            sessionMode={activeSession.mode}
            onPress={() => activeSession.status === "active" ? setTastingWine(wine) : null} />
        ))}

        {isHost && activeSession.status === "active" ? (
          <AddWineForm sessionId={activeSession.id} wineCount={activeWines.length}
            wines={wines} onAdded={(w) => onSetActiveWines((prev) => [...prev, w])} />
        ) : null}

        {isHost ? (
          <HostControls session={activeSession} onSetSession={onSetActiveSession} />
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
            <Pressable onPress={() => setView("create")} style={styles.primaryButton}>
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

function HostControls({ session, onSetSession }: {
  session: TastingSessionRow; onSetSession: (s: TastingSessionRow | null) => void;
}) {
  return (
    <View style={s.hostControls}>
      <Pressable onPress={() => { Clipboard.setStringAsync(buildShareMessage(session.title, session.join_code)); Alert.alert("Kopierat!", "Klistra in i valfri chatt."); }} style={s.hostButton}>
        <Text style={s.hostButtonText}>Dela kod: {session.join_code}</Text>
      </Pressable>
      {session.status === "active" && session.mode === "blind" ? (
        <Pressable onPress={async () => { if (await revealSession(session.id)) onSetSession({ ...session, status: "revealed" }); }} style={s.hostButton}>
          <Text style={s.hostButtonText}>Avslöja</Text>
        </Pressable>
      ) : null}
      {session.status !== "ended" ? (
        <Pressable onPress={async () => { if (await endSession(session.id)) onSetSession({ ...session, status: "ended" }); }} style={[s.hostButton, { backgroundColor: "#ead8ca" }]}>
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

function AddWineForm({ sessionId, wineCount, wines, onAdded }: {
  sessionId: string; wineCount: number; wines: WineRecord[]; onAdded: (w: SessionWineRow) => void;
}) {
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
      session_id: sessionId, position: wineCount + 1, name: name.trim(),
      producer: producer.trim() || null, vintage: vintage ? Number(vintage) : null,
      type: type || null,
    });
    setSaving(false);
    if (result) {
      onAdded(result);
      setName(""); setProducer(""); setVintage(""); setType(""); setExpanded(false);
    }
  }

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>{expanded ? "Dölj" : "+ Lägg till vin"}</Text>
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
});
