import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { AutocompleteInput, Expandable, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";
import { isAllDone } from "./session-active-view";
import { addWineToSession, endSession, revealSession, shareSession } from "../lib/session-actions";
import type { CreateSessionInput, SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WineRecord } from "../types/wine";

/* ── Inline feedback components ── */

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={s.inlineError}>{message}</Text>;
}

function InlineConfirm({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <View style={s.confirmCard}>
      <Text style={s.confirmTitle}>{title}</Text>
      <Text style={s.confirmMessage}>{message}</Text>
      <View style={s.confirmActions}>
        <Pressable onPress={onConfirm} style={s.confirmYes}>
          <Text style={s.confirmYesText}>Ja</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={s.confirmNo}>
          <Text style={s.confirmNoText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Host controls ── */

export function HostControls({ session, onSetSession, onEnd, activeTastings, activeWines, participantCount }: {
  session: TastingSessionRow; onSetSession: (s: TastingSessionRow | null) => void; onEnd: () => void;
  activeTastings: SessionTastingRow[]; activeWines: SessionWineRow[]; participantCount: number;
}) {
  const allDone = isAllDone(activeWines, activeTastings, participantCount);
  const [pending, setPending] = useState<"reveal" | "end" | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: 8 }}>
      <InlineError message={error} />
      {pending === "reveal" ? (
        <InlineConfirm title="Starta avslöjningen?" message="Alla kommer se resultaten ett vin i taget."
          onConfirm={async () => {
            setPending(null);
            const r = await revealSession(session.id);
            if (r.error) { setError("Kunde inte avslöja: " + r.error); return; }
            onSetSession({ ...session, status: "revealing", revealed_up_to: 1 });
          }}
          onCancel={() => setPending(null)} />
      ) : pending === "end" ? (
        <InlineConfirm title="Avsluta provning?" message="Provningen avslutas och sparas i historiken."
          onConfirm={async () => {
            setPending(null);
            const r = await endSession(session.id);
            if (r.error) { setError("Kunde inte avsluta: " + r.error); return; }
            onSetSession({ ...session, status: "ended" }); onEnd();
          }}
          onCancel={() => setPending(null)} />
      ) : (
        <View style={s.hostControls}>
          <Pressable onPress={() => shareSession(session.title, session.join_code)} style={s.hostButton}>
            <Text style={s.hostButtonText}>Dela provning</Text>
          </Pressable>
          {session.status === "active" && session.mode === "blind" ? (
            <Pressable onPress={() => { setError(null); setPending("reveal"); }}
              style={[s.hostButton, allDone && s.hostButtonHighlight]}>
              <Text style={[s.hostButtonText, allDone && { color: colors.accent }]}>{allDone ? "Alla klara \u2014 Avsl\u00F6ja!" : "Avsl\u00F6ja"}</Text>
            </Pressable>
          ) : null}
          {session.status !== "ended" ? (
            <Pressable onPress={() => { setError(null); setPending("end"); }} style={[s.hostButton, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[s.hostButtonText, { color: colors.accent }]}>Avsluta</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/* ── Create session form ── */

export function CreateForm({ onCreate, onCancel }: {
  onCreate: (input: CreateSessionInput) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"blind" | "open">("blind");
  const [format, setFormat] = useState<"quick" | "wset">("quick");
  const [freeOrder, setFreeOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={s.formSection}>
      <LabeledInput label="Titel" value={title} onChangeText={(v) => { setTitle(v); setError(null); }} placeholder="t.ex. Italiensk kväll" />
      <SuggestionRow title="Läge" options={["Blind", "Öppen"]}
        selected={mode === "blind" ? "Blind" : "Öppen"}
        onSelect={(v: string) => setMode(v === "Blind" ? "blind" : "open")} />
      <SuggestionRow title="Format" options={["Snabb", "WSET"]}
        selected={format === "quick" ? "Snabb" : "WSET"}
        onSelect={(v: string) => setFormat(v === "Snabb" ? "quick" : "wset")} />
      <SuggestionRow title="Ordning" options={["I ordning", "Valfri"]}
        selected={freeOrder ? "Valfri" : "I ordning"}
        onSelect={(v: string) => setFreeOrder(v === "Valfri")} />
      <InlineError message={error} />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (!title.trim()) { setError("Titel saknas"); return; } onCreate({ title: title.trim(), mode, format, free_order: freeOrder }); }} style={s.primaryBtn}>
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

export function JoinForm({ onJoin, onCancel }: { onJoin: (code: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={s.formSection}>
      <LabeledInput label="Provningskod" value={code}
        onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }} placeholder="ABC123" autoCapitalize="characters" />
      <InlineError message={error} />
      <View style={s.actionRow}>
        <Pressable onPress={() => { if (code.length < 6) { setError("Skriv in en 6-teckens kod"); return; } onJoin(code); }} style={s.primaryBtn}>
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

export function AddWineForm({ sessionId, wineCount, wines, searchWineNames }: {
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
  const [error, setError] = useState<string | null>(null);

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
    if (!name.trim()) { setError("Namn saknas"); return; }
    setError(null);
    setSaving(true);
    const result = await addWineToSession({
      session_id: sessionId, position: wineCount + 1, name: name.trim(),
      producer: producer.trim() || null, vintage: vintage ? Number(vintage) : null,
      wine_id: selectedWineId,
    });
    setSaving(false);
    if (result.error) { setError("Kunde inte lägga till vin"); return; }
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

          <LabeledInput label="Namn" value={name} onChangeText={(v) => { setName(v); setError(null); }} placeholder="t.ex. Barolo 2018" />
          <LabeledInput label="Producent" value={producer} onChangeText={setProducer} />
          <LabeledInput label="Årgång" value={vintage} onChangeText={setVintage} keyboardType="number-pad" />

          <InlineError message={error} />
          <Pressable onPress={handleAdd} style={s.primaryBtn} disabled={saving}>
            <Text style={s.primaryBtnText}>{saving ? "Lägger till..." : "Lägg till"}</Text>
          </Pressable>
        </View>
      </Expandable>
    </View>
  );
}

/* ── Shared styles for session forms ── */

export const s = StyleSheet.create({
  actionRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: colors.textLight, fontWeight: "700", fontSize: 15 },
  secondaryBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  secondaryBtnText: { color: colors.accent, fontWeight: "700" },
  formSection: { gap: 12 },
  hostControls: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  hostButton: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  hostButtonText: { color: colors.textLight, fontWeight: "700", fontSize: 13 },
  hostButtonHighlight: { backgroundColor: colors.warm, borderWidth: 2, borderColor: colors.accent },
  cellarPick: { backgroundColor: colors.textLight, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.surfaceAlt },
  cellarPickName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  cellarPickMeta: { color: colors.textSecondary, fontSize: 12 },
  inlineError: { color: "#c0392b", fontSize: 13, fontWeight: "600" },
  confirmCard: { backgroundColor: colors.textLight, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.surfaceAlt },
  confirmTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  confirmMessage: { color: colors.textSecondary, fontSize: 13 },
  confirmActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  confirmYes: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  confirmYesText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  confirmNo: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20 },
  confirmNoText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
});
