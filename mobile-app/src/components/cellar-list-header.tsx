import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { FilterProps, StorageProps } from "../types/panel-prop-groups";
import { Expandable, InsightCard, LabeledInput, LoadingInline, PanelHeader, StorageSpaceForm, SuggestionRow } from "./form-controls";
import { BottleDoodle, SquigglyLine } from "./doodles";

import { colors, type styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export type CellarListHeaderProps = {
  styles: SharedStyles;
  stats: { totalBottles: number; totalLabels: number; topCountry: string; topType: string; topPairing: string; averageVintage: string };
  filter: FilterProps;
  storage: StorageProps;
  statsExpanded: boolean;
  onToggleStats: () => void;
  summaryText: string;
  onRefreshStats: () => void;
  onSignOut: () => void;
  onOpenTastingSessions: () => void;
  onNavigateToAdd: () => void;
  loading: boolean;
  hasSections: boolean;
};

export function CellarListHeader(props: CellarListHeaderProps) {
  return (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <PanelHeader title="Min källare" rightLabel="Profil" onRightPress={props.onSignOut} />
      <StatsSummaryBar {...props} />
      <CellarFilters {...props} />
      {props.loading ? <LoadingInline /> : null}
      <TastingsButton styles={props.styles} onPress={props.onOpenTastingSessions} />
      <StorageSpaceForm
        draft={props.storage.storageSpaceDraft} saving={props.storage.savingStorageSpace}
        onDraftChange={props.storage.onStorageSpaceDraftChange} onSave={props.storage.onSaveStorageSpace}
      />
      {!props.loading && !props.hasSections ? (
        <EmptyState styles={props.styles} onNavigateToAdd={props.onNavigateToAdd} />
      ) : null}
    </View>
  );
}

function StatsSummaryBar({ styles, statsExpanded, onToggleStats, summaryText, stats, onRefreshStats }: CellarListHeaderProps) {
  return (
    <>
      <Pressable onPress={onToggleStats} style={({ pressed }) => [styles.statsSummaryBar, pressed && { opacity: 0.8 }]}>
        <Text style={styles.statsSummaryText}>{summaryText}</Text>
        <Text style={styles.sectionChevron}>{statsExpanded ? "▾" : "›"}</Text>
      </Pressable>
      <Expandable expanded={statsExpanded}>
        <View style={styles.statsGrid}>
          <View style={styles.statsGridRow}>
            <InsightCard label="Mest flaskor från" value={stats.topCountry} />
            <InsightCard label="Vanligaste typ" value={stats.topType} />
          </View>
          <View style={styles.statsGridRow}>
            <InsightCard label="Vanligaste matmatch" value={stats.topPairing} />
            <InsightCard label="Snittårgång" value={stats.averageVintage} />
          </View>
          <Pressable onPress={onRefreshStats}><Text style={styles.linkText}>Uppdatera statistik</Text></Pressable>
        </View>
      </Expandable>
    </>
  );
}

function CellarFilters({ styles, filter, storage }: CellarListHeaderProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const activeCount = [
    filter.selectedPairingFilter, filter.selectedCountryFilter, filter.selectedRegionFilter,
    filter.selectedGrapeFilter, filter.selectedTypeFilter, filter.selectedVintageFilter,
    filter.selectedStorageSpaceFilterId,
  ].filter((v) => v && v !== "Alla").length;

  return (
    <>
      <LabeledInput label="Sök" value={filter.searchQuery} onChangeText={filter.onSearchChange} placeholder="namn, druva, region, mat..." />
      <Pressable
        onPress={() => setFiltersExpanded(!filtersExpanded)}
        style={({ pressed }) => [styles.filterToggle, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.filterToggleText}>
          Filter{activeCount > 0 ? ` (${activeCount})` : ""}
        </Text>
        <Text style={styles.foodCategoryChevron}>{filtersExpanded ? "▾" : "›"}</Text>
      </Pressable>
      <Expandable expanded={filtersExpanded}>
        <View style={{ gap: 12 }}>
          <SuggestionRow title="Mat" options={filter.pairingOptions} selected={filter.selectedPairingFilter} onSelect={filter.onPairingChange} />
          <SuggestionRow title="Land" options={filter.countryOptions} selected={filter.selectedCountryFilter} onSelect={filter.onCountryChange} />
          <SuggestionRow title="Region" options={filter.regionOptions} selected={filter.selectedRegionFilter} onSelect={filter.onRegionChange} />
          <SuggestionRow title="Druva" options={filter.grapeOptions} selected={filter.selectedGrapeFilter} onSelect={filter.onGrapeChange} />
          <SuggestionRow title="Typ" options={filter.typeOptions} selected={filter.selectedTypeFilter} onSelect={filter.onTypeChange} />
          <SuggestionRow title="Årgång" options={filter.vintageOptions} selected={filter.selectedVintageFilter} onSelect={filter.onVintageChange} />
          {storage.storageSpaces.length > 0 ? (
            <SuggestionRow
              title="Plats"
              options={["Alla", ...storage.storageSpaces.map((s) => s.name)]}
              selected={filter.selectedStorageSpaceFilterId ? storage.storageSpaceById.get(filter.selectedStorageSpaceFilterId)?.name || "Alla" : "Alla"}
              onSelect={(name) => {
                const space = storage.storageSpaces.find((s) => s.name === name);
                filter.onStorageSpaceFilterChange(space?.id || "");
              }}
            />
          ) : null}
        </View>
      </Expandable>
    </>
  );
}

function TastingsButton({ onPress }: { styles: SharedStyles; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
      pressed && { opacity: 0.8 },
    ]}>
      <Text style={{ fontSize: 18 }}>🥂</Text>
      <Text style={{ flex: 1, color: colors.accent, fontWeight: "700", fontSize: 15 }}>Provningar</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>›</Text>
    </Pressable>
  );
}

function EmptyState({ styles, onNavigateToAdd }: { styles: SharedStyles; onNavigateToAdd: () => void }) {
  return (
    <View style={styles.emptyStateCard}>
      <BottleDoodle size={100} />
      <SquigglyLine />
      <Text style={styles.emptyStateTitle}>Din källare är tom</Text>
      <Text style={styles.emptyState}>Kom igång genom att lägga till ditt första vin — skanna en streckkod eller fyll i för hand.</Text>
      <Pressable onPress={onNavigateToAdd} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Lägg till vin</Text>
      </Pressable>
    </View>
  );
}
