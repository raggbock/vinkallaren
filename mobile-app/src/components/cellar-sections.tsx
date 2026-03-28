import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { buildSystembolagetProductUrl, getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WineRecord } from "../types/wine";
import type { CellarSection } from "../types/cellar";
import { DoubleRow, InsightCard, LabeledInput, LoadingInline, MetricCard, StorageSpaceSelector, SuggestionRow } from "./form-controls";

type SharedStyles = any;

export function CellarSectionNav({
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
  return (
    <View style={styles.sectionNavWrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNav}>
        {sections.map((section) => {
          const isActive = activeSection === section.key;

          return (
            <Pressable
              key={section.key}
              onPress={() => onSelect(section.key)}
              style={[styles.sectionPill, isActive && styles.sectionPillActive]}
            >
              <Text style={[styles.sectionPillText, isActive && styles.sectionPillTextActive]}>{section.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function StatsPanel({
  stats,
  styles,
  onRefresh,
}: {
  stats: {
    topCountry: string;
    topType: string;
    topPairing: string;
    averageVintage: string;
  };
  styles: SharedStyles;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Statistik</Text>
        <Pressable onPress={onRefresh}>
          <Text style={styles.linkText}>Uppdatera</Text>
        </Pressable>
      </View>

      <InsightCard label="Mest flaskor från" value={stats.topCountry} />
      <InsightCard label="Vanligaste typ" value={stats.topType} />
      <InsightCard label="Vanligaste matmatch" value={stats.topPairing} />
      <InsightCard label="Snittårgång" value={stats.averageVintage} />
    </View>
  );
}

export function StorageSpacesPanel({
  styles,
  storageSpaces,
  storageSpaceBottleCounts,
  storageSpaceDraft,
  loadingStorageSpaces,
  savingStorageSpace,
  onDraftChange,
  onSave,
  onDelete,
}: {
  styles: SharedStyles;
  storageSpaces: StorageSpaceRow[];
  storageSpaceBottleCounts: Map<string, number>;
  storageSpaceDraft: {
    name: string;
    spaceType: string;
    rowCount: string;
    slotsPerRow: string;
    notes: string;
  };
  loadingStorageSpaces: boolean;
  savingStorageSpace: boolean;
  onDraftChange: (patch: Partial<{ name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string }>) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Förvaringsplatser</Text>
        <Text style={styles.linkText}>{storageSpaces.length} st</Text>
      </View>

      <Text style={styles.notesText}>
        Skapa en plats för varje vinkyl, källare eller annan zon. Varje plats får egna rader och platser per rad.
      </Text>

      <LabeledInput
        label="Namn"
        value={storageSpaceDraft.name}
        onChangeText={(value) => onDraftChange({ name: value })}
        placeholder="Vinkyl i köket"
      />
      <DoubleRow>
        <LabeledInput
          label="Typ"
          value={storageSpaceDraft.spaceType}
          onChangeText={(value) => onDraftChange({ spaceType: value })}
          placeholder="kallare, vinkyl, party cooler"
        />
        <LabeledInput
          label="Rader"
          value={storageSpaceDraft.rowCount}
          onChangeText={(value) => onDraftChange({ rowCount: value })}
          keyboardType="number-pad"
        />
      </DoubleRow>
      <LabeledInput
        label="Platser per rad"
        value={storageSpaceDraft.slotsPerRow}
        onChangeText={(value) => onDraftChange({ slotsPerRow: value })}
        keyboardType="number-pad"
      />
      <LabeledInput
        label="Anteckning"
        value={storageSpaceDraft.notes}
        onChangeText={(value) => onDraftChange({ notes: value })}
        placeholder="t.ex. översta hyllan blir varm"
      />

      <Pressable onPress={onSave} style={styles.primaryButton} disabled={savingStorageSpace}>
        <Text style={styles.primaryButtonText}>{savingStorageSpace ? "Sparar..." : "Lägg till plats"}</Text>
      </Pressable>

      {loadingStorageSpaces ? <LoadingInline label="Laddar förvaringsplatser..." /> : null}

      {!loadingStorageSpaces && storageSpaces.length === 0 ? (
        <Text style={styles.emptyState}>Inga förvaringsplatser ännu. Skapa din första ovan.</Text>
      ) : null}

      {storageSpaces.map((space) => {
        const bottleCount = storageSpaceBottleCounts.get(space.id) || 0;

        return (
          <View key={space.id} style={styles.storageSpaceCard}>
            <View style={styles.storageSpaceHeader}>
              <View style={styles.flex}>
                <Text style={styles.wineType}>{space.space_type}</Text>
                <Text style={styles.wineName}>{space.name}</Text>
                <Text style={styles.wineMeta}>
                  {space.row_count} rader • {space.slots_per_row} platser per rad
                </Text>
              </View>
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityBadgeText}>{bottleCount} st</Text>
              </View>
            </View>

            {space.notes ? <Text style={styles.notesText}>{space.notes}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable onPress={() => onDelete(space.id)}>
                <Text style={styles.dangerText}>Ta bort</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function ProductCatalogPanel({
  styles,
  loadingCatalogEntries,
  catalogEntries,
  onRefresh,
  onEdit,
  onDelete,
}: {
  styles: SharedStyles;
  loadingCatalogEntries: boolean;
  catalogEntries: ProductCatalogWineRow[];
  onRefresh: () => void;
  onEdit: (entry: ProductCatalogWineRow) => void;
  onDelete: (entry: ProductCatalogWineRow) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Produktkatalog</Text>
        <Pressable onPress={onRefresh}>
          <Text style={styles.linkText}>Uppdatera</Text>
        </Pressable>
      </View>

      <Text style={styles.notesText}>
        Här syns produkter appen redan känner igen. Om en streckkod inte ger träff kan du fylla i flaskan och spara den hit.
      </Text>

      {loadingCatalogEntries ? <LoadingInline label="Laddar produktkatalog..." /> : null}

      {!loadingCatalogEntries && catalogEntries.length === 0 ? (
        <Text style={styles.emptyState}>Katalogen är tom ännu. Första säkra träffen eller manuella sparning hamnar här.</Text>
      ) : null}

      {catalogEntries.map((entry) => (
        <View key={entry.id} style={styles.storageSpaceCard}>
          <Text style={styles.wineType}>{entry.source_label || "Katalog"}</Text>
          <Text style={styles.recommendationName}>{entry.name}</Text>
          <Text style={styles.notesText}>{[entry.producer, entry.country, entry.region, entry.grape].filter(Boolean).join(" • ")}</Text>
          <Text style={styles.notesText}>
            {[entry.barcode, entry.systembolaget_product_id ? `Art.nr ${entry.systembolaget_product_id}` : ""]
              .filter(Boolean)
              .join(" • ")}
          </Text>
          <View style={styles.actionRow}>
            <Pressable onPress={() => onEdit(entry)}>
              <Text style={styles.linkText}>Redigera</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(entry)}>
              <Text style={styles.dangerText}>Ta bort</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

export function MealPlannerPanel({
  styles,
  selectedMeal,
  mealSuggestions,
  mealRecommendations,
  onSelectMeal,
}: {
  styles: SharedStyles;
  selectedMeal: string;
  mealSuggestions: string[];
  mealRecommendations: WineRecord[];
  onSelectMeal: (value: string) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Vad ska vi äta?</Text>
        <Text style={styles.linkText}>{selectedMeal}</Text>
      </View>

      <SuggestionRow title="Välj maträtt" options={mealSuggestions} selected={selectedMeal} onSelect={onSelectMeal} />

      {mealRecommendations.length === 0 ? (
        <Text style={styles.emptyState}>Inga viner matchar den maten ännu. Lägg till fler matmatchningar på dina flaskor.</Text>
      ) : (
        mealRecommendations.map((wine) => (
          <View key={`meal-${wine.id}`} style={styles.recommendationCard}>
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
          </View>
        ))
      )}
    </View>
  );
}

export function WineCollectionPanel({
  styles,
  searchQuery,
  selectedPairingFilter,
  selectedCountryFilter,
  selectedRegionFilter,
  selectedTypeFilter,
  selectedVintageFilter,
  selectedStorageSpaceFilterId,
  pairingOptions,
  countryOptions,
  regionOptions,
  typeOptions,
  vintageOptions,
  storageSpaces,
  filteredWines,
  loading,
  storageSpaceById,
  onSearchChange,
  onPairingChange,
  onCountryChange,
  onRegionChange,
  onTypeChange,
  onVintageChange,
  onStorageSpaceFilterChange,
  onSignOut,
  onOpenSystembolaget,
  onEditWine,
  onDrinkWine,
  onDeleteWine,
}: {
  styles: SharedStyles;
  searchQuery: string;
  selectedPairingFilter: string;
  selectedCountryFilter: string;
  selectedRegionFilter: string;
  selectedTypeFilter: string;
  selectedVintageFilter: string;
  selectedStorageSpaceFilterId: string;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  storageSpaces: StorageSpaceRow[];
  filteredWines: WineRecord[];
  loading: boolean;
  storageSpaceById: Map<string, StorageSpaceRow>;
  onSearchChange: (value: string) => void;
  onPairingChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onVintageChange: (value: string) => void;
  onStorageSpaceFilterChange: (value: string) => void;
  onSignOut: () => void;
  onOpenSystembolaget: (productId: string) => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  onDeleteWine: (wineId: string, imagePath: string | null) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeaderRow}>
        <Text style={styles.panelTitle}>Min källare</Text>
        <Pressable onPress={onSignOut}>
          <Text style={styles.linkText}>Logga ut</Text>
        </Pressable>
      </View>

      <LabeledInput label="Sök" value={searchQuery} onChangeText={onSearchChange} placeholder="namn, druva, region, mat..." />

      <SuggestionRow title="Filtrera mat" options={pairingOptions} selected={selectedPairingFilter} onSelect={onPairingChange} />
      <SuggestionRow title="Filtrera land" options={countryOptions} selected={selectedCountryFilter} onSelect={onCountryChange} />
      <SuggestionRow title="Filtrera region" options={regionOptions} selected={selectedRegionFilter} onSelect={onRegionChange} />
      <SuggestionRow title="Filtrera typ" options={typeOptions} selected={selectedTypeFilter} onSelect={onTypeChange} />
      <SuggestionRow title="Filtrera årgång" options={vintageOptions} selected={selectedVintageFilter} onSelect={onVintageChange} />

      {storageSpaces.length > 0 ? (
        <StorageSpaceSelector
          title="Filtrera plats"
          spaces={storageSpaces}
          selectedId={selectedStorageSpaceFilterId}
          onSelect={onStorageSpaceFilterChange}
          clearLabel="Alla"
        />
      ) : null}

      {loading ? <LoadingInline /> : null}

      {!loading && filteredWines.length === 0 ? (
        <Text style={styles.emptyState}>Inga viner ännu. Lägg till din första flaska ovan.</Text>
      ) : null}

      {filteredWines.map((wine) => (
        <View key={wine.id} style={styles.wineCard}>
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
      ))}
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

      <Text style={styles.notesText}>
        Här hamnar flaskor du har druckit upp. De försvinner alltså inte ur minnet bara för att lagersaldot går ner till noll.
      </Text>

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
              <Text style={styles.locationText}>
                {getWineStoragePlacementLabel(entry, storageSpaceById) || entry.cellar_location || "Ingen plats sparad"}
              </Text>
            </View>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityBadgeText}>{entry.rating ? `${entry.rating}/5` : "Ej betygsatt"}</Text>
            </View>
          </View>

          <Text style={styles.notesText}>
            Dracks {new Date(entry.consumed_at).toLocaleDateString("sv-SE")} • {entry.quantity_consumed} flaska
            {entry.quantity_consumed > 1 ? "r" : ""}
          </Text>
          <Text style={styles.notesText}>{entry.tasting_notes || "Ingen smaknotering ännu."}</Text>
        </View>
      ))}
    </View>
  );
}
