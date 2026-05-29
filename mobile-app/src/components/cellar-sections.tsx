import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import type { StorageSpaceRow } from "../types/storage-space";
import type { SessionParticipant, TastingSessionRow } from "../types/tasting-session";
import type { WineHistoryRecord } from "../types/wine-history";
import type { CellarSection } from "../types/cellar";
import { Expandable, InsightCard, LoadingInline, PanelHeader } from "./form-controls";
import { buildHistoryStats } from "../lib/cellar-helpers";
import { fetchSessionWines, fetchSessionTastings, fetchSessionParticipants } from "../lib/session-actions";
import { formatDateFull, formatDateShort } from "../lib/format-date";
import { buildSessionResults } from "../lib/session-results";
import { ResultsDashboard } from "./results-dashboard";
import type { SessionWineRow, SessionTastingRow } from "../types/tasting-session";

import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import { colors, serifFont } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
import { WineGlassDoodle, TabIconCellar, TabIconAdd, TabIconTasting, TabIconDiscover, TabIconHistory } from "./doodles";
type SharedStyles = typeof themeStyles;

export function BottomTabBar({
  activeSection,
  sections,
  styles,
  onSelect,
}: {
  activeSection: CellarSection;
  sections: Array<{ key: CellarSection; label: string }>;
  styles: SharedStyles;
  onSelect: (section: CellarSection) => void;
}) {
  const TAB_ICON_COMPONENTS: Record<string, React.FC<{ size?: number; color?: string }>> = {
    cellar: TabIconCellar,
    add: TabIconAdd,
    tasting: TabIconTasting,
    discover: TabIconDiscover,
    history: TabIconHistory,
  };

  return (
    <View style={styles.bottomTabBar}>
      {sections.map((section) => {
        const isActive = activeSection === section.key;
        const IconComponent = TAB_ICON_COMPONENTS[section.key];
        const iconColor = isActive ? colors.accent : colors.textSecondary;

        return (
          <Pressable
            key={section.key}
            onPress={() => onSelect(section.key)}
            style={styles.bottomTab}
          >
            {IconComponent ? <IconComponent size={22} color={iconColor} /> : <Text style={[styles.bottomTabIcon, isActive && styles.bottomTabIconActive]}>{"•"}</Text>}
            <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


export function HistoryPanel({
  styles, historyEntries, loadingHistory, storageSpaceById,
  endedSessions,
  refreshing, onRefresh, hasMore, onLoadMore,
  onEditEntry,
  onOpenProfile,
}: {
  styles: SharedStyles;
  historyEntries: WineHistoryRecord[];
  loadingHistory: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  endedSessions?: TastingSessionRow[];
  refreshing?: boolean;
  onRefresh?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onEditEntry?: (entry: WineHistoryRecord) => void;
  onOpenProfile?: () => void;
}) {
  const [tab, setTab] = useState<"viner" | "provningar">("viner");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyEntries;
    return historyEntries.filter((entry) => {
      const haystack = [entry.name, entry.producer, entry.vintage?.toString()].filter(Boolean).join(" ").toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }, [historyEntries, searchQuery]);

  const renderItem = useCallback(({ item }: { item: WineHistoryRecord }) => (
    <HistoryRow entry={item} styles={styles} onEdit={onEditEntry} />
  ), [styles, onEditEntry]);
  const renderSeparator = useCallback(() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight }} />, []);

  const sessionCount = endedSessions?.length ?? 0;
  const historyStats = useMemo(() => buildHistoryStats(historyEntries), [historyEntries]);

  const listHeader = useMemo(() => (
    <View style={{ gap: 14 }}>
      <PanelHeader rightLabel="Profil" onRightPress={onOpenProfile} />

      <View>
        <Text style={historyStyles.screenTitle}>Historik</Text>
        <Text style={historyStyles.screenSub}>Flaskor du druckit och betygsatt</Text>
      </View>

      {/* Sub-tabs */}
      <View style={historyStyles.tabRow}>
        <Pressable onPress={() => setTab("viner")} style={[historyStyles.tab, tab === "viner" && historyStyles.tabActive]}>
          <Text style={[historyStyles.tabText, tab === "viner" && historyStyles.tabTextActive]}>Viner ({historyEntries.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab("provningar")} style={[historyStyles.tab, tab === "provningar" && historyStyles.tabActive]}>
          <Text style={[historyStyles.tabText, tab === "provningar" && historyStyles.tabTextActive]}>Provningar ({sessionCount})</Text>
        </Pressable>
      </View>

      {tab === "viner" && historyEntries.length > 0 ? (
        <>
          <View style={historyStyles.statsRow}>
            <View style={historyStyles.statTan}>
              <Text style={historyStyles.statTanValue} numberOfLines={1}>{historyStats.topCountry}</Text>
              <Text style={historyStyles.statTanLabel}>mest drucket land</Text>
            </View>
            <InsightCard label="Vanligast" value={historyStats.topType} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Sök namn, producent, årgång..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
        </>
      ) : null}

      {tab === "provningar" ? (
        <View style={historyStyles.sessionList}>
          {sessionCount === 0 ? (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
              <WineGlassDoodle size={50} />
              <Text style={styles.emptyState}>Inga avslutade provningar ännu.</Text>
            </View>
          ) : (
            endedSessions!.map((ses) => (
              <ExpandableSessionCard key={ses.id} session={ses} styles={styles} />
            ))
          )}
        </View>
      ) : null}

      {tab === "viner" && loadingHistory ? <LoadingInline label="Laddar historik..." /> : null}

      {tab === "viner" && !loadingHistory && historyEntries.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
          <WineGlassDoodle size={50} />
          <Text style={styles.emptyState}>Ingen historik ännu. När du markerar att du druckit en flaska kan du sätta betyg här.</Text>
        </View>
      ) : null}

      {tab === "viner" && !loadingHistory && historyEntries.length > 0 && filteredEntries.length === 0 ? (
        <Text style={styles.emptyState}>Inga träffar för "{searchQuery}"</Text>
      ) : null}
    </View>
  ), [styles, tab, sessionCount, filteredEntries.length, historyEntries.length, searchQuery, endedSessions, loadingHistory, onOpenProfile, historyStats]);

  return (
    <FlatList
      data={tab === "viner" ? filteredEntries : []}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ItemSeparatorComponent={renderSeparator}
      ListHeaderComponent={listHeader}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.panel, { flexGrow: 1, marginHorizontal: 20, marginTop: 20, maxWidth: 520, width: "100%", alignSelf: "center" as const }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined
      }
      onEndReached={tab === "viner" && hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={tab === "viner" && hasMore ? <ActivityIndicator style={{ padding: 16 }} color={colors.accent} /> : null}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

function ExpandableSessionCard({ session, styles }: { session: TastingSessionRow; styles: SharedStyles }) {
  const [expanded, setExpanded] = useState(false);
  const [wines, setWines] = useState<SessionWineRow[]>([]);
  const [tastings, setTastings] = useState<SessionTastingRow[]>([]);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [loaded, setLoaded] = useState(false);

  function handleToggle() {
    setExpanded(!expanded);
    if (!loaded) {
      Promise.all([
        fetchSessionWines(session.id),
        fetchSessionTastings(session.id),
        fetchSessionParticipants(session.id),
      ]).then(([w, t, p]) => {
        if (w.data) setWines(w.data);
        if (t.data) setTastings(t.data);
        if (p.data) setParticipants(p.data);
        setLoaded(true);
      });
    }
  }

  const dateStr = formatDateFull(session.created_at);

  return (
    <View style={styles.wineCard}>
      <Pressable onPress={handleToggle} style={historyStyles.sessionHeader}>
        <View style={historyStyles.sessionInfo}>
          <Text style={styles.wineName}>{session.title}</Text>
          <Text style={styles.wineMeta}>
            {session.mode === "blind" ? "Blind" : "Öppen"} · {session.format.toUpperCase()} · {dateStr}
          </Text>
        </View>
        <Text style={styles.sectionChevron}>{expanded ? "▾" : "›"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        {loaded && wines.length > 0 ? (
          <View style={historyStyles.sessionResults}>
            <ResultsDashboard
              results={buildSessionResults(wines, tastings, session.format, session.created_at)}
              participants={participants}
              onBack={() => setExpanded(false)}
              isAnonymous={false}
              isHost={true}
              onCreateAccount={() => {}}
              onStartOwnTasting={() => {}}
            />
          </View>
        ) : expanded && !loaded ? (
          <LoadingInline label="Laddar resultat..." />
        ) : null}
      </Expandable>
    </View>
  );
}

const HistoryRow = React.memo(function HistoryRow({ entry, onEdit }: {
  entry: WineHistoryRecord; styles: SharedStyles; onEdit?: (entry: WineHistoryRecord) => void;
}) {
  const meta = [entry.producer, entry.vintage, entry.grape].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onEdit ? () => onEdit(entry) : undefined}
      style={({ pressed }) => [historyStyles.histRow, pressed && onEdit ? { opacity: 0.65 } : null]}
    >
      <View style={historyStyles.histDateCol}>
        <Text style={historyStyles.histDate}>{formatDateShort(entry.consumed_at)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={historyStyles.histName}>{entry.name}</Text>
        {meta ? <Text style={historyStyles.histMeta}>{meta}</Text> : null}
        {entry.tasting_notes ? (
          <Text style={historyStyles.histNote} numberOfLines={2}>{`"${entry.tasting_notes}"`}</Text>
        ) : null}
        {entry.tasting_data ? (
          <Text style={historyStyles.histWset} numberOfLines={1}>
            <Text style={historyStyles.histWsetLabel}>WSET</Text>
            {"  "}{buildWsetSummary(entry.tasting_data as WsetTastingData)}
          </Text>
        ) : null}
      </View>
      {entry.rating ? (
        <Text style={historyStyles.histRating}>
          {"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}
        </Text>
      ) : null}
    </Pressable>
  );
});

const historyStyles = StyleSheet.create({
  screenTitle: { fontFamily: serifFont, color: colors.text, fontSize: 32, fontWeight: "700", lineHeight: 34 },
  screenSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  tabRow: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.textLight },
  statsRow: { flexDirection: "row", gap: 10 },
  statTan: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center", gap: 2 },
  statTanValue: { fontFamily: serifFont, color: colors.accent, fontSize: 22, fontWeight: "800", textAlign: "center" },
  statTanLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionInfo: { flex: 1, gap: 4 },
  sessionResults: { marginTop: 12 },
  sessionList: { gap: 10 },
  histRow: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  histDateCol: { width: 48, alignItems: "center" },
  histDate: { fontFamily: serifFont, color: colors.accent, fontSize: 17, fontWeight: "500", fontStyle: "italic", lineHeight: 20, letterSpacing: 0.2 },
  histName: { fontFamily: serifFont, color: colors.text, fontSize: 18, fontWeight: "700", lineHeight: 22 },
  histMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  histNote: { color: colors.text, fontSize: 13, marginTop: 4, fontStyle: "italic", lineHeight: 18 },
  histRating: { color: colors.warm, fontSize: 13, letterSpacing: 1.5 },
  histWset: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  histWsetLabel: { color: colors.accent, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
});
