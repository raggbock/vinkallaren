import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AvatarRow } from "./avatar";
import { getPersonalProgress, getWineProgress, isAllDone } from "../lib/session-progress";
import { styles as theme, colors } from "../styles/theme";
import type { SessionDishRow, SessionParticipant, SessionTastingRow, SessionToast, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import { SessionDishes } from "./session-dishes";

export { isAllDone } from "../lib/session-progress";

type ActiveSessionViewProps = {
  session: TastingSessionRow;
  userId: string;
  wines: SessionWineRow[];
  tastings: SessionTastingRow[];
  toasts: SessionToast[];
  participants: SessionParticipant[];
  dishes: SessionDishRow[];
  onAddDish: (name: string) => void;
  onRemoveDish: (dishId: string) => void;
  onTasteWine: (wine: SessionWineRow) => void;
  onBack: () => void;
  children?: ReactNode;
};

export function ActiveSessionView({
  session, userId, wines, tastings, toasts, participants, dishes, onAddDish, onRemoveDish, onTasteWine, onBack, children,
}: ActiveSessionViewProps) {
  const progress = getPersonalProgress(userId, wines, tastings);
  const progressPct = progress.total > 0 ? progress.tasted / progress.total : 0;
  const wineProgressMap = getWineProgress(wines, tastings);

  return (
    <>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={s.badgeRow}>
            <View style={theme.infoBadge}>
              <Text style={theme.infoBadgeText}>{session.mode === "blind" ? "Blind" : "Öppen"}</Text>
            </View>
            <View style={theme.infoBadge}>
              <Text style={theme.infoBadgeText}>{session.format.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={s.title}>{session.title}</Text>
          {participants.length > 0 ? (
            <View style={s.participantRow}>
              <AvatarRow participants={participants} size={24} />
              <Text style={s.meta}>{wines.length} viner</Text>
            </View>
          ) : (
            <Text style={s.meta}>{wines.length} viner</Text>
          )}
          {/* Progress bar */}
          {progress.total > 0 ? (
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${Math.round(progressPct * 100)}%` as unknown as number }]} />
              <Text style={s.progressLabel}>{progress.tasted}/{progress.total} provade</Text>
            </View>
          ) : null}
        </View>
        <Pressable onPress={onBack}>
          <Text style={s.linkText}>Tillbaka</Text>
        </Pressable>
      </View>

      {/* Toasts */}
      {toasts.map((toast) => (
        <View key={toast.id} style={s.toast}>
          <Text style={s.toastText}>{toast.message}</Text>
        </View>
      ))}

      {/* Dishes */}
      <SessionDishes dishes={dishes} isHost={session.host_id === userId} onAdd={onAddDish} onRemove={onRemoveDish} />

      {/* Wine cards */}
      {wines.map((wine) => {
        const wp = wineProgressMap.get(wine.id);
        const myTasting = tastings.find((t) => t.session_wine_id === wine.id && t.user_id === userId);
        const isTasted = !!myTasting;

        return (
          <Pressable
            key={wine.id}
            style={[s.wineCard, !isTasted && s.wineCardUntasted]}
            onPress={() => onTasteWine(wine)}
          >
            <View style={s.wineCardHeader}>
              <Text style={s.winePosition}>{wine.position}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.wineCardName}>{wine.name}</Text>
                <Text style={s.wineCardMeta}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</Text>
              </View>
              <View style={s.progressDots}>
                {participants.map((p) => {
                  const done = wp?.participantsDone.has(p.user_id) ?? false;
                  return (
                    <View key={p.user_id} style={[s.dot, done && s.dotFilled]} />
                  );
                })}
              </View>
            </View>

            {/* Live average in open mode or after reveal */}
            {(session.mode === "open" || session.status !== "active") && wp?.averageRating != null ? (
              <Text style={s.avgRating}>Snitt: {wp.averageRating.toFixed(1)}/5</Text>
            ) : null}

            {/* Other tastings visible in open mode or after reveal */}
            {(session.mode === "open" || session.status !== "active") ? (
              <View style={s.otherTastings}>
                {tastings.filter((t) => t.session_wine_id === wine.id && t.user_id !== userId).map((t) => (
                  <Text key={t.id} style={s.otherTasting}>
                    {t.rating ? `${t.rating}/5` : "\u2014"}{t.notes ? ` \u201C${t.notes}\u201D` : ""}
                  </Text>
                ))}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {/* Host controls injected as children */}
      {children}
    </>
  );
}

/* ── Local styles ── */

const s = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, zIndex: 999 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 4 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  linkText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  progressTrack: { marginTop: 8, height: 20, backgroundColor: colors.surfaceAlt, borderRadius: 10, overflow: "hidden", justifyContent: "center" },
  progressFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 10 },
  progressLabel: { fontSize: 11, fontWeight: "700", color: colors.text, textAlign: "center", zIndex: 1 },
  toast: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  toastText: { color: colors.textLight, fontSize: 13, fontWeight: "600", textAlign: "center" as const },
  wineCard: { backgroundColor: colors.textLight, borderRadius: 18, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.surfaceAlt },
  wineCardUntasted: { opacity: 0.65 },
  wineCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  winePosition: { color: colors.accent, fontSize: 20, fontWeight: "700", width: 28 },
  wineCardName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  wineCardMeta: { color: colors.textSecondary, fontSize: 13 },
  progressDots: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt },
  dotFilled: { backgroundColor: colors.accent },
  avgRating: { color: colors.accent, fontSize: 13, fontWeight: "700", paddingLeft: 40 },
  otherTastings: { gap: 4, paddingLeft: 40 },
  otherTasting: { color: colors.textSecondary, fontSize: 13 },
});
