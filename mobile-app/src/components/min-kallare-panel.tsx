import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";

import { getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import { Expandable, InsightCard, LabeledInput, LoadingInline, StorageSpaceForm, SuggestionRow } from "./form-controls";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export function MinKallarePanel({
  styles, stats, searchQuery, selectedPairingFilter, selectedCountryFilter,
  selectedRegionFilter, selectedTypeFilter, selectedVintageFilter,
  pairingOptions, countryOptions, regionOptions, typeOptions, vintageOptions,
  storageSpaces, storageSpaceBottleCounts, filteredWines, loading, storageSpaceById,
  onRefreshStats, onSearchChange, onPairingChange, onCountryChange,
  onRegionChange, onTypeChange, onVintageChange, onSignOut, onOpenSystembolaget,
  onEditWine, onDrinkWine, onDeleteWine,
  storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace,
  onUpdateStorageSpace, onDeleteStorageSpace,
  onNavigateToAdd, onOpenTastingSessions,
  selectedStorageSpaceFilterId, onStorageSpaceFilterChange,
  hasMoreWines, onLoadMoreWines,
  highlightedWineId, onClearHighlight,
}: {
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
}) {
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [expandedSpaceIds, setExpandedSpaceIds] = useState<Set<string>>(new Set(["__unplaced__"]));

  function toggleSpace(spaceId: string) {
    setExpandedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

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

  const spaceCards: Array<{ id: string; name: string; spaceType: string; wines: WineRecord[]; bottleCount: number }> = [];
  for (const space of storageSpaces) {
    const wines = winesBySpace.get(space.id) || [];
    const bottleCount = storageSpaceBottleCounts.get(space.id) || 0;
    spaceCards.push({ id: space.id, name: space.name, spaceType: space.space_type, wines, bottleCount });
  }

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
  }, [highlightedWineId, filteredWines, onClearHighlight]);

  const totalCountries = new Set(filteredWines.map((w) => w.country).filter(Boolean)).size;
  const summaryText = `${stats.totalBottles} flaskor · ${totalCountries} länder · snitt ${stats.averageVintage}`;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Min källare</Text>
        <Pressable onPress={onSignOut}><Text style={styles.linkText}>Logga ut</Text></Pressable>
      </View>

      <Pressable onPress={() => setStatsExpanded((v) => !v)} style={styles.statsSummaryBar}>
        <Text style={styles.statsSummaryText}>{summaryText}</Text>
        <Text style={styles.statsSummaryToggle}>{statsExpanded ? "▲" : "▼"}</Text>
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

      <LabeledInput label="Sök" value={searchQuery} onChangeText={onSearchChange} placeholder="namn, druva, region, mat..." />
      <SuggestionRow title="Filtrera mat" options={pairingOptions} selected={selectedPairingFilter} onSelect={onPairingChange} />
      <SuggestionRow title="Filtrera land" options={countryOptions} selected={selectedCountryFilter} onSelect={onCountryChange} />
      <SuggestionRow title="Filtrera region" options={regionOptions} selected={selectedRegionFilter} onSelect={onRegionChange} />
      <SuggestionRow title="Filtrera typ" options={typeOptions} selected={selectedTypeFilter} onSelect={onTypeChange} />
      <SuggestionRow title="Filtrera årgång" options={vintageOptions} selected={selectedVintageFilter} onSelect={onVintageChange} />
      {storageSpaces.length > 0 ? (
        <SuggestionRow
          title="Filtrera plats"
          options={["Alla", ...storageSpaces.map((s) => s.name)]}
          selected={selectedStorageSpaceFilterId ? storageSpaceById.get(selectedStorageSpaceFilterId)?.name || "Alla" : "Alla"}
          onSelect={(name) => {
            const space = storageSpaces.find((s) => s.name === name);
            onStorageSpaceFilterChange(space?.id || "");
          }}
        />
      ) : null}

      {loading ? <LoadingInline /> : null}

      <Pressable onPress={onOpenTastingSessions} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Provningar</Text>
      </Pressable>

      <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />

      {!loading && spaceCards.length === 0 && unplacedWines.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Din källare är tom</Text>
          <Text style={styles.emptyState}>Kom igång genom att lägga till ditt första vin — skanna en streckkod eller fyll i för hand.</Text>
          <Pressable onPress={onNavigateToAdd} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Lägg till vin</Text>
          </Pressable>
        </View>
      ) : null}

      {unplacedWines.length > 0 ? (
        <View>
          <Pressable onPress={() => toggleSpace("__unplaced__")} style={[styles.storageCard, { borderWidth: 2, borderColor: "#f4c38c" }]}>
            <View style={styles.storageCardHeader}>
              <View style={styles.flex}>
                <Text style={styles.wineType}>Behöver plats</Text>
                <Text style={styles.wineName}>Otilldelade</Text>
              </View>
              <View style={styles.storageCardRight}>
                <View style={[styles.quantityBadge, { backgroundColor: "#f4c38c" }]}>
                  <Text style={styles.quantityBadgeText}>{unplacedWines.length} st</Text>
                </View>
                <Text style={styles.statsSummaryToggle}>{expandedSpaceIds.has("__unplaced__") ? "▲" : "▼"}</Text>
              </View>
            </View>
          </Pressable>
          <Expandable expanded={expandedSpaceIds.has("__unplaced__")}>
            <View>{unplacedWines.map((wine) => (
              <WineCard key={wine.id} wine={wine} styles={styles} highlighted={wine.id === highlightedWineId} storageSpaceById={storageSpaceById} onOpenSystembolaget={onOpenSystembolaget} onEditWine={onEditWine} onDrinkWine={onDrinkWine} onDeleteWine={onDeleteWine} />
            ))}</View>
          </Expandable>
        </View>
      ) : null}

      {spaceCards.map((card) => {
        const isExpanded = expandedSpaceIds.has(card.id);
        return (
          <View key={card.id}>
            <Pressable onPress={() => toggleSpace(card.id)} style={styles.storageCard}>
              <View style={styles.storageCardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.wineType}>{SPACE_TYPE_LABELS[card.spaceType] || card.spaceType}</Text>
                  <Text style={styles.wineName}>{card.name}</Text>
                </View>
                <View style={styles.storageCardRight}>
                  <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{card.bottleCount} st</Text></View>
                  <Text style={styles.statsSummaryToggle}>{isExpanded ? "▲" : "▼"}</Text>
                </View>
              </View>
            </Pressable>
            <Expandable expanded={isExpanded}>
              <View>
                <StorageSpaceActions space={storageSpaceById.get(card.id)!} styles={styles} onUpdate={onUpdateStorageSpace} onDelete={onDeleteStorageSpace} />
                {card.wines.map((wine) => (
                  <WineCard key={wine.id} wine={wine} styles={styles} highlighted={wine.id === highlightedWineId} storageSpaceById={storageSpaceById} onOpenSystembolaget={onOpenSystembolaget} onEditWine={onEditWine} onDrinkWine={onDrinkWine} onDeleteWine={onDeleteWine} />
                ))}
              </View>
            </Expandable>
          </View>
        );
      })}

      {hasMoreWines ? (
        <Pressable onPress={onLoadMoreWines} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Ladda fler viner</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

import { SPACE_TYPE_LABELS, SPACE_TYPE_OPTIONS, SPACE_TYPE_VALUES } from "../lib/storage-types";

function StorageSpaceActions({ space, styles, onUpdate, onDelete }: {
  space: StorageSpaceRow; styles: SharedStyles;
  onUpdate: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [spaceType, setSpaceType] = useState(SPACE_TYPE_LABELS[space.space_type] || space.space_type);
  const [rowCount, setRowCount] = useState(String(space.row_count));
  const [slotsPerRow, setSlotsPerRow] = useState(String(space.slots_per_row));

  if (!editing) {
    return (
      <View style={styles.actionRow}>
        <Pressable onPress={() => setEditing(true)}><Text style={styles.linkText}>Redigera</Text></Pressable>
        <Pressable onPress={() => Alert.alert("Ta bort förvaringsplats", `Vill du ta bort "${space.name}"?`, [
          { text: "Avbryt", style: "cancel" },
          { text: "Ta bort", style: "destructive", onPress: () => onDelete(space.id) },
        ])}><Text style={styles.dangerText}>Ta bort</Text></Pressable>
      </View>
    );
  }

  return (
    <Expandable expanded={editing}>
      <View style={{ gap: 8, paddingVertical: 8 }}>
        <LabeledInput label="Namn" value={name} onChangeText={setName} />
        <SuggestionRow title="Typ" options={SPACE_TYPE_OPTIONS} selected={spaceType} onSelect={setSpaceType} />
        <SuggestionRow title="Platser" options={["Med platser", "Utan platser"]}
          selected={rowCount === "0" ? "Utan platser" : "Med platser"}
          onSelect={(v) => { if (v === "Utan platser") { setRowCount("0"); setSlotsPerRow("0"); } else { setRowCount("6"); setSlotsPerRow("6"); } }} />
        {rowCount !== "0" ? (
          <View style={styles.actionRow}>
            <LabeledInput label="Rader" value={rowCount} onChangeText={setRowCount} keyboardType="number-pad" />
            <LabeledInput label="Platser/rad" value={slotsPerRow} onChangeText={setSlotsPerRow} keyboardType="number-pad" />
          </View>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable onPress={() => {
            onUpdate(space.id, { name, space_type: SPACE_TYPE_VALUES[spaceType] || space.space_type, row_count: parseInt(rowCount) || 0, slots_per_row: parseInt(slotsPerRow) || 0 });
            setEditing(false);
          }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Spara</Text></Pressable>
          <Pressable onPress={() => setEditing(false)}><Text style={styles.linkText}>Avbryt</Text></Pressable>
        </View>
      </View>
    </Expandable>
  );
}

const WineCard = React.memo(function WineCard({ wine, styles, highlighted, storageSpaceById, onOpenSystembolaget, onEditWine, onDrinkWine, onDeleteWine }: {
  wine: WineRecord; styles: SharedStyles; highlighted?: boolean; storageSpaceById: Map<string, StorageSpaceRow>;
  onOpenSystembolaget: (productId: string) => void; onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void; onDeleteWine: (wineId: string, imagePath: string | null) => void;
}) {
  return (
    <View style={[styles.wineCard, highlighted && styles.wineCardHighlighted]}>
      <View style={styles.wineCardHeader}>
        {wine.image_url ? (
          <Image source={{ uri: wine.image_url }} style={{ width: 64, height: 86, borderRadius: 10, backgroundColor: "#ead8ca" }} resizeMode="cover" />
        ) : null}
        <View style={styles.flex}>
          <Text style={styles.wineType}>{wine.type}</Text>
          <Text style={styles.wineName}>{wine.name}</Text>
          <Text style={styles.wineMeta}>
            {[wine.producer, wine.vintage, wine.grape, [wine.country, wine.region].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
          </Text>
          <Text style={styles.locationText}>
            {getWineStoragePlacementLabel(wine, storageSpaceById) || wine.cellar_location || "Ingen plats angiven"}
          </Text>
          {wine.cellar_location && getWineStoragePlacementLabel(wine, storageSpaceById) ? (
            <Text style={styles.notesText}>{wine.cellar_location}</Text>
          ) : null}
        </View>
        <View style={styles.quantityBadge}><Text style={styles.quantityBadgeText}>{wine.quantity} st</Text></View>
      </View>

      {wine.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {wine.tags.map((tag) => (<View key={`${wine.id}-${tag}`} style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>))}
        </View>
      ) : null}

      {wine.food_pairings.length > 0 ? (
        <View style={styles.foodSection}>
          <Text style={styles.inputLabel}>Passar till</Text>
          <View style={styles.tagRow}>
            {wine.food_pairings.map((pairing) => (<View key={`${wine.id}-food-${pairing}`} style={styles.foodPill}><Text style={styles.foodText}>{pairing}</Text></View>))}
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
        <Pressable onPress={() => onEditWine(wine)}><Text style={styles.linkText}>Redigera</Text></Pressable>
        <Pressable onPress={() => onDrinkWine(wine)}><Text style={styles.linkText}>Drick</Text></Pressable>
        <Pressable onPress={() => onDeleteWine(wine.id, wine.image_path)}><Text style={styles.dangerText}>Ta bort</Text></Pressable>
      </View>
    </View>
  );
});
