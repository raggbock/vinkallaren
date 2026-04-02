import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { FOOD_CATEGORIES } from "../lib/cellar-helpers";
import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { SessionParticipant, TastingSessionRow } from "../types/tasting-session";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WineRecord } from "../types/wine";
import type { CellarSection } from "../types/cellar";
import { Expandable, LoadingInline, PanelHeader } from "./form-controls";
import { fetchSessionWines, fetchSessionTastings, fetchSessionParticipants } from "../lib/session-actions";
import { formatDateFull, formatDateISO } from "../lib/format-date";
import { buildSessionResults } from "../lib/session-results";
import { ResultsDashboard } from "./results-dashboard";
import type { SessionWineRow, SessionTastingRow } from "../types/tasting-session";

import type { styles as themeStyles } from "../styles/theme";
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
  const TAB_ICONS: Record<string, string> = {
    cellar: "🍷",
    add: "＋",
    meal: "🍽",
    history: "📖",
  };

  return (
    <View style={styles.bottomTabBar}>
      {sections.map((section) => {
        const isActive = activeSection === section.key;

        return (
          <Pressable
            key={section.key}
            onPress={() => onSelect(section.key)}
            style={styles.bottomTab}
          >
            <Text style={[styles.bottomTabIcon, isActive && styles.bottomTabIconActive]}>
              {TAB_ICONS[section.key] || "•"}
            </Text>
            <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


export function MealPlannerPanel({
  styles,
  selectedMeal,
  mealRecommendations,
  onSelectMeal,
  onWinePress,
}: {
  styles: SharedStyles;
  selectedMeal: string;
  mealRecommendations: WineRecord[];
  onSelectMeal: (value: string) => void;
  onWinePress?: (wine: WineRecord) => void;
}) {
  return (
    <View style={styles.panel}>
      <PanelHeader title="Vad ska vi äta?" rightLabel={selectedMeal || undefined} />

      {FOOD_CATEGORIES.map((category) => (
        <View key={category.label} style={styles.foodCategoryGroup}>
          <Text style={styles.foodCategoryLabel}>{category.label}</Text>
          <View style={styles.tagRow}>
            {category.items.map((item) => {
              const isSelected = selectedMeal === item;
              return (
                <Pressable
                  key={`food-${item}`}
                  onPress={() => onSelectMeal(isSelected ? "" : item)}
                  style={[styles.foodPill, isSelected && styles.foodPillActive]}
                >
                  <Text style={[styles.foodText, isSelected && styles.foodTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {selectedMeal && mealRecommendations.length === 0 ? (
        <Text style={styles.emptyState}>Inga viner matchar "{selectedMeal}" ännu.</Text>
      ) : null}

      {mealRecommendations.map((wine) => (
        <Pressable key={`meal-${wine.id}`} onPress={() => onWinePress?.(wine)} style={styles.recommendationCard}>
          <View style={styles.recommendationHeader}>
            <View style={styles.flex}>
              <Text style={styles.wineType}>{wine.type}</Text>
              <Text style={styles.recommendationName}>{wine.name}</Text>
              <Text style={styles.wineMeta}>{[wine.producer, wine.grape, wine.country].filter(Boolean).join(" • ")}</Text>
            </View>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityBadgeText}>{wine.quantity} st</Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            {wine.food_pairings.map((pairing) => (
              <View key={`recommend-${wine.id}-${pairing}`} style={[styles.foodPill, pairing === selectedMeal && styles.foodPillActive]}>
                <Text style={[styles.foodText, pairing === selectedMeal && styles.foodTextActive]}>{pairing}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function HistoryPanel({
  styles, historyEntries, loadingHistory, storageSpaceById,
  endedSessions,
  refreshing, onRefresh, hasMore, onLoadMore,
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
    <HistoryRow entry={item} styles={styles} />
  ), [styles]);

  const sessionCount = endedSessions?.length ?? 0;

  const listHeader = useMemo(() => (
    <>
      <PanelHeader title="Historik" />

      {/* Sub-tabs */}
      <View style={historyStyles.tabRow}>
        <Pressable onPress={() => setTab("viner")} style={[historyStyles.tab, tab === "viner" && historyStyles.tabActive]}>
          <Text style={[historyStyles.tabText, tab === "viner" && historyStyles.tabTextActive]}>Viner</Text>
        </Pressable>
        <Pressable onPress={() => setTab("provningar")} style={[historyStyles.tab, tab === "provningar" && historyStyles.tabActive]}>
          <Text style={[historyStyles.tabText, tab === "provningar" && historyStyles.tabTextActive]}>Provningar{sessionCount > 0 ? ` (${sessionCount})` : ""}</Text>
        </Pressable>
      </View>

      {tab === "viner" && historyEntries.length > 0 ? (
        <TextInput
          style={styles.input}
          placeholder="Sök namn, producent, årgång..."
          placeholderTextColor="#8f8178"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      ) : null}

      {tab === "provningar" ? (
        <View style={{ gap: 10 }}>
          {sessionCount === 0 ? (
            <Text style={styles.emptyState}>Inga avslutade provningar ännu.</Text>
          ) : (
            endedSessions!.map((ses) => (
              <ExpandableSessionCard key={ses.id} session={ses} styles={styles} />
            ))
          )}
        </View>
      ) : null}

      {tab === "viner" && loadingHistory ? <LoadingInline label="Laddar historik..." /> : null}

      {tab === "viner" && !loadingHistory && historyEntries.length === 0 ? (
        <Text style={styles.emptyState}>Ingen historik ännu. När du markerar att du druckit en flaska kan du sätta betyg här.</Text>
      ) : null}

      {tab === "viner" && !loadingHistory && historyEntries.length > 0 && filteredEntries.length === 0 ? (
        <Text style={styles.emptyState}>Inga träffar för "{searchQuery}"</Text>
      ) : null}
    </>
  ), [styles, tab, sessionCount, filteredEntries.length, historyEntries.length, searchQuery, endedSessions, loadingHistory]);

  return (
    <FlatList
      data={tab === "viner" ? filteredEntries : []}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      contentContainerStyle={[styles.scrollContent, styles.panel]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} /> : undefined
      }
      onEndReached={tab === "viner" && hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={tab === "viner" && hasMore ? <ActivityIndicator style={{ padding: 16 }} color="#6f1d1b" /> : null}
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
      <Pressable onPress={handleToggle} style={{ gap: 4 }}>
        <Text style={styles.wineName}>{session.title}</Text>
        <Text style={styles.wineMeta}>
          {session.mode === "blind" ? "Blind" : "Öppen"} · {session.format.toUpperCase()} · {dateStr}
        </Text>
      </Pressable>
      <Expandable expanded={expanded}>
        {loaded && wines.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <ResultsDashboard
              results={buildSessionResults(wines, tastings, session.format, session.created_at)}
              participants={participants}
              onBack={() => setExpanded(false)}
            />
          </View>
        ) : expanded && !loaded ? (
          <LoadingInline label="Laddar resultat..." />
        ) : null}
      </Expandable>
    </View>
  );
}

const HistoryRow = React.memo(function HistoryRow({ entry, styles }: {
  entry: WineHistoryRecord; styles: SharedStyles;
}) {
  return (
    <View style={styles.wineCard}>
      <View style={styles.wineCardHeader}>
        {entry.image_url ? (
          <Image source={{ uri: entry.image_url }} style={styles.wineThumbnail} resizeMode="cover" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.wineType}>{entry.type || "Historik"}</Text>
          <Text style={styles.wineName}>{entry.name}</Text>
          <Text style={styles.wineMeta}>
            {[entry.producer, entry.vintage, entry.grape, [entry.country, entry.region].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        </View>
        {entry.rating ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.notesText}>
        Dracks {formatDateISO(entry.consumed_at)} • {entry.quantity_consumed} flaska
        {entry.quantity_consumed > 1 ? "r" : ""}
      </Text>
      {entry.tasting_notes ? <Text style={styles.notesText}>{entry.tasting_notes}</Text> : null}
      {entry.tasting_data ? (
        <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#3d2220" }}>
          <Text style={[styles.notesText, { color: "#f4c38c", fontWeight: "600", marginBottom: 2 }]}>WSET Tasting</Text>
          <Text style={styles.notesText}>{buildWsetSummary(entry.tasting_data as WsetTastingData)}</Text>
        </View>
      ) : null}
    </View>
  );
});

const historyStyles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 0, backgroundColor: "#ead8ca", borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#6f1d1b" },
  tabText: { color: "#6f1d1b", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#fffaf5" },
});
