import { useMemo, useState } from "react";

import { getWineStoragePlacementLabel, normalizeLookupValue } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

export function useCellarFilters(wines: WineRecord[], storageSpaceById: Map<string, StorageSpaceRow>) {
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [selectedGrapeFilter, setSelectedGrapeFilter] = useState("Alla");
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
      const matchesGrape = selectedGrapeFilter === "Alla" || wine.grape === selectedGrapeFilter;
      const matchesStorageSpace =
        !selectedStorageSpaceFilterId || wine.storage_space_id === selectedStorageSpaceFilterId;
      const normalizedQuery = normalizeLookupValue(searchQuery.trim());
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
          .some((value) => normalizeLookupValue(String(value)).includes(normalizedQuery));

      return (
        matchesPairing &&
        matchesCountry &&
        matchesRegion &&
        matchesType &&
        matchesVintage &&
        matchesGrape &&
        matchesStorageSpace &&
        matchesSearch
      );
    });
  }, [
    selectedStorageSpaceFilterId,
    searchQuery,
    selectedCountryFilter,
    selectedGrapeFilter,
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
    selectedGrapeFilter,
    setSelectedGrapeFilter,
    selectedStorageSpaceFilterId,
    setSelectedStorageSpaceFilterId,
    filteredWines,
  };
}
