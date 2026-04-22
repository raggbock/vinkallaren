import { useCallback, useMemo } from "react";
import { openSystembolaget } from "../lib/cellar-actions";
import { confirmAction, showError } from "../lib/show-error";
import { useCellarActions, useCellarAggregate, useCellarFiltersContext } from "../contexts/CellarContext";
import { MinKallarePanel } from "./min-kallare-panel";
import { styles } from "../styles/theme";
import type { StorageProps } from "../types/panel-prop-groups";
import type { WineRecord } from "../types/wine";

type Props = {
  hidden: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onNavigateToAdd: () => void;
  onOpenProfile: () => void;
  onEditWine: (wine: WineRecord) => void;
  onDrinkWine: (wine: WineRecord) => void;
  storage: StorageProps;
  highlightedWineId?: string | null;
  onClearHighlight?: () => void;
  onHighlightWine?: (wineId: string) => void;
};

const ALLA = "Alla";
const withAlla = (values: string[]) => [ALLA, ...values];

export function CellarTab(props: Props) {
  const { aggregate, aggregateLoading } = useCellarAggregate();
  const { deleteWine, refreshAggregate } = useCellarActions();
  const filters = useCellarFiltersContext();

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
    pairingOptions: withAlla(aggregate.filterOptions.pairings),
    countryOptions: withAlla(aggregate.filterOptions.countries),
    regionOptions:  withAlla(aggregate.filterOptions.regions),
    typeOptions:    withAlla(aggregate.filterOptions.types),
    vintageOptions: withAlla(aggregate.filterOptions.vintages),
    grapeOptions:   withAlla(aggregate.filterOptions.grapes),
    onSearchChange: filters.setSearchQuery,
    onPairingChange: filters.setSelectedPairingFilter,
    onCountryChange: filters.setSelectedCountryFilter,
    onRegionChange: filters.setSelectedRegionFilter,
    onTypeChange: filters.setSelectedTypeFilter,
    onVintageChange: filters.setSelectedVintageFilter,
    onGrapeChange: filters.setSelectedGrapeFilter,
    onStorageSpaceFilterChange: filters.setSelectedStorageSpaceFilterId,
  }), [
    aggregate.filterOptions,
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
  ]);

  const wineActionsProps = useMemo(() => ({
    onEditWine: props.onEditWine,
    onDrinkWine: props.onDrinkWine,
    onDeleteWine: (id: string, imagePath: string | null) =>
      confirmAction("Ta bort vin", "Är du säker på att du vill ta bort det här vinet?",
        () => deleteWine(id, imagePath)),
    onOpenSystembolaget: handleOpenSystembolaget,
  }), [props.onEditWine, props.onDrinkWine, deleteWine, handleOpenSystembolaget]);

  return (
    <MinKallarePanel
      styles={styles}
      stats={aggregate.stats}
      aggregate={aggregate}
      filter={filterProps}
      storage={props.storage}
      wineActions={wineActionsProps}
      loading={aggregateLoading}
      onRefreshStats={refreshAggregate}
      onSignOut={props.onOpenProfile}
      onNavigateToAdd={props.onNavigateToAdd}
      highlightedWineId={props.highlightedWineId}
      onClearHighlight={props.onClearHighlight}
      onHighlightWine={props.onHighlightWine}
      refreshing={props.refreshing}
      onRefresh={props.onRefresh}
    />
  );
}
