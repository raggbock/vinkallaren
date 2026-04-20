import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { PanelHeader } from "./form-controls";
import type { CreateSessionInput, TastingSessionRow } from "../types/tasting-session";
import { CreateForm, JoinForm } from "./session-forms";
import { colors, serifFont, styles } from "../styles/theme";
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

function TitleBlock({ title, sub }: { title: string; sub: string }) {
  return (
    <View>
      <Text style={local.title}>{title}</Text>
      <Text style={local.sub}>{sub}</Text>
    </View>
  );
}

export function TastingTab({ sessions, loading, onCreateSession, onJoinSession, onOpenSession, onOpenProfile, onFetchSessions }: Props) {
  useEffect(() => { onFetchSessions(); }, []);
  const [view, setView] = useState<"list" | "create" | "join">("list");
  const [error, setError] = useState<string | null>(null);

  const activeSessions = sessions.filter((s) => s.status === "setup" || s.status === "active");
  const endedSessions = sessions.filter((s) => s.status === "ended" || s.status === "revealing");

  if (view === "create") {
    return (
      <View style={styles.panel}>
        <PanelHeader rightLabel="Avbryt" onRightPress={() => setView("list")} />
        <TitleBlock title="Ny provning" sub="Bjud in vänner och bestäm format" />
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
        <PanelHeader rightLabel="Avbryt" onRightPress={() => setView("list")} />
        <TitleBlock title="Gå med" sub="Skriv in koden du fått" />
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
      <PanelHeader rightLabel="Profil" onRightPress={onOpenProfile} />
      <TitleBlock title="Provning" sub="Blindprova med vänner" />

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
          <Text style={styles.eyebrow}>Pågående</Text>
          {activeSessions.map((ses) => (
            <Pressable key={ses.id} style={({ pressed }) => [local.card, pressed && { opacity: 0.65 }]} onPress={() => onOpenSession(ses)}>
              <View style={local.cardHeader}>
                <Text style={local.cardTitle} numberOfLines={1}>{ses.title}</Text>
                <Text style={[local.statusBadge, { color: statusColor(ses.status) }]}>{statusLabel(ses.status)}</Text>
              </View>
              <Text style={local.cardMeta}>{ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.eyebrow}>Avslutade</Text>
      {endedSessions.length === 0 && !loading ? (
        <Text style={local.empty}>Inga avslutade provningar ännu.</Text>
      ) : null}
      {endedSessions.map((ses) => (
        <Pressable key={ses.id} style={({ pressed }) => [local.card, pressed && { opacity: 0.65 }]} onPress={() => onOpenSession(ses)}>
          <View style={local.cardHeader}>
            <Text style={local.cardTitle} numberOfLines={1}>{ses.title}</Text>
            <Text style={local.cardDate}>{formatDateFull(ses.created_at)}</Text>
          </View>
          <Text style={local.cardMeta}>{ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  title: { fontFamily: serifFont, color: colors.text, fontSize: 32, fontWeight: "700", lineHeight: 34 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: serifFont, color: colors.text, fontSize: 18, fontWeight: "700", flex: 1 },
  cardMeta: { color: colors.textSecondary, fontSize: 13 },
  cardDate: { color: colors.textSecondary, fontSize: 12, fontStyle: "italic" },
  statusBadge: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  empty: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic" },
  error: { color: colors.accent, fontSize: 13 },
});
