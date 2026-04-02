import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles as theme } from "../styles/theme";
import { Avatar } from "./avatar";
import { PanelHeader } from "./form-controls";
import { shareSession } from "../lib/session-actions";
import type { SessionParticipant, SessionWineRow, TastingSessionRow } from "../types/tasting-session";

type Props = {
  session: TastingSessionRow;
  wines: SessionWineRow[];
  participants: SessionParticipant[];
  isHost: boolean;
  onStart: () => void;
  onBack: () => void;
  children?: React.ReactNode; // AddWineForm slot for host
};

export function SessionSetupView({ session, wines, participants, isHost, onStart, onBack, children }: Props) {
  return (
    <View style={s.container}>
      <PanelHeader title="Provning" rightLabel="Tillbaka" onRightPress={onBack} />

      {/* Session info */}
      <View style={s.infoCard}>
        <Text style={s.title}>{session.title}</Text>
        <View style={s.badgeRow}>
          <View style={theme.infoBadge}>
            <Text style={theme.infoBadgeText}>{session.mode === "blind" ? "Blind" : "Öppen"}</Text>
          </View>
          <View style={theme.infoBadge}>
            <Text style={theme.infoBadgeText}>{session.format.toUpperCase()}</Text>
          </View>
          {session.free_order ? (
            <View style={theme.infoBadge}>
              <Text style={theme.infoBadgeText}>Valfri ordning</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.joinCode}>Kod: {session.join_code}</Text>
      </View>

      {/* Share button */}
      <Pressable onPress={() => shareSession(session.title, session.join_code)} style={theme.primaryButton}>
        <Text style={theme.primaryButtonText}>Bjud in deltagare</Text>
      </Pressable>

      {/* SessionParticipants */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Deltagare ({participants.length})</Text>
        {participants.length === 0 ? (
          <Text style={s.hint}>Väntar på deltagare...</Text>
        ) : (
          <View style={s.participantList}>
            {participants.map((p) => (
              <View key={p.user_id} style={s.participantRow}>
                <Avatar displayName={p.display_name} userId={p.user_id} avatarColor={p.avatar_color} size={36} />
                <Text style={s.participantName}>{p.display_name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Wines added */}
      {wines.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Viner ({wines.length})</Text>
          {wines.map((w) => (
            <View key={w.id} style={s.wineRow}>
              <Text style={s.winePosition}>{w.position}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.wineName}>{w.name}</Text>
                {w.producer ? <Text style={s.wineMeta}>{w.producer}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Host: add wine form + start button */}
      {children}

      {isHost ? (
        <Pressable
          onPress={onStart}
          style={[s.startBtn, wines.length === 0 && s.startBtnDisabled]}
          disabled={wines.length === 0}
        >
          <Text style={s.startBtnText}>
            {wines.length === 0 ? "Lägg till minst ett vin" : "Starta provningen"}
          </Text>
        </Pressable>
      ) : (
        <View style={s.waitCard}>
          <Text style={s.waitText}>Väntar på att värden startar provningen...</Text>
        </View>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  infoCard: { backgroundColor: "#fffaf5", borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: "#ead8ca", alignItems: "center" },
  title: { color: "#231815", fontSize: 22, fontWeight: "800", textAlign: "center" },
  badgeRow: { flexDirection: "row", gap: 6 },
  joinCode: { color: "#564a40", fontSize: 14, fontWeight: "600" },
  section: { gap: 8 },
  sectionTitle: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { color: "#8f8178", fontSize: 13, fontStyle: "italic" },
  participantList: { gap: 8 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  participantName: { color: "#231815", fontSize: 15, fontWeight: "600" },
  wineRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffaf5", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#ead8ca" },
  winePosition: { color: "#6f1d1b", fontSize: 16, fontWeight: "700", width: 24 },
  wineName: { color: "#231815", fontSize: 14, fontWeight: "600" },
  wineMeta: { color: "#564a40", fontSize: 12 },
  startBtn: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: "#fffaf5", fontWeight: "800", fontSize: 17 },
  waitCard: { backgroundColor: "rgba(244,195,140,0.12)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(244,195,140,0.2)" },
  waitText: { color: "#c4a882", fontSize: 14, textAlign: "center", fontStyle: "italic" },
});
