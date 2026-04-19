import { useCallback, useMemo, useState } from "react";
import type { CellarFilterState } from "../types/cellar-aggregate";

export function useCellarFilters() {
  const [selectedPairingFilter, setSelectedPairingFilter] = useState("Alla");
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("Alla");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState("Alla");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("Alla");
  const [selectedVintageFilter, setSelectedVintageFilter] = useState("Alla");
  const [selectedGrapeFilter, setSelectedGrapeFilter] = useState("Alla");
  const [selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filterState: CellarFilterState = useMemo(() => {
    const f: CellarFilterState = {};
    if (selectedCountryFilter !== "Alla") f.country = selectedCountryFilter;
    if (selectedRegionFilter !== "Alla")  f.region  = selectedRegionFilter;
    if (selectedTypeFilter !== "Alla")    f.type    = selectedTypeFilter;
    if (selectedGrapeFilter !== "Alla")   f.grape   = selectedGrapeFilter;
    if (selectedVintageFilter !== "Alla") f.vintage = selectedVintageFilter;
    if (selectedPairingFilter !== "Alla") f.pairing = selectedPairingFilter;
    if (selectedStorageSpaceFilterId)     f.storage_space_id = selectedStorageSpaceFilterId;
    return f;
  }, [
    selectedCountryFilter, selectedRegionFilter, selectedTypeFilter,
    selectedGrapeFilter, selectedVintageFilter, selectedPairingFilter,
    selectedStorageSpaceFilterId,
  ]);

  const resetFilters = useCallback(() => {
    setSelectedPairingFilter("Alla");
    setSelectedCountryFilter("Alla");
    setSelectedRegionFilter("Alla");
    setSelectedTypeFilter("Alla");
    setSelectedVintageFilter("Alla");
    setSelectedGrapeFilter("Alla");
    setSelectedStorageSpaceFilterId("");
    setSearchQuery("");
  }, []);

  return {
    searchQuery, setSearchQuery,
    selectedPairingFilter, setSelectedPairingFilter,
    selectedCountryFilter, setSelectedCountryFilter,
    selectedRegionFilter, setSelectedRegionFilter,
    selectedTypeFilter, setSelectedTypeFilter,
    selectedVintageFilter, setSelectedVintageFilter,
    selectedGrapeFilter, setSelectedGrapeFilter,
    selectedStorageSpaceFilterId, setSelectedStorageSpaceFilterId,
    filterState, resetFilters,
  };
}
