import { useEffect, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import {
  buildMealRecommendations,
  buildPairingOptions,
  buildStats,
  buildStorageSpaceBottleCounts,
  buildValueOptions,
  buildVintageOptions,
} from "../lib/cellar-helpers";
import { hydrateWineRecords } from "../lib/wine-helpers";
import type { WineRecord, WineRow } from "../types/wine";

const WINES_PAGE_SIZE = 50;

function createGuardedFetcher<T>(fn: () => Promise<T>): () => Promise<T | undefined> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = fn().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export function useWines() {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [hasMoreWines, setHasMoreWines] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchWinesRaw() {
    setLoading(true);
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).limit(WINES_PAGE_SIZE);
    if (error) { showError("Kunde inte hämta viner", error.message); setLoading(false); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    setWines(await hydrateWineRecords(rows));
    setLoading(false);
  }
  const fetchWines = createGuardedFetcher(fetchWinesRaw);

  async function fetchMoreWines() {
    if (!hasMoreWines) return;
    const offset = wines.length;
    const { data, error } = await supabase.from("wines").select("*").order("created_at", { ascending: false }).range(offset, offset + WINES_PAGE_SIZE - 1);
    if (error) { showError("Kunde inte hämta fler viner", error.message); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    const hydrated = await hydrateWineRecords(rows);
    setWines((prev) => [...prev, ...hydrated]);
  }

  async function deleteWine(id: string, imagePath?: string | null) {
    const { error } = await supabase.from("wines").delete().eq("id", id);
    if (error) { showError("Kunde inte ta bort", error.message); return; }
    if (imagePath) await supabase.storage.from("wine-images").remove([imagePath]).catch(() => {});
    setWines((current) => current.filter((wine) => wine.id !== id));
  }

  useEffect(() => { void fetchWines(); }, []);

  // Derived data
  const stats = useMemo(() => buildStats(wines), [wines]);
  const storageSpaceBottleCounts = useMemo(() => buildStorageSpaceBottleCounts(wines), [wines]);
  const pairingOptions = useMemo(() => buildPairingOptions(wines), [wines]);
  const countryOptions = useMemo(() => buildValueOptions(wines, (w) => w.country), [wines]);
  const regionOptions = useMemo(() => buildValueOptions(wines, (w) => w.region), [wines]);
  const typeOptions = useMemo(() => buildValueOptions(wines, (w) => w.type), [wines]);
  const vintageOptions = useMemo(() => buildVintageOptions(wines), [wines]);
  const cellarGrapeOptions = useMemo(() => buildValueOptions(wines, (w) => w.grape ?? null), [wines]);

  return {
    wines, setWines, loading,
    fetchWines, fetchMoreWines, hasMoreWines, deleteWine,
    stats, storageSpaceBottleCounts,
    pairingOptions, countryOptions, regionOptions, typeOptions, vintageOptions, cellarGrapeOptions,
    buildMealRecommendations: (meal: string) => buildMealRecommendations(wines, meal),
  };
}
