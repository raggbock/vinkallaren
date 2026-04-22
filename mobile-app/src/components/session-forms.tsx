import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { AutocompleteInput, Expandable, LabeledInput, SuggestionRow, type Suggestion } from "./form-controls";
import { isAllDone } from "./session-active-view";
import { addWineToSession, batchAddWinesToSession, endSession, revealSession, shareSession } from "../lib/session-actions";
import { findCatalogMatch } from "../lib/product-catalog";
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

export function AddWineForm({ sessionId, wineCount, wines, searchWineNames, onWinesAdded }: {
  sessionId: string; wineCount: number; wines: WineRecord[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  onWinesAdded?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<"manual" | "cellar" | "article">("cellar");
  const [cellarFilter, setCellarFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [articleNo, setArticleNo] = useState("");

  const filteredCellarWines = cellarFilter.length >= 2
    ? wines.filter((w) => w.name.toLowerCase().includes(cellarFilter.toLowerCase())).slice(0, 20)
    : wines.slice(0, 20);

  function toggleWine(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBatchAdd() {
    const selected = wines.filter((w) => selectedIds.has(w.id));
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    const result = await batchAddWinesToSession(
      sessionId,
      wineCount + 1,
      selected.map((w) => ({ name: w.name, producer: w.producer, vintage: w.vintage, wine_id: w.id })),
    );
    setSaving(false);
    if (result.error) { setError("Kunde inte lägga till viner"); return; }
    setSelectedIds(new Set());
    setCellarFilter("");
    setExpanded(false);
    onWinesAdded?.();
  }

  async function handleArticleLookup() {
    const trimmed = articleNo.trim();
    if (!/^\d{4,7}$/.test(trimmed)) { setError("Ange 4–7 siffror"); return; }
    setSaving(true);
    setError(null);
    const match = await findCatalogMatch({ systembolagetProductId: trimmed });
    if (!match) { setSaving(false); setError("Ingen träff — prova Sök istället"); return; }
    const result = await addWineToSession({
      session_id: sessionId, position: wineCount + 1,
      name: match.name, producer: match.producer || null,
      vintage: match.vintage ?? null, wine_id: null,
    });
    setSaving(false);
    if (result.error) { setError("Kunde inte lägga till vin"); return; }
    setArticleNo("");
    onWinesAdded?.();
  }

  async function handleSearchSelect(wineName: string, parentName?: string | null) {
    setSaving(true);
    setError(null);
    const result = await addWineToSession({
      session_id: sessionId,
      position: wineCount + 1,
      name: wineName,
      producer: parentName || null,
      vintage: null,
      wine_id: null,
    });
    setSaving(false);
    if (result.error) { setError("Kunde inte lägga till vin"); return; }
    onWinesAdded?.();
  }

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>{expanded ? "Dölj" : "+ Lägg till vin"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        <View style={s.formSection}>
          <SuggestionRow title="Källa" options={["Sök", "Från källaren", "Artikelnr"]}
            selected={source === "manual" ? "Sök" : source === "cellar" ? "Från källaren" : "Artikelnr"}
            onSelect={(v: string) => setSource(v === "Sök" ? "manual" : v === "Artikelnr" ? "article" : "cellar")} />

          {source === "article" ? (
            <>
              <LabeledInput label="Artikelnummer" value={articleNo}
                onChangeText={(v) => { setArticleNo(v.replace(/\D/g, "")); setError(null); }}
                placeholder="t.ex. 12345" keyboardType="number-pad" />
              <Pressable onPress={handleArticleLookup} style={s.primaryBtn} disabled={saving || articleNo.length === 0}>
                <Text style={s.primaryBtnText}>{saving ? "Söker..." : "Lägg till"}</Text>
              </Pressable>
            </>
          ) : source === "cellar" ? (
            <>
              <LabeledInput label="Filtrera" value={cellarFilter}
                onChangeText={setCellarFilter} placeholder="Sök bland dina viner..." />
              {filteredCellarWines.map((w) => (
                <Pressable key={w.id} style={[s.cellarPick, selectedIds.has(w.id) && s.cellarPickSelected]}
                  onPress={() => toggleWine(w.id)}>
                  <Text style={s.cellarPickName}>{selectedIds.has(w.id) ? "☑ " : "☐ "}{w.name}</Text>
                  <Text style={s.cellarPickMeta}>{[w.producer, w.vintage].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              ))}
              {selectedIds.size > 0 ? (
                <Pressable onPress={handleBatchAdd} style={s.primaryBtn} disabled={saving}>
                  <Text style={s.primaryBtnText}>
                    {saving ? "Lägger till..." : `Lägg till ${selectedIds.size} vin${selectedIds.size > 1 ? "er" : ""}`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <AutocompleteInput label="Sök vin" value={searchQuery} onChangeText={setSearchQuery}
              onOptionSelected={(name, producer) => { setSearchQuery(""); handleSearchSelect(name, producer); }}
              options={[]} searchAsync={searchWineNames}
              placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />
          )}

          <InlineError message={error} />
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
  cellarPickSelected: { borderColor: colors.accent, borderWidth: 2 },
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
