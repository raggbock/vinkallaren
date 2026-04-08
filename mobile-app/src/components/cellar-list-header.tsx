import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import { Expandable, InsightCard, LabeledInput, LoadingInline, PanelHeader, StorageSpaceForm, SuggestionRow } from "./form-controls";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export type CellarListHeaderProps = {
  styles: SharedStyles;
  stats: { totalBottles: number; totalLabels: number; topCountry: string; topType: string; topPairing: string; averageVintage: string };
  statsExpanded: boolean;
  onToggleStats: () => void;
  summaryText: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedPairingFilter: string;
  selectedCountryFilter: string;
  selectedRegionFilter: string;
  selectedTypeFilter: string;
  selectedVintageFilter: string;
  selectedGrapeFilter: string;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  grapeOptions: string[];
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  selectedStorageSpaceFilterId: string;
  onPairingChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onVintageChange: (value: string) => void;
  onGrapeChange: (value: string) => void;
  onStorageSpaceFilterChange: (id: string) => void;
  onRefreshStats: () => void;
  onSignOut: () => void;
  onOpenTastingSessions: () => void;
  onNavigateToAdd: () => void;
  loading: boolean;
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
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
        draft={props.storageSpaceDraft} saving={props.savingStorageSpace}
        onDraftChange={props.onStorageSpaceDraftChange} onSave={props.onSaveStorageSpace}
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

function CellarFilters({
  styles, searchQuery, onSearchChange,
  pairingOptions, selectedPairingFilter, onPairingChange,
  countryOptions, selectedCountryFilter, onCountryChange,
  regionOptions, selectedRegionFilter, onRegionChange,
  typeOptions, selectedTypeFilter, onTypeChange,
  vintageOptions, selectedVintageFilter, onVintageChange,
  grapeOptions, selectedGrapeFilter, onGrapeChange,
  storageSpaces, storageSpaceById, selectedStorageSpaceFilterId, onStorageSpaceFilterChange,
}: CellarListHeaderProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const activeCount = [
    selectedPairingFilter, selectedCountryFilter, selectedRegionFilter,
    selectedGrapeFilter, selectedTypeFilter, selectedVintageFilter,
    selectedStorageSpaceFilterId,
  ].filter((v) => v && v !== "Alla").length;

  return (
    <>
      <LabeledInput label="Sök" value={searchQuery} onChangeText={onSearchChange} placeholder="namn, druva, region, mat..." />
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
          <SuggestionRow title="Mat" options={pairingOptions} selected={selectedPairingFilter} onSelect={onPairingChange} />
          <SuggestionRow title="Land" options={countryOptions} selected={selectedCountryFilter} onSelect={onCountryChange} />
          <SuggestionRow title="Region" options={regionOptions} selected={selectedRegionFilter} onSelect={onRegionChange} />
          <SuggestionRow title="Druva" options={grapeOptions} selected={selectedGrapeFilter} onSelect={onGrapeChange} />
          <SuggestionRow title="Typ" options={typeOptions} selected={selectedTypeFilter} onSelect={onTypeChange} />
          <SuggestionRow title="Årgång" options={vintageOptions} selected={selectedVintageFilter} onSelect={onVintageChange} />
          {storageSpaces.length > 0 ? (
            <SuggestionRow
              title="Plats"
              options={["Alla", ...storageSpaces.map((s) => s.name)]}
              selected={selectedStorageSpaceFilterId ? storageSpaceById.get(selectedStorageSpaceFilterId)?.name || "Alla" : "Alla"}
              onSelect={(name) => {
                const space = storageSpaces.find((s) => s.name === name);
                onStorageSpaceFilterChange(space?.id || "");
              }}
            />
          ) : null}
        </View>
      </Expandable>
    </>
  );
}

function TastingsButton({ styles, onPress }: { styles: SharedStyles; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryButton, { paddingVertical: 18 }, pressed && { opacity: 0.8 }]}>
      <Text style={styles.primaryButtonText}>Provningar</Text>
    </Pressable>
  );
}

function EmptyState({ styles, onNavigateToAdd }: { styles: SharedStyles; onNavigateToAdd: () => void }) {
  return (
    <View style={styles.emptyStateCard}>
      <Text style={styles.emptyStateTitle}>Din källare är tom</Text>
      <Text style={styles.emptyState}>Kom igång genom att lägga till ditt första vin — skanna en streckkod eller fyll i för hand.</Text>
      <Pressable onPress={onNavigateToAdd} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Lägg till vin</Text>
      </Pressable>
    </View>
  );
}
