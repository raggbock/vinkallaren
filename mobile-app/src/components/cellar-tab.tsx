import { useCallback, useMemo, useState } from "react";
import { openSystembolaget } from "../lib/cellar-actions";
import { buildMealRecommendations } from "../lib/cellar-helpers";
import { confirmAction, showError } from "../lib/show-error";
import { useCellar } from "../contexts/CellarContext";
import { useCellarFilters } from "../hooks/useCellarFilters";
import { MealPlannerPanel } from "./cellar-sections";
import { MinKallarePanel } from "./min-kallare-panel";
import { styles } from "../styles/theme";
import type { StorageProps } from "../types/panel-prop-groups";
import type { WineRecord } from "../types/wine";

type Stats = {
  totalBottles: number;
  totalLabels: number;
  topCountry: string;
  topType: string;
  topPairing: string;
  averageVintage: string;
};

type Props = {
  hidden: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onNavigateToAdd: () => void;
  onOpenProfile: () => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  storage: StorageProps;
  stats: Stats;
  onRefreshStats: () => void;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  onHighlightWine?: (wineId: string) => void;
};

export function CellarTab(props: Props) {
  const ctx = useCellar();
  const filters = useCellarFilters(ctx.wines, ctx.storageSpaceById);
  const [selectedMeal, setSelectedMeal] = useState("");
  const mealRecommendations = useMemo(
    () => selectedMeal ? buildMealRecommendations(ctx.wines, selectedMeal) : [],
    [selectedMeal, ctx.wines],
  );

  const handleOpenSystembolaget = useCallback(async (productId: string) => {
    const result = await openSystembolaget(productId);
    if (result.error) showError("Kunde inte öppna länken", result.error);
  }, []);

  const filterProps = useMemo(() => ({
    searchQuery: filters.searchQuery,
    selectedPairingFilter: filters.selectedPairingFilter,
    selectedCountryFilter: filters.selectedCountryFilter,
    selectedRegionFilter: filters.selectedRegionFilter,
    selectedTypeFilter: filters.selectedTypeFilter,
    selectedVintageFilter: filters.selectedVintageFilter,
    selectedGrapeFilter: filters.selectedGrapeFilter,
    selectedStorageSpaceFilterId: filters.selectedStorageSpaceFilterId,
    pairingOptions: ctx.pairingOptions,
    countryOptions: ctx.countryOptions,
    regionOptions: ctx.regionOptions,
    typeOptions: ctx.typeOptions,
    vintageOptions: ctx.vintageOptions,
    grapeOptions: ctx.cellarGrapeOptions,
    onSearchChange: filters.setSearchQuery,
    onPairingChange: filters.setSelectedPairingFilter,
    onCountryChange: filters.setSelectedCountryFilter,
    onRegionChange: filters.setSelectedRegionFilter,
    onTypeChange: filters.setSelectedTypeFilter,
    onVintageChange: filters.setSelectedVintageFilter,
    onGrapeChange: filters.setSelectedGrapeFilter,
    onStorageSpaceFilterChange: filters.setSelectedStorageSpaceFilterId,
  }), [
    filters.searchQuery,
    filters.selectedPairingFilter,
    filters.selectedCountryFilter,
    filters.selectedRegionFilter,
    filters.selectedTypeFilter,
    filters.selectedVintageFilter,
    filters.selectedGrapeFilter,
    filters.selectedStorageSpaceFilterId,
    filters.setSearchQuery,
    filters.setSelectedPairingFilter,
    filters.setSelectedCountryFilter,
    filters.setSelectedRegionFilter,
    filters.setSelectedTypeFilter,
    filters.setSelectedVintageFilter,
    filters.setSelectedGrapeFilter,
    filters.setSelectedStorageSpaceFilterId,
    ctx.pairingOptions,
    ctx.countryOptions,
    ctx.regionOptions,
    ctx.typeOptions,
    ctx.vintageOptions,
    ctx.cellarGrapeOptions,
  ]);

  const wineActionsProps = useMemo(() => ({
    onEditWine: props.onEditWine,
    onDrinkWine: props.onDrinkWine,
    onDeleteWine: (id: string, imagePath: string | null) =>
      confirmAction("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?", () => ctx.deleteWine(id, imagePath)),
    onOpenSystembolaget: handleOpenSystembolaget,
  }), [props.onEditWine, props.onDrinkWine, ctx.deleteWine, handleOpenSystembolaget]);

  return (
    <>
      <MinKallarePanel
        styles={styles}
        stats={props.stats}
        filter={filterProps}
        storage={props.storage}
        wineActions={wineActionsProps}
        filteredWines={filters.filteredWines}
        loading={ctx.winesLoading}
        onRefreshStats={props.onRefreshStats}
        onSignOut={props.onOpenProfile}
        onNavigateToAdd={props.onNavigateToAdd}
        hasMoreWines={ctx.hasMoreWines}
        onLoadMoreWines={ctx.fetchMoreWines}
        highlightedWineId={props.highlightedWineId}
        onClearHighlight={props.onClearHighlight}
        onHighlightWine={props.onHighlightWine}
        refreshing={props.refreshing}
        onRefresh={props.onRefresh}
      />
      <MealPlannerPanel
        styles={styles}
        wines={ctx.wines}
        selectedMeal={selectedMeal}
        mealRecommendations={mealRecommendations}
        onSelectMeal={setSelectedMeal}
        onWinePress={(wine) => props.onHighlightWine?.(wine.id)}
      />
    </>
  );
}
