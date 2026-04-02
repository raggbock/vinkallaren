import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fetchTasteProfile, type TasteProfileData, type SessionSummary } from "../lib/taste-profile";

type Props = {
  userId: string;
  onOpenSession: (sessionId: string) => void;
};

export function TasteProfile({ userId, onOpenSession }: Props) {
  const [data, setData] = useState<TasteProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTasteProfile(userId).then((d) => { setData(d); setLoading(false); });
  }, [userId]);

  if (loading) return <Text style={s.hint}>Laddar smakprofil...</Text>;
  if (!data || !data.ready) {
    return <Text style={s.hint}>Drick mer vin! Din smakprofil byggs upp efter 2 provningar.</Text>;
  }

  return (
    <View style={s.container}>
      {/* Stats row */}
      <View style={s.statsRow}>
        <StatBox label="Provningar" value={String(data.stats.totalSessions)} />
        <StatBox label="Viner" value={String(data.stats.totalWines)} />
        <StatBox label="Format" value={data.stats.mostCommonFormat === "wset" ? "WSET" : "Snabb"} />
      </View>

      {data.stats.lastSessionDate ? (
        <Text style={s.lastSession}>
          Senaste provning: {new Date(data.stats.lastSessionDate).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}
        </Text>
      ) : null}

      {/* WSET Preferences */}
      {data.preferences.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dina smakpreferenser</Text>
          <Text style={s.sectionSub}>Baserat på viner du bedömt som bra eller bättre</Text>
          {data.preferences.map((pref) => (
            <View key={pref.label} style={s.prefRow}>
              <Text style={s.prefLabel}>{pref.label}</Text>
              <View style={s.barContainer}>
                {pref.values.map((v) => (
                  <View key={v.name} style={[s.barSegment, { flex: v.pct }]}>
                    <Text style={s.barText}>{v.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Top regions & grapes */}
      {data.topRegions.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Topp regioner</Text>
          <View style={s.tagRow}>
            {data.topRegions.map((r) => (
              <View key={r.name} style={s.tag}>
                <Text style={s.tagText}>{r.name} ({r.count})</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {data.topGrapes.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Topp druvor</Text>
          <View style={s.tagRow}>
            {data.topGrapes.map((g) => (
              <View key={g.name} style={s.tag}>
                <Text style={s.tagText}>{g.name} ({g.count})</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Session history */}
      {data.history.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Provningshistorik</Text>
          {data.history.map((ses) => (
            <SessionHistoryCard key={ses.id} session={ses} onPress={() => onOpenSession(ses.id)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SessionHistoryCard({ session, onPress }: { session: SessionSummary; onPress: () => void }) {
  const dateStr = new Date(session.date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
  return (
    <Pressable onPress={onPress} style={s.historyCard}>
      <View style={{ flex: 1 }}>
        <Text style={s.historyTitle}>{session.title}</Text>
        <Text style={s.historyMeta}>
          {dateStr} · {session.wineCount} viner · {session.format.toUpperCase()}
        </Text>
      </View>
      <Text style={s.historyArrow}>→</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { gap: 16 },
  hint: { color: "#8f8178", fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, backgroundColor: "#ead8ca", borderRadius: 14, padding: 12, alignItems: "center" },
  statValue: { color: "#6f1d1b", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#564a40", fontSize: 11, marginTop: 2 },
  lastSession: { color: "#564a40", fontSize: 12 },
  section: { gap: 8 },
  sectionTitle: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  sectionSub: { color: "#8f8178", fontSize: 11 },
  prefRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefLabel: { color: "#564a40", fontSize: 12, fontWeight: "700", width: 70 },
  barContainer: { flex: 1, flexDirection: "row", gap: 2, height: 26, borderRadius: 6, overflow: "hidden" },
  barSegment: { backgroundColor: "#ead8ca", justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  barText: { color: "#6f1d1b", fontSize: 10, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#ead8ca", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: "#6f1d1b", fontSize: 12, fontWeight: "600" },
  historyCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fffaf5", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#ead8ca" },
  historyTitle: { color: "#231815", fontSize: 14, fontWeight: "600" },
  historyMeta: { color: "#564a40", fontSize: 12 },
  historyArrow: { color: "#6f1d1b", fontSize: 16, fontWeight: "700" },
});
