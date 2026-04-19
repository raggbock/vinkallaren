import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";

import { useCellar } from "../contexts/CellarContext";
import { SPACE_TYPE_LABELS } from "../lib/storage-types";
import { UNPLACED_SPACE_ID } from "../hooks/useCellarSpaceWines";
import type { CellarAggregate, CellarStats } from "../types/cellar-aggregate";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";
import type { FilterProps, StorageProps, WineActionsProps } from "../types/panel-prop-groups";
import { CellarListHeader } from "./cellar-list-header";
import { StorageSpaceActions } from "./storage-space-actions";
import { ShelfGrid } from "./shelf-grid";
import { WineCard } from "./wine-card";

import { colors } from "../styles/theme";
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
  stats: CellarStats;
  aggregate: CellarAggregate;
  filter: FilterProps;
  storage: StorageProps;
  wineActions: WineActionsProps;
  loading: boolean;
  onRefreshStats: () => void;
  onSignOut: () => void;
  onNavigateToAdd: () => void;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  onHighlightWine?: (wineId: string) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function MinKallarePanel(props: MinKallarePanelProps) {
  const { styles, stats, aggregate, storage, wineActions } = props;
  const ctx = useCellar();
  const { storageSpaces, storageSpaceById } = storage;
  const { requestSpace, getSpaceWines } = ctx;

  const [statsExpanded, setStatsExpanded] = useState(false);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(
    () => new Set([UNPLACED_SPACE_ID])
  );
  const listRef = useRef<SectionList<WineRecord, WineSection>>(null);

  // Default-expand "Otilldelade" on mount → request its wines.
  useEffect(() => {
    requestSpace(UNPLACED_SPACE_ID);
  }, [requestSpace]);

  const filterIsActive = Object.keys(ctx.filters.filterState).length > 0
    || ctx.filters.searchQuery.trim().length > 0;

  // When a filter/search is active, auto-expand all spaces that have matches.
  useEffect(() => {
    if (!filterIsActive) return;
    const matching = new Set<string>();
    if (aggregate.unplacedCount > 0) matching.add(UNPLACED_SPACE_ID);
    for (const [id, cnt] of Object.entries(aggregate.bottleCountsBySpaceId)) {
      if (cnt > 0) matching.add(id);
    }
    setExpandedSpaceIds(matching);
    matching.forEach((id) => requestSpace(id));
  }, [filterIsActive, aggregate.bottleCountsBySpaceId, aggregate.unplacedCount, requestSpace]);

  const toggleSpace = useCallback((spaceId: string) => {
    setExpandedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else { next.add(spaceId); requestSpace(spaceId); }
      return next;
    });
  }, [requestSpace]);

  const sections = useCellarSections({
    aggregate, storageSpaces, storageSpaceById, expandedSpaceIds,
    getSpaceWines,
  });

  useHighlightAutoExpand(
    props.highlightedWineId, ctx.wines, setExpandedSpaceIds,
    requestSpace, props.onClearHighlight,
  );

  useEffect(() => {
    if (!props.highlightedWineId) return;
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const iIdx = sections[sIdx].data.findIndex((w) => w.id === props.highlightedWineId);
      if (iIdx >= 0) {
        setTimeout(() => listRef.current?.scrollToLocation({
          sectionIndex: sIdx, itemIndex: iIdx, animated: true, viewOffset: 100,
        }), 100);
        return;
      }
    }
  }, [props.highlightedWineId, sections]);

  const summaryText = useMemo(() => {
    return `${stats.totalBottles} flaskor · snitt ${stats.averageVintage}`;
  }, [stats.totalBottles, stats.averageVintage]);

  const renderSectionHeader = useCallback(({ section }: { section: WineSection }) => (
    <SectionHeader
      section={section} styles={styles} expandedSpaceIds={expandedSpaceIds}
      toggleSpace={toggleSpace}
      onUpdateStorageSpace={storage.onUpdateStorageSpace}
      onDeleteStorageSpace={storage.onDeleteStorageSpace}
      getSpaceWines={getSpaceWines}
      onGoToWine={(wine) => {
        const spaceId = wine.storage_space_id || UNPLACED_SPACE_ID;
        setExpandedSpaceIds((prev) => { const n = new Set(prev); n.add(spaceId); return n; });
        requestSpace(spaceId);
        props.onHighlightWine?.(wine.id);
      }}
    />
  ), [styles, expandedSpaceIds, toggleSpace, storage.onUpdateStorageSpace,
      storage.onDeleteStorageSpace, getSpaceWines, requestSpace, props.onHighlightWine]);

  const renderItem = useCallback(({ item }: { item: WineRecord }) => (
    <WineCard wine={item} styles={styles} highlighted={item.id === props.highlightedWineId}
      storageSpaceById={storageSpaceById}
      onOpenSystembolaget={wineActions.onOpenSystembolaget}
      onEditWine={wineActions.onEditWine}
      onDrinkWine={wineActions.onDrinkWine}
      onDeleteWine={wineActions.onDeleteWine} />
  ), [styles, props.highlightedWineId, storageSpaceById, wineActions]);

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListHeaderComponent={
        <CellarListHeader
          styles={styles} stats={stats} filter={props.filter} storage={storage}
          statsExpanded={statsExpanded} onToggleStats={() => setStatsExpanded((v) => !v)}
          summaryText={summaryText} hasSections={sections.length > 0}
          onRefreshStats={props.onRefreshStats} onSignOut={props.onSignOut}
          onNavigateToAdd={props.onNavigateToAdd}
          loading={props.loading}
        />
      }
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.panel, { flexGrow: 1, marginHorizontal: 20, marginTop: 20, maxWidth: 520, width: "100%", alignSelf: "center" as const }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false}
          onRefresh={props.onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined
      }
      initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5}
      stickySectionHeadersEnabled={false}
    />
  );
}

function SectionHeader({ section, styles, expandedSpaceIds, toggleSpace,
  onUpdateStorageSpace, onDeleteStorageSpace, getSpaceWines, onGoToWine }: {
  section: WineSection; styles: SharedStyles; expandedSpaceIds: Set<string>;
  toggleSpace: (id: string) => void;
  onUpdateStorageSpace: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDeleteStorageSpace: (id: string) => void;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
  onGoToWine?: (wine: WineRecord) => void;
}) {
  const isExpanded = expandedSpaceIds.has(section.key);
  const hasGrid = !section.isUnplaced && section.space
    && section.space.row_count > 0 && section.space.slots_per_row > 0;
  const spaceWines = getSpaceWines(section.key).wines;
  return (
    <View>
      <Pressable onPress={() => toggleSpace(section.key)}
        style={[styles.storageCard, section.isUnplaced && { borderWidth: 2, borderColor: colors.warm }]}>
        <View style={styles.storageCardHeader}>
          <View style={styles.flex}>
            <Text style={styles.wineType}>{section.spaceType}</Text>
            <Text style={styles.wineName}>{section.title}</Text>
          </View>
          <View style={styles.storageCardRight}>
            <View style={[styles.quantityBadge, section.isUnplaced && { backgroundColor: colors.warm }]}>
              <Text style={styles.quantityBadgeText}>{section.bottleCount} st</Text>
            </View>
            <Text style={styles.sectionChevron}>{isExpanded ? "▾" : "›"}</Text>
          </View>
        </View>
      </Pressable>
      {!section.isUnplaced && section.space && isExpanded ? (
        <StorageSpaceActions space={section.space} styles={styles}
          onUpdate={onUpdateStorageSpace} onDelete={onDeleteStorageSpace} />
      ) : null}
      {hasGrid && isExpanded ? (
        <ShelfGrid space={section.space!} wines={spaceWines} onGoToWine={onGoToWine} />
      ) : null}
    </View>
  );
}

function useCellarSections({ aggregate, storageSpaces, storageSpaceById,
  expandedSpaceIds, getSpaceWines }: {
  aggregate: CellarAggregate;
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  expandedSpaceIds: Set<string>;
  getSpaceWines: (spaceId: string) => { wines: WineRecord[]; loading: boolean; loaded: boolean };
}): WineSection[] {
  return useMemo(() => {
    const result: WineSection[] = [];

    if (aggregate.unplacedCount > 0) {
      const s = getSpaceWines(UNPLACED_SPACE_ID);
      result.push({
        key: UNPLACED_SPACE_ID, title: "Otilldelade", spaceType: "Behöver plats",
        bottleCount: aggregate.unplacedCount, isUnplaced: true,
        data: expandedSpaceIds.has(UNPLACED_SPACE_ID) ? s.wines : [],
      });
    }

    for (const space of storageSpaces) {
      const cnt = aggregate.bottleCountsBySpaceId[space.id] ?? 0;
      const s = getSpaceWines(space.id);
      result.push({
        key: space.id, title: space.name,
        spaceType: SPACE_TYPE_LABELS[space.space_type] || space.space_type,
        bottleCount: cnt, isUnplaced: false, space: storageSpaceById.get(space.id),
        data: expandedSpaceIds.has(space.id) ? s.wines : [],
      });
    }
    return result;
  }, [aggregate.bottleCountsBySpaceId, aggregate.unplacedCount, storageSpaces,
      storageSpaceById, expandedSpaceIds, getSpaceWines]);
}

function useHighlightAutoExpand(
  highlightedWineId: string | null | undefined,
  wines: WineRecord[],
  setExpandedSpaceIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  requestSpace: (id: string) => void,
  onClearHighlight?: () => void,
) {
  useEffect(() => {
    if (!highlightedWineId) return;
    const wine = wines.find((w) => w.id === highlightedWineId);
    if (!wine) return;
    const spaceId = wine.storage_space_id || UNPLACED_SPACE_ID;
    setExpandedSpaceIds((prev) => {
      if (prev.has(spaceId)) return prev;
      const n = new Set(prev); n.add(spaceId); return n;
    });
    requestSpace(spaceId);
    const t = setTimeout(() => onClearHighlight?.(), 3000);
    return () => clearTimeout(t);
  }, [highlightedWineId, wines, setExpandedSpaceIds, requestSpace, onClearHighlight]);
}
