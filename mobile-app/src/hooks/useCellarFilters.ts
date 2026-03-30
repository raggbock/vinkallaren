import { useMemo, useState } from "react";

import { getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

export function useCellarFilters(wines: WineRecord[], storageSpaceById: Map<string, StorageSpaceRow>) {
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWines = useMemo(() => {
    return wines.filter((wine) => {
      const matchesPairing =
        selectedPairingFilter === "Alla" || wine.food_pairings.includes(selectedPairingFilter);
      const matchesCountry = selectedCountryFilter === "Alla" || wine.country === selectedCountryFilter;
      const matchesRegion = selectedRegionFilter === "Alla" || wine.region === selectedRegionFilter;
      const matchesType = selectedTypeFilter === "Alla" || wine.type === selectedTypeFilter;
      const matchesVintage =
        selectedVintageFilter === "Alla" || String(wine.vintage ?? "") === selectedVintageFilter;
      const matchesStorageSpace =
        !selectedStorageSpaceFilterId || wine.storage_space_id === selectedStorageSpaceFilterId;
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const matchesSearch =
        normalizedQuery.length === 0 ||
        [
          wine.name,
          wine.producer,
          wine.country,
          wine.region,
          wine.grape,
          wine.type,
          wine.cellar_location,
          getWineStoragePlacementLabel(wine, storageSpaceById),
          storageSpaceById.get(wine.storage_space_id ?? "")?.name,
          ...wine.food_pairings,
          ...wine.tags,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return (
        matchesPairing &&
        matchesCountry &&
        matchesRegion &&
        matchesType &&
        matchesVintage &&
        matchesStorageSpace &&
        matchesSearch
      );
    });
  }, [
    selectedStorageSpaceFilterId,
    searchQuery,
    selectedCountryFilter,
    selectedPairingFilter,
    selectedRegionFilter,
    selectedTypeFilter,
    selectedVintageFilter,
    storageSpaceById,
    wines,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    selectedPairingFilter,
    setSelectedPairingFilter,
    selectedCountryFilter,
    setSelectedCountryFilter,
    selectedRegionFilter,
    setSelectedRegionFilter,
    selectedTypeFilter,
    setSelectedTypeFilter,
    selectedVintageFilter,
    setSelectedVintageFilter,
    selectedStorageSpaceFilterId,
    setSelectedStorageSpaceFilterId,
    filteredWines,
  };
}
