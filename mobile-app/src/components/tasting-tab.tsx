import { useEffect, useState } from "react";
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
  useEffect(() => { onFetchSessions(); }, []);
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
