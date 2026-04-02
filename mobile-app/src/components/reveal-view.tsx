import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "./avatar";
import type { SessionParticipant, SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import { averageRating, consensusLevel, stddev } from "../lib/session-results";

type Props = {
  session: TastingSessionRow;
  wines: SessionWineRow[];
  tastings: SessionTastingRow[];
  participants: SessionParticipant[];
  isHost: boolean;
  onAdvance: () => void;
  onFinish: () => void;
  onBack: () => void;
};

export function RevealView({ session, wines, tastings, participants, isHost, onAdvance, onFinish, onBack }: Props) {
  const currentWine = wines.find((w) => w.position === session.revealed_up_to) ?? null;
  const isLast = session.revealed_up_to >= wines.length;
  const wineTastings = currentWine ? tastings.filter((t) => t.session_wine_id === currentWine.id) : [];
  const participantMap = new Map(participants.map((p) => [p.user_id, p]));

  return (
    <View style={s.container}>
      {/* Progress indicator */}
      <View style={s.topRow}>
        <Pressable onPress={onBack}>
          <Text style={s.backText}>Tillbaka</Text>
        </Pressable>
        <Text style={s.progress}>{session.revealed_up_to} / {wines.length}</Text>
      </View>

      {currentWine ? (
        <RevealCard
          key={currentWine.id}
          wine={currentWine}
          tastings={wineTastings}
          participantMap={participantMap}
        />
      ) : null}

      {/* Host controls */}
      {isHost ? (
        <View style={s.controls}>
          {isLast ? (
            <Pressable onPress={onFinish} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Visa resultat</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onAdvance} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Nästa vin</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={s.waitText}>
          {isLast ? "Värden visar snart resultaten..." : "Väntar på att värden avslöjar nästa vin..."}
        </Text>
      )}

      {/* Previously revealed wines (collapsed) */}
      {wines.filter((w) => w.position < session.revealed_up_to).reverse().map((w) => {
        const wt = tastings.filter((t) => t.session_wine_id === w.id);
        const avg = averageRating(wt.map((t) => t.rating));
        return (
          <View key={w.id} style={s.prevWine}>
            <Text style={s.prevPosition}>{w.position}</Text>
            <Text style={s.prevName}>{w.name}</Text>
            {avg != null ? <Text style={s.prevRating}>{avg.toFixed(1)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function RevealCard({ wine, tastings, participantMap }: {
  wine: SessionWineRow;
  tastings: SessionTastingRow[];
  participantMap: Map<string, SessionParticipant>;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [showRatings, setShowRatings] = useState(false);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    setShowRatings(false);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => setShowRatings(true), 300);
    });
  }, [wine.id]);

  const ratings = tastings.map((t) => t.rating).filter((r): r is number => r != null);
  const avg = averageRating(tastings.map((t) => t.rating));
  const spread = stddev(ratings);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={s.winePosition}>Vin #{wine.position}</Text>
      <Text style={s.wineName}>{wine.name}</Text>
      <Text style={s.wineMeta}>
        {[wine.producer, wine.country, wine.vintage].filter(Boolean).join(" · ")}
      </Text>

      {showRatings ? (
        <View style={s.ratingsSection}>
          {tastings.filter((t) => t.rating != null).map((t, i) => {
            const p = participantMap.get(t.user_id);
            return (
              <RatingRow key={t.id} participant={p ?? null} rating={t.rating!} notes={t.notes} delay={i * 200} />
            );
          })}
          {avg != null ? (
            <View style={s.summaryRow}>
              <Text style={s.avgLabel}>Snitt: {avg.toFixed(1)}/5</Text>
              <View style={[s.consensusBadge, consensusLevel(spread) === "high" ? s.consensusHigh : s.consensusLow]}>
                <Text style={[s.consensusText, consensusLevel(spread) === "high" ? s.consensusTextHigh : s.consensusTextLow]}>
                  {consensusLevel(spread) === "high" ? "Eniga" : "Delade"}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

function RatingRow({ participant, rating, notes, delay }: {
  participant: SessionParticipant | null; rating: number; notes: string | null; delay: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.ratingRow, { opacity: fadeAnim }]}>
      <Avatar displayName={participant?.display_name ?? null} userId={participant?.user_id ?? ""} avatarColor={participant?.avatar_color} size={28} />
      <Text style={s.ratingName}>{participant?.display_name ?? "Anonym"}</Text>
      <Text style={s.ratingValue}>{rating}/5</Text>
      {notes ? <Text style={s.ratingNotes} numberOfLines={1}>"{notes}"</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backText: { color: "#6f1d1b", fontWeight: "600", fontSize: 14 },
  progress: { color: "#564a40", fontSize: 13, fontWeight: "700" },
  card: { backgroundColor: "#fffaf5", borderRadius: 22, padding: 20, gap: 8, borderWidth: 1, borderColor: "#ead8ca" },
  winePosition: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  wineName: { color: "#231815", fontSize: 22, fontWeight: "800" },
  wineMeta: { color: "#564a40", fontSize: 14 },
  ratingsSection: { marginTop: 12, gap: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingName: { color: "#231815", fontSize: 14, fontWeight: "600", flex: 1 },
  ratingValue: { color: "#6f1d1b", fontSize: 16, fontWeight: "800" },
  ratingNotes: { color: "#564a40", fontSize: 12, flex: 1 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ead8ca" },
  avgLabel: { color: "#6f1d1b", fontSize: 16, fontWeight: "800" },
  consensusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  consensusHigh: { backgroundColor: "rgba(120,180,100,0.15)" },
  consensusLow: { backgroundColor: "rgba(200,120,80,0.15)" },
  consensusText: { fontSize: 12, fontWeight: "700" },
  consensusTextHigh: { color: "#5a8a4a" },
  consensusTextLow: { color: "#c87850" },
  controls: { marginTop: 4 },
  primaryBtn: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { color: "#fffaf5", fontWeight: "700", fontSize: 16 },
  waitText: { color: "#564a40", fontSize: 14, textAlign: "center", fontStyle: "italic" },
  prevWine: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#ead8ca", borderRadius: 12, padding: 10 },
  prevPosition: { color: "#6f1d1b", fontSize: 14, fontWeight: "700", width: 24 },
  prevName: { color: "#231815", fontSize: 14, fontWeight: "600", flex: 1 },
  prevRating: { color: "#6f1d1b", fontSize: 14, fontWeight: "700" },
});
