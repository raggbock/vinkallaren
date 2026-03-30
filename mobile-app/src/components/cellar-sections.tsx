import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { FOOD_CATEGORIES, getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WineRecord } from "../types/wine";
import type { CellarSection } from "../types/cellar";
import { InsightCard, LabeledInput, LoadingInline, SuggestionRow } from "./form-controls";

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

function WineCard({
  wine,
  styles,
  highlighted,
  storageSpaceById,
  onOpenSystembolaget,
  onEditWine,
  onDrinkWine,
  onDeleteWine,
}: {
  wine: WineRecord;
  styles: SharedStyles;
  highlighted?: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  onOpenSystembolaget: (productId: string) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
}) {
  return (
    <View style={[styles.wineCard, highlighted && styles.wineCardHighlighted]}>
      {wine.image_url ? <Image source={{ uri: wine.image_url }} style={styles.wineImage} /> : null}

      <View style={styles.wineCardHeader}>
        <View style={styles.flex}>
          <Text style={styles.wineType}>{wine.type}</Text>
          <Text style={styles.wineName}>{wine.name}</Text>
          <Text style={styles.wineMeta}>
            {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")]
              .filter(Boolean)
              .join(" • ")}
          </Text>
          <Text style={styles.locationText}>
            {getWineStoragePlacementLabel(wine, storageSpaceById) || wine.cellar_location || "Ingen plats angiven"}
          </Text>
          {wine.cellar_location && getWineStoragePlacementLabel(wine, storageSpaceById) ? (
            <Text style={styles.notesText}>{wine.cellar_location}</Text>
          ) : null}
        </View>
        <View style={styles.quantityBadge}>
          <Text style={styles.quantityBadgeText}>{wine.quantity} st</Text>
        </View>
      </View>

      {wine.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {wine.tags.map((tag) => (
            <View key={`${wine.id}-${tag}`} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {wine.food_pairings.length > 0 ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Passar till</Text>
          <View style={styles.tagRow}>
            {wine.food_pairings.map((pairing) => (
              <View key={`${wine.id}-food-${pairing}`} style={styles.foodPill}>
                <Text style={styles.foodText}>{pairing}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {wine.systembolaget_product_id ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Importkoppling</Text>
          <Text style={styles.notesText}>Systembolaget #{wine.systembolaget_product_id}</Text>
          <Pressable onPress={() => onOpenSystembolaget(wine.systembolaget_product_id!)} style={styles.inlineLinkButton}>
            <Text style={styles.linkText}>Öppna produktsida</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.notesText}>{wine.notes || "Ingen anteckning ännu."}</Text>

      <View style={styles.actionRow}>
        <Pressable onPress={() => onEditWine(wine)}>
          <Text style={styles.linkText}>Redigera</Text>
        </Pressable>
        <Pressable onPress={() => onDrinkWine(wine)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Drack 1 flaska</Text>
        </Pressable>
        <Pressable onPress={() => onDeleteWine(wine.id, wine.image_path)}>
          <Text style={styles.dangerText}>Ta bort</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MinKallarePanel({
  styles,
  stats,
  searchQuery,
  selectedPairingFilter,
  selectedCountryFilter,
  selectedRegionFilter,
  selectedTypeFilter,
  selectedVintageFilter,
  pairingOptions,
  countryOptions,
  regionOptions,
  typeOptions,
  vintageOptions,
  storageSpaces,
  storageSpaceBottleCounts,
  filteredWines,
  loading,
  storageSpaceById,
  onRefreshStats,
  onSearchChange,
  onPairingChange,
  onCountryChange,
  onRegionChange,
  onTypeChange,
  onVintageChange,
  onSignOut,
  onOpenSystembolaget,
  onEditWine,
  onDrinkWine,
  onDeleteWine,
  highlightedWineId,
  onClearHighlight,
}: {
  styles: SharedStyles;
  stats: {
    totalBottles: number;
    totalLabels: number;
    topCountry: string;
    topType: string;
    topPairing: string;
    averageVintage: string;
  };
  searchQuery: string;
  selectedPairingFilter: string;
  selectedCountryFilter: string;
  selectedRegionFilter: string;
  selectedTypeFilter: string;
  selectedVintageFilter: string;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  storageSpaces: StorageSpaceRow[];
  storageSpaceBottleCounts: Map<string, number>;
  filteredWines: WineRecord[];
  loading: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  onRefreshStats: () => void;
  onSearchChange: (value: string) => void;
  onPairingChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onVintageChange: (value: string) => void;
  onSignOut: () => void;
  onOpenSystembolaget: (productId: string) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
}) {
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(new Set());

  function toggleSpace(spaceId: string) {
    setExpandedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  // Group filtered wines by storage space
  const winesBySpace = new Map<string, WineRecord[]>();
  const unplacedWines: WineRecord[] = [];

  for (const wine of filteredWines) {
    if (wine.storage_space_id) {
      const list = winesBySpace.get(wine.storage_space_id) || [];
      list.push(wine);
      winesBySpace.set(wine.storage_space_id, list);
    } else {
      unplacedWines.push(wine);
    }
  }

  // Build ordered list of spaces that have wines (or exist)
  const spaceCards: Array<{ id: string; name: string; spaceType: string; wines: WineRecord[]; bottleCount: number }> = [];

  for (const space of storageSpaces) {
    const wines = winesBySpace.get(space.id) || [];
    const bottleCount = storageSpaceBottleCounts.get(space.id) || 0;
    if (wines.length > 0 || bottleCount > 0) {
      spaceCards.push({ id: space.id, name: space.name, spaceType: space.space_type, wines, bottleCount });
    }
  }

  // Auto-expand the storage card containing the highlighted wine
  useEffect(() => {
    if (!highlightedWineId) return;

    const highlightedWine = filteredWines.find((w) => w.id === highlightedWineId);
    if (!highlightedWine) return;

    const spaceId = highlightedWine.storage_space_id || "__unplaced__";
    setExpandedSpaceIds((prev) => {
      if (prev.has(spaceId)) return prev;
      const next = new Set(prev);
      next.add(spaceId);
      return next;
    });

    // Clear highlight after a delay
    const timer = setTimeout(() => onClearHighlight?.(), 3000);
    return () => clearTimeout(timer);
  }, [highlightedWineId, filteredWines, onClearHighlight]);

  const totalCountries = new Set(filteredWines.map((w) => w.country).filter(Boolean)).size;

  const summaryText = `${stats.totalBottles} flaskor · ${totalCountries} länder · snitt ${stats.averageVintage}`;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Min källare</Text>
        <Pressable onPress={onSignOut}>
          <Text style={styles.linkText}>Logga ut</Text>
        </Pressable>
      </View>

      {/* Stats summary bar — tap to toggle */}
      <Pressable onPress={() => setStatsExpanded((v) => !v)} style={styles.statsSummaryBar}>
        <Text style={styles.statsSummaryText}>{summaryText}</Text>
        <Text style={styles.statsSummaryToggle}>{statsExpanded ? "▲" : "▼"}</Text>
      </Pressable>

      {statsExpanded ? (
        <View style={styles.statsGrid}>
          <View style={styles.statsGridRow}>
            <InsightCard label="Mest flaskor från" value={stats.topCountry} />
            <InsightCard label="Vanligaste typ" value={stats.topType} />
          </View>
          <View style={styles.statsGridRow}>
            <InsightCard label="Vanligaste matmatch" value={stats.topPairing} />
            <InsightCard label="Snittårgång" value={stats.averageVintage} />
          </View>
          <Pressable onPress={onRefreshStats}>
            <Text style={styles.linkText}>Uppdatera statistik</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Search + filters */}
      <LabeledInput label="Sök" value={searchQuery} onChangeText={onSearchChange} placeholder="namn, druva, region, mat..." />

      <SuggestionRow title="Filtrera mat" options={pairingOptions} selected={selectedPairingFilter} onSelect={onPairingChange} />
      <SuggestionRow title="Filtrera land" options={countryOptions} selected={selectedCountryFilter} onSelect={onCountryChange} />
      <SuggestionRow title="Filtrera region" options={regionOptions} selected={selectedRegionFilter} onSelect={onRegionChange} />
      <SuggestionRow title="Filtrera typ" options={typeOptions} selected={selectedTypeFilter} onSelect={onTypeChange} />
      <SuggestionRow title="Filtrera årgång" options={vintageOptions} selected={selectedVintageFilter} onSelect={onVintageChange} />

      {loading ? <LoadingInline /> : null}

      {/* Storage space cards */}
      {!loading && spaceCards.length === 0 && unplacedWines.length === 0 ? (
        <Text style={styles.emptyState}>Inga viner ännu. Lägg till din första flaska.</Text>
      ) : null}

      {spaceCards.map((card) => {
        const isExpanded = expandedSpaceIds.has(card.id);

        return (
          <View key={card.id}>
            <Pressable onPress={() => toggleSpace(card.id)} style={styles.storageCard}>
              <View style={styles.storageCardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.wineType}>{card.spaceType}</Text>
                  <Text style={styles.wineName}>{card.name}</Text>
                </View>
                <View style={styles.storageCardRight}>
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityBadgeText}>{card.bottleCount} st</Text>
                  </View>
                  <Text style={styles.statsSummaryToggle}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
              </View>
            </Pressable>

            {isExpanded
              ? card.wines.map((wine) => (
                  <WineCard
                    key={wine.id}
                    wine={wine}
                    styles={styles}
                    highlighted={wine.id === highlightedWineId}
                    storageSpaceById={storageSpaceById}
                    onOpenSystembolaget={onOpenSystembolaget}
                    onEditWine={onEditWine}
                    onDrinkWine={onDrinkWine}
                    onDeleteWine={onDeleteWine}
                  />
                ))
              : null}
          </View>
        );
      })}

      {unplacedWines.length > 0 ? (
        <View>
          <Pressable onPress={() => toggleSpace("__unplaced__")} style={styles.storageCard}>
            <View style={styles.storageCardHeader}>
              <View style={styles.flex}>
                <Text style={styles.wineType}>Utan plats</Text>
                <Text style={styles.wineName}>Ej tilldelade</Text>
              </View>
              <View style={styles.storageCardRight}>
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityBadgeText}>{unplacedWines.length} st</Text>
                </View>
                <Text style={styles.statsSummaryToggle}>{expandedSpaceIds.has("__unplaced__") ? "▲" : "▼"}</Text>
              </View>
            </View>
          </Pressable>

          {expandedSpaceIds.has("__unplaced__")
            ? unplacedWines.map((wine) => (
                <WineCard
                  key={wine.id}
                  wine={wine}
                  styles={styles}
                  highlighted={wine.id === highlightedWineId}
                  storageSpaceById={storageSpaceById}
                  onOpenSystembolaget={onOpenSystembolaget}
                  onEditWine={onEditWine}
                  onDrinkWine={onDrinkWine}
                  onDeleteWine={onDeleteWine}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

export function HistoryPanel({
  styles,
  historyEntries,
  loadingHistory,
  storageSpaceById,
}: {
  styles: SharedStyles;
  historyEntries: WineHistoryRecord[];
  loadingHistory: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Historik</Text>
        <Text style={styles.linkText}>{historyEntries.length} poster</Text>
      </View>

      {loadingHistory ? <LoadingInline label="Laddar historik..." /> : null}

      {!loadingHistory && historyEntries.length === 0 ? (
        <Text style={styles.emptyState}>Ingen historik ännu. När du markerar att du druckit en flaska kan du sätta betyg här.</Text>
      ) : null}

      {historyEntries.map((entry) => (
        <View key={entry.id} style={styles.wineCard}>
          {entry.image_url ? <Image source={{ uri: entry.image_url }} style={styles.wineImage} /> : null}

          <View style={styles.wineCardHeader}>
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
        </View>
      ))}
    </View>
  );
}
