import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./avatar";
import { shareSession } from "../lib/session-actions";
import type { SessionWineRow, TastingSessionRow } from "../types/tasting-session";

const logoBanner = require("../../assets/logo-banner.png");

type Participant = { user_id: string; display_name: string; avatar_color: string | null };

type Props = {
  session: TastingSessionRow;
  wines: SessionWineRow[];
  participants: Participant[];
  isHost: boolean;
  onStart: () => void;
  onBack: () => void;
  children?: React.ReactNode; // AddWineForm slot for host
};

export function SessionSetupView({ session, wines, participants, isHost, onStart, onBack, children }: Props) {
  return (
    <View style={s.container}>
      {/* Logo */}
      <Image source={logoBanner} style={s.logo} resizeMode="contain" />

      {/* Session info */}
      <View style={s.infoCard}>
        <Text style={s.title}>{session.title}</Text>
        <View style={s.badgeRow}>
          <View style={s.badge}>
            <Text style={s.badgeText}>{session.mode === "blind" ? "Blind" : "Öppen"}</Text>
          </View>
          <View style={s.badge}>
            <Text style={s.badgeText}>{session.format.toUpperCase()}</Text>
          </View>
          {session.free_order ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>Valfri ordning</Text>
            </View>
          ) : null}
        </View>
        <Text style={s.joinCode}>Kod: {session.join_code}</Text>
      </View>

      {/* Share button */}
      <Pressable onPress={() => shareSession(session.title, session.join_code)} style={s.shareBtn}>
        <Text style={s.shareBtnText}>Bjud in deltagare</Text>
      </Pressable>

      {/* Participants */}
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

      {/* Back */}
      <Pressable onPress={onBack} style={s.backBtn}>
        <Text style={s.backBtnText}>Tillbaka</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 14 },
  logo: { width: "100%", height: 120 },
  infoCard: { backgroundColor: "#fffaf5", borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: "#ead8ca", alignItems: "center" },
  title: { color: "#231815", fontSize: 22, fontWeight: "800", textAlign: "center" },
  badgeRow: { flexDirection: "row", gap: 6 },
  badge: { backgroundColor: "#ead8ca", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: "#6f1d1b", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  joinCode: { color: "#564a40", fontSize: 14, fontWeight: "600" },
  shareBtn: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  shareBtnText: { color: "#fffaf5", fontWeight: "700", fontSize: 15 },
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
  backBtn: { alignItems: "center", paddingVertical: 8 },
  backBtnText: { color: "#6f1d1b", fontSize: 14, fontWeight: "600" },
});
