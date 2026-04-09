import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles as theme, colors } from "../styles/theme";
import { Avatar } from "./avatar";
import { Expandable } from "./form-controls";
import { getWsetParameterComparison, getSharedAromas, type SessionResults, type WineResult } from "../lib/session-results";
import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import type { SessionParticipant } from "../types/tasting-session";
import { formatDateShort } from "../lib/format-date";

type Props = {
  results: SessionResults;
  participants: SessionParticipant[];
  onBack: () => void;
};

export function ResultsDashboard({ results, participants, onBack }: Props) {
  const participantMap = new Map(participants.map((p) => [p.user_id, p]));

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>Tillbaka</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <StatBox label="Viner" value={String(results.wineCount)} />
        <StatBox label="Deltagare" value={String(results.participantCount)} />
        <StatBox label="Datum" value={formatDateShort(results.date)} />
      </View>

      {/* Highlights */}
      {results.favorite ? (
        <HighlightCard
          title="Gruppens favorit"
          wineName={results.favorite.wine.name}
          detail={results.format === "quick"
            ? `${results.favorite.averageRating?.toFixed(1)} snitt`
            : results.favorite.averageQuality ?? ""}
        />
      ) : null}
      {results.mostDivided ? (
        <HighlightCard
          title="Mest delade meningar"
          wineName={results.mostDivided.wine.name}
          detail={`Spridning: ${results.mostDivided.ratingSpread.toFixed(1)}`}
        />
      ) : null}

      {/* Wine list */}
      {results.wines.map((wr, i) => (
        <WineResultCard
          key={wr.wine.id}
          rank={i + 1}
          result={wr}
          format={results.format}
          participantMap={participantMap}
        />
      ))}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={theme.statBox}>
      <Text style={theme.statBoxValue}>{value}</Text>
      <Text style={theme.statBoxLabel}>{label}</Text>
    </View>
  );
}

function HighlightCard({ title, wineName, detail }: { title: string; wineName: string; detail: string }) {
  return (
    <View style={s.highlight}>
      <Text style={s.highlightTitle}>{title}</Text>
      <Text style={s.highlightWine}>{wineName}</Text>
      <Text style={s.highlightDetail}>{detail}</Text>
    </View>
  );
}

function WineResultCard({ rank, result, format, participantMap }: {
  rank: number;
  result: WineResult;
  format: "quick" | "wset";
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.wineCard}>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.wineCardHeader}>
        <Text style={s.rank}>{rank}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.wineName}>{result.wine.name}</Text>
          <Text style={s.wineMeta}>
            {[result.wine.producer, result.wine.vintage].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {format === "quick" && result.averageRating != null ? (
          <Text style={s.ratingBig}>{result.averageRating.toFixed(1)}</Text>
        ) : null}
        {format === "wset" && result.averageQuality ? (
          <Text style={s.qualityBadge}>{result.averageQuality}</Text>
        ) : null}
        <View style={[s.consensusBadge, result.consensus === "high" ? s.consensusHigh : s.consensusLow]}>
          <Text style={[s.consensusText, result.consensus === "high" ? s.consensusTextHigh : s.consensusTextLow]}>
            {result.consensus === "high" ? "Eniga" : "Delade"}
          </Text>
        </View>
      </Pressable>
      <Expandable expanded={expanded}>
        {format === "quick" ? (
          <QuickDetails tastings={result.tastings} participantMap={participantMap} />
        ) : (
          <WsetDetails tastings={result.tastings} participantMap={participantMap} />
        )}
      </Expandable>
    </View>
  );
}

function QuickDetails({ tastings, participantMap }: {
  tastings: WineResult["tastings"];
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  return (
    <View style={s.details}>
      {tastings.filter((t) => t.rating != null).map((t) => {
        const p = participantMap.get(t.user_id);
        return (
          <View key={t.id} style={s.participantRow}>
            <Avatar displayName={p?.display_name ?? null} userId={t.user_id} avatarColor={p?.avatar_color} size={24} />
            <Text style={s.participantName}>{p?.display_name ?? "Anonym"}</Text>
            <Text style={s.participantRating}>{t.rating}/5</Text>
            {t.notes ? <Text style={s.participantNotes}>"{t.notes}"</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function WsetDetails({ tastings, participantMap }: {
  tastings: WineResult["tastings"];
  participantMap: Map<string, { user_id: string; display_name: string | null; avatar_color: string | null }>;
}) {
  const params = getWsetParameterComparison(tastings);
  const shared = getSharedAromas(tastings);

  return (
    <View style={s.details}>
      {/* Parameter bars */}
      {params.map((p) => (
        <View key={p.param} style={s.paramRow}>
          <Text style={s.paramLabel}>{p.label}</Text>
          <View style={s.paramCounts}>
            {Object.entries(p.counts).sort((a, b) => b[1] - a[1]).map(([val, count]) => (
              <Text key={val} style={s.paramValue}>{count} {val}</Text>
            ))}
          </View>
        </View>
      ))}

      {/* Shared aromas */}
      {shared.length > 0 ? (
        <View style={s.aromaSection}>
          <Text style={s.aromaTitle}>Gemensamma aromer</Text>
          <View style={s.aromaRow}>
            {shared.map((a) => (
              <View key={a} style={s.aromaTag}><Text style={s.aromaText}>{a}</Text></View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Per-participant WSET summaries */}
      {tastings.filter((t) => t.tasting_data).map((t) => {
        const p = participantMap.get(t.user_id);
        const data = t.tasting_data as WsetTastingData;
        return (
          <View key={t.id} style={s.participantRow}>
            <Avatar displayName={p?.display_name ?? null} userId={t.user_id} avatarColor={p?.avatar_color} size={24} />
            <View style={{ flex: 1 }}>
              <Text style={s.participantName}>{p?.display_name ?? "Anonym"}</Text>
              <Text style={s.wsetSummary}>{buildWsetSummary(data)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12 },
  header: { flexDirection: "row", justifyContent: "flex-end" },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8 },
  highlight: { backgroundColor: colors.textLight, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.surfaceAlt },
  highlightTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  highlightWine: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
  highlightDetail: { color: colors.accent, fontSize: 13, fontWeight: "600", marginTop: 2 },
  wineCard: { backgroundColor: colors.textLight, borderRadius: 18, borderWidth: 1, borderColor: colors.surfaceAlt, overflow: "hidden" },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  rank: { color: colors.accent, fontSize: 18, fontWeight: "800", width: 28 },
  wineName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  wineMeta: { color: colors.textSecondary, fontSize: 12 },
  ratingBig: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  qualityBadge: { color: colors.accent, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  consensusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  consensusHigh: { backgroundColor: "rgba(120,180,100,0.15)" },
  consensusLow: { backgroundColor: "rgba(200,120,80,0.15)" },
  consensusText: { fontSize: 11, fontWeight: "700" },
  consensusTextHigh: { color: "#5a8a4a" },
  consensusTextLow: { color: "#c87850" },
  details: { gap: 10, padding: 14, paddingTop: 0 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  participantName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  participantRating: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  participantNotes: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  paramRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paramLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", width: 100 },
  paramCounts: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  paramValue: { color: colors.text, fontSize: 12, backgroundColor: colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  aromaSection: { gap: 4 },
  aromaTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  aromaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  aromaTag: { backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  aromaText: { color: colors.accent, fontSize: 11, fontWeight: "600" },
  wsetSummary: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 2 },
});
