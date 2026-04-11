import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";

import { buildCustomPairings, FOOD_CATEGORIES } from "../lib/cellar-helpers";
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

import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";
import { WineGlassDoodle, SquigglyLine, TabIconCellar, TabIconAdd, TabIconTasting, TabIconHistory } from "./doodles";
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


export function MealPlannerPanel({
  styles,
  wines,
  selectedMeal,
  mealRecommendations,
  onSelectMeal,
  onWinePress,
  onOpenProfile,
}: {
  styles: SharedStyles;
  wines: WineRecord[];
  selectedMeal: string;
  mealRecommendations: WineRecord[];
  onSelectMeal: (value: string) => void;
  onWinePress?: (wine: WineRecord) => void;
  onOpenProfile?: () => void;
}) {
  const customPairings = useMemo(() => buildCustomPairings(wines), [wines]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleCategory = useCallback((label: string) => {
    setExpandedCategory((prev) => (prev === label ? null : label));
  }, []);

  const allCategories = useMemo(() => {
    const cats = [...FOOD_CATEGORIES];
    if (customPairings.length > 0) cats.push({ label: "Övriga", items: customPairings });
    return cats;
  }, [customPairings]);

  return (
    <View style={styles.panel}>
      <PanelHeader title="Vad ska vi äta?" rightLabel="Profil" onRightPress={onOpenProfile} />

      {selectedMeal ? (
        <Pressable onPress={() => onSelectMeal("")} style={({ pressed }) => [mealStyles.selectedChip, pressed && { opacity: 0.7 }]}>
          <Text style={mealStyles.selectedChipText}>{selectedMeal}</Text>
          <Text style={mealStyles.selectedChipClear}>✕</Text>
        </Pressable>
      ) : null}

      {allCategories.map((category) => {
        const isExpanded = expandedCategory === category.label;
        const hasSelection = category.items.includes(selectedMeal);
        return (
          <View key={category.label} style={styles.foodCategoryGroup}>
            <Pressable
              onPress={() => toggleCategory(category.label)}
              style={({ pressed }) => [mealStyles.categoryRow, isExpanded && mealStyles.categoryRowExpanded, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.foodCategoryLabel, hasSelection && styles.foodCategoryLabelActive]}>
                {category.label}
              </Text>
              <Text style={styles.foodCategoryChevron}>{isExpanded ? "▾" : "›"}</Text>
            </Pressable>
            {isExpanded && (
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
            )}
          </View>
        );
      })}

      {selectedMeal ? <SquigglyLine /> : null}

      {selectedMeal && mealRecommendations.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
          <WineGlassDoodle size={44} />
          <Text style={styles.emptyState}>Inga viner matchar "{selectedMeal}" ännu.</Text>
        </View>
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

  const sessionCount = endedSessions?.length ?? 0;

  const listHeader = useMemo(() => (
    <View style={{ gap: 14 }}>
      <PanelHeader title="Historik" rightLabel="Profil" onRightPress={onOpenProfile} />

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
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
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
  ), [styles, tab, sessionCount, filteredEntries.length, historyEntries.length, searchQuery, endedSessions, loadingHistory, onOpenProfile]);

  return (
    <FlatList
      data={tab === "viner" ? filteredEntries : []}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
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
            />
          </View>
        ) : expanded && !loaded ? (
          <LoadingInline label="Laddar resultat..." />
        ) : null}
      </Expandable>
    </View>
  );
}

const HistoryRow = React.memo(function HistoryRow({ entry, styles, onEdit }: {
  entry: WineHistoryRecord; styles: SharedStyles; onEdit?: (entry: WineHistoryRecord) => void;
}) {
  return (
    <View style={styles.wineCard}>
      <View style={styles.wineCardHeader}>
        {entry.image_url ? (
          <Image source={{ uri: entry.image_url }} style={styles.wineThumbnail} resizeMode="cover" accessibilityLabel={`Bild på ${entry.name}`} />
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
      <Text style={historyStyles.consumedText}>
        Dracks {formatDateISO(entry.consumed_at)} · {entry.quantity_consumed} flaska
        {entry.quantity_consumed > 1 ? "r" : ""}
      </Text>
      {entry.tasting_notes ? <Text style={styles.notesText}>{entry.tasting_notes}</Text> : null}
      {entry.tasting_data ? (
        <View style={historyStyles.wsetSection}>
          <Text style={historyStyles.wsetLabel}>WSET Tasting</Text>
          <Text style={styles.notesText}>{buildWsetSummary(entry.tasting_data as WsetTastingData)}</Text>
        </View>
      ) : null}
      {onEdit ? (
        <Pressable onPress={() => onEdit(entry)} style={({ pressed }) => [historyStyles.editButton, pressed && { opacity: 0.6 }]}>
          <Text style={historyStyles.editButtonText}>Redigera</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const mealStyles = StyleSheet.create({
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedChipText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  selectedChipClear: { color: colors.surfaceAlt, fontSize: 12 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.textLight,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  categoryRowExpanded: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
});

const historyStyles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: 0, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.textLight },
  editButton: { marginTop: 8, alignSelf: "flex-start", backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  editButtonText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionInfo: { flex: 1, gap: 4 },
  sessionResults: { marginTop: 12 },
  sessionList: { gap: 10 },
  consumedText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  wsetSection: { marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  wsetLabel: { color: colors.textSecondary, fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
});
