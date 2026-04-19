import { useCallback, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { GRAPE_VARIETIES, WINE_COUNTRIES, WINE_REGIONS } from "../lib/reference-data";
import { mergeReferenceRows } from "../lib/wine-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { WineRow } from "../types/wine";

export function useReferenceOptions() {
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionRow[]>([]);

  const fetchReferenceOptions = useCallback(async () => {
    const { data, error } = await supabase.from("reference_options").select("*").in("category", ["grape", "country", "region"]).order("category", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (error) { showError("Kunde inte hämta referensdata", error.message); return; }
    setReferenceOptions((data ?? []) as ReferenceOptionRow[]);
  }, []);

  const mergeReferenceOptions = useCallback(function mergeReferenceOptions(wine: WineRow) {
    setReferenceOptions(prev => {
      const additions: ReferenceOptionRow[] = [];
      for (const [category, value] of [["grape", wine.grape], ["country", wine.country], ["region", wine.region]] as const) {
        if (value && !prev.some(o => o.category === category && o.name === value)) {
          additions.push({ category, name: value, sort_order: 999, id: `local-${category}-${value}`, aliases: [], parent_name: null, created_at: "", updated_at: "" });
        }
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, []);

  // Reference rows
  const grapeReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "grape")), [referenceOptions]);
  const countryReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "country")), [referenceOptions]);
  const regionReferenceRows = useMemo(() => mergeReferenceRows(referenceOptions.filter((o) => o.category === "region")), [referenceOptions]);
  const grapeOptions = useMemo(() => grapeReferenceRows.map((o) => o.name), [grapeReferenceRows]);
  const countryReferenceOptions = useMemo(() => countryReferenceRows.map((o) => o.name), [countryReferenceRows]);
  const regionReferenceOptions = useMemo(() => regionReferenceRows.map((o) => o.name), [regionReferenceRows]);

  const effectiveGrapeOptions = useMemo(() => grapeOptions.length > 0 ? grapeOptions : GRAPE_VARIETIES, [grapeOptions]);
  const effectiveCountryOptions = useMemo(() => countryReferenceOptions.length > 0 ? countryReferenceOptions : WINE_COUNTRIES, [countryReferenceOptions]);
  const effectiveRegionOptions = useMemo(() => regionReferenceOptions.length > 0 ? regionReferenceOptions : WINE_REGIONS, [regionReferenceOptions]);

  return {
    referenceOptions, fetchReferenceOptions, mergeReferenceOptions,
    grapeReferenceRows, countryReferenceRows, regionReferenceRows,
    effectiveGrapeOptions, effectiveCountryOptions, effectiveRegionOptions,
  };
}
