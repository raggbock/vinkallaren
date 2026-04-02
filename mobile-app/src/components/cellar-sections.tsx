import { useMemo, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";

import { FOOD_CATEGORIES } from "../lib/cellar-helpers";
import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";
import type { StorageSpaceRow } from "../types/storage-space";
import type { TastingSessionRow } from "../types/tasting-session";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WineRecord } from "../types/wine";
import type { CellarSection } from "../types/cellar";
import { LoadingInline } from "./form-controls";

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
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Vad ska vi äta?</Text>
        {selectedMeal ? <Text style={styles.mealSelectedLabel}>{selectedMeal}</Text> : null}
      </View>

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
  styles,
  historyEntries,
  loadingHistory,
  storageSpaceById,
  endedSessions,
  onOpenSession,
}: {
  styles: SharedStyles;
  historyEntries: WineHistoryRecord[];
  loadingHistory: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  endedSessions?: TastingSessionRow[];
  onOpenSession?: (session: TastingSessionRow) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyEntries;
    return historyEntries.filter((entry) => {
      const haystack = [entry.name, entry.producer, entry.vintage?.toString()].filter(Boolean).join(" ").toLowerCase();
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }, [historyEntries, searchQuery]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Historik</Text>
        <Text style={styles.linkText}>{filteredEntries.length} av {historyEntries.length} poster</Text>
      </View>

      {historyEntries.length > 0 ? (
        <TextInput
          style={styles.input}
          placeholder="Sök namn, producent, årgång..."
          placeholderTextColor="#8f8178"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      ) : null}

      {endedSessions && endedSessions.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.inputLabel}>Avslutade provningar</Text>
          {endedSessions.map((ses) => (
            <Pressable key={ses.id} style={styles.wineCard} onPress={() => onOpenSession?.(ses)}>
              <Text style={styles.wineName}>{ses.title}</Text>
              <Text style={styles.wineMeta}>
                {ses.mode === "blind" ? "Blind" : "Öppen"} · {ses.format.toUpperCase()} · {new Date(ses.created_at).toLocaleDateString("sv-SE")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loadingHistory ? <LoadingInline label="Laddar historik..." /> : null}

      {!loadingHistory && historyEntries.length === 0 && (!endedSessions || endedSessions.length === 0) ? (
        <Text style={styles.emptyState}>Ingen historik ännu. När du markerar att du druckit en flaska kan du sätta betyg här.</Text>
      ) : null}

      {!loadingHistory && historyEntries.length > 0 && filteredEntries.length === 0 ? (
        <Text style={styles.emptyState}>Inga träffar för "{searchQuery}"</Text>
      ) : null}

      {filteredEntries.map((entry) => (
        <View key={entry.id} style={styles.wineCard}>
          <View style={styles.wineCardHeader}>
            {entry.image_url ? (
              <Image source={{ uri: entry.image_url }} style={{ width: 64, height: 86, borderRadius: 10, backgroundColor: "#ead8ca" }} resizeMode="cover" />
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
            Dracks {new Date(entry.consumed_at).toLocaleDateString("sv-SE")} • {entry.quantity_consumed} flaska
            {entry.quantity_consumed > 1 ? "r" : ""}
          </Text>
          {entry.tasting_notes ? <Text style={styles.notesText}>{entry.tasting_notes}</Text> : null}
          {entry.tasting_data ? (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#3d2220" }}>
              <Text style={[styles.notesText, { color: "#f4c38c", fontWeight: "600", marginBottom: 2 }]}>WSET Tasting</Text>
              <Text style={styles.notesText}>{buildWsatSummary(entry.tasting_data as WsatTastingData)}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
