import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, Text, View } from "react-native";

import { SPACE_TYPE_LABELS } from "../lib/storage-types";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import { CellarListHeader } from "./cellar-list-header";
import { StorageSpaceActions } from "./storage-space-actions";
import { WineCard } from "./wine-card";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

type WineSection = {
  key: string;
  title: string;
  spaceType: string;
  bottleCount: number;
  isUnplaced: boolean;
  space?: StorageSpaceRow;
  data: WineRecord[];
};

type MinKallarePanelProps = {
  styles: SharedStyles;
  stats: { totalBottles: number; totalLabels: number; topCountry: string; topType: string; topPairing: string; averageVintage: string };
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
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  onUpdateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDeleteStorageSpace: (id: string) => void;
  onNavigateToAdd: () => void;
  onOpenTastingSessions: () => void;
  selectedStorageSpaceFilterId: string;
  onStorageSpaceFilterChange: (id: string) => void;
  hasMoreWines: boolean;
  onLoadMoreWines: () => void;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function MinKallarePanel(props: MinKallarePanelProps) {
  const { styles, stats, filteredWines, storageSpaces, storageSpaceBottleCounts, storageSpaceById } = props;
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(new Set(["__unplaced__"]));

  const sections = useCellarSections(filteredWines, storageSpaces, storageSpaceBottleCounts, storageSpaceById, expandedSpaceIds);
  useHighlightAutoExpand(props.highlightedWineId, filteredWines, setExpandedSpaceIds, props.onClearHighlight);

  const toggleSpace = useCallback((spaceId: string) => {
    setExpandedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }, []);

  const totalCountries = new Set(filteredWines.map((w) => w.country).filter(Boolean)).size;
  const summaryText = `${stats.totalBottles} flaskor · ${totalCountries} länder · snitt ${stats.averageVintage}`;

  const renderSectionHeader = useCallback(({ section }: { section: WineSection }) => (
    <SectionHeader section={section} styles={styles} expandedSpaceIds={expandedSpaceIds}
      toggleSpace={toggleSpace} onUpdateStorageSpace={props.onUpdateStorageSpace} onDeleteStorageSpace={props.onDeleteStorageSpace} />
  ), [styles, expandedSpaceIds, toggleSpace, props.onUpdateStorageSpace, props.onDeleteStorageSpace]);

  const renderItem = useCallback(({ item }: { item: WineRecord }) => (
    <WineCard wine={item} styles={styles} highlighted={item.id === props.highlightedWineId}
      storageSpaceById={storageSpaceById} onOpenSystembolaget={props.onOpenSystembolaget}
      onEditWine={props.onEditWine} onDrinkWine={props.onDrinkWine} onDeleteWine={props.onDeleteWine} />
  ), [styles, props.highlightedWineId, storageSpaceById, props.onOpenSystembolaget, props.onEditWine, props.onDrinkWine, props.onDeleteWine]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={
        <CellarListHeader {...props} statsExpanded={statsExpanded}
          onToggleStats={() => setStatsExpanded((v) => !v)} summaryText={summaryText}
          hasSections={sections.length > 0} />
      }
      style={{ backgroundColor: "#f8f1e8" }}
      contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false} onRefresh={props.onRefresh} tintColor="#6f1d1b" colors={["#6f1d1b"]} /> : undefined
      }
      onEndReached={props.hasMoreWines ? props.onLoadMoreWines : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={props.hasMoreWines ? <ActivityIndicator style={{ padding: 16 }} color="#6f1d1b" /> : null}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
      stickySectionHeadersEnabled={false}
    />
  );
}

function SectionHeader({ section, styles, expandedSpaceIds, toggleSpace, onUpdateStorageSpace, onDeleteStorageSpace }: {
  section: WineSection; styles: SharedStyles; expandedSpaceIds: Set<string>;
  toggleSpace: (id: string) => void;
  onUpdateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDeleteStorageSpace: (id: string) => void;
}) {
  return (
    <View>
      <Pressable onPress={() => toggleSpace(section.key)} style={[styles.storageCard, section.isUnplaced && { borderWidth: 2, borderColor: "#f4c38c" }]}>
        <View style={styles.storageCardHeader}>
          <View style={styles.flex}>
            <Text style={styles.wineType}>{section.spaceType}</Text>
            <Text style={styles.wineName}>{section.title}</Text>
          </View>
          <View style={styles.storageCardRight}>
            <View style={[styles.quantityBadge, section.isUnplaced && { backgroundColor: "#f4c38c" }]}>
              <Text style={styles.quantityBadgeText}>{section.bottleCount} st</Text>
            </View>
            <Text style={styles.statsSummaryToggle}>{expandedSpaceIds.has(section.key) ? "▲" : "▼"}</Text>
          </View>
        </View>
      </Pressable>
      {!section.isUnplaced && section.space && expandedSpaceIds.has(section.key) ? (
        <StorageSpaceActions space={section.space} styles={styles} onUpdate={onUpdateStorageSpace} onDelete={onDeleteStorageSpace} />
      ) : null}
    </View>
  );
}

function useCellarSections(
  filteredWines: WineRecord[], storageSpaces: StorageSpaceRow[],
  storageSpaceBottleCounts: Map<string, number>, storageSpaceById: Map<string, StorageSpaceRow>,
  expandedSpaceIds: Set<string>,
): WineSection[] {
  const winesBySpace = useMemo(() => {
    const map = new Map<string, WineRecord[]>();
    for (const wine of filteredWines) {
      if (wine.storage_space_id) {
        const list = map.get(wine.storage_space_id) || [];
        list.push(wine);
        map.set(wine.storage_space_id, list);
      }
    }
    return map;
  }, [filteredWines]);

  const unplacedWines = useMemo(
    () => filteredWines.filter((w) => !w.storage_space_id),
    [filteredWines],
  );

  const spaceCards = useMemo(() => {
    const cards: Array<{ id: string; name: string; spaceType: string; wines: WineRecord[]; bottleCount: number }> = [];
    for (const space of storageSpaces) {
      const wines = winesBySpace.get(space.id) || [];
      const bottleCount = storageSpaceBottleCounts.get(space.id) || 0;
      cards.push({ id: space.id, name: space.name, spaceType: space.space_type, wines, bottleCount });
    }
    return cards;
  }, [storageSpaces, winesBySpace, storageSpaceBottleCounts]);

  return useMemo((): WineSection[] => {
    const result: WineSection[] = [];
    if (unplacedWines.length > 0) {
      result.push({
        key: "__unplaced__", title: "Otilldelade", spaceType: "Behöver plats",
        bottleCount: unplacedWines.length, isUnplaced: true,
        data: expandedSpaceIds.has("__unplaced__") ? unplacedWines : [],
      });
    }
    for (const card of spaceCards) {
      result.push({
        key: card.id, title: card.name,
        spaceType: SPACE_TYPE_LABELS[card.spaceType] || card.spaceType,
        bottleCount: card.bottleCount, isUnplaced: false,
        space: storageSpaceById.get(card.id),
        data: expandedSpaceIds.has(card.id) ? card.wines : [],
      });
    }
    return result;
  }, [unplacedWines, spaceCards, expandedSpaceIds, storageSpaceById]);
}

function useHighlightAutoExpand(
  highlightedWineId: string | null | undefined, filteredWines: WineRecord[],
  setExpandedSpaceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  onClearHighlight?: () => void,
) {
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
    const timer = setTimeout(() => onClearHighlight?.(), 3000);
    return () => clearTimeout(timer);
  }, [highlightedWineId, filteredWines, onClearHighlight, setExpandedSpaceIds]);
}
