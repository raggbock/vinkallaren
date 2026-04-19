import { useCallback, useEffect, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { hydrateWineRecords } from "../lib/wine-helpers";
import { createGuardedFetcher } from "../lib/guarded-fetcher";
import type { WineRecord, WineRow } from "../types/wine";

const WINES_PAGE_SIZE = 50;

export function useWines() {
  const [wines, setWines] = useState<WineRecord[]>([]);
  const [hasMoreWines, setHasMoreWines] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWines = useMemo(() => createGuardedFetcher(async () => {
    setLoading(true);
    const t0 = performance.now();
    const { data, error } = await supabase.from("wines").select("*").gt("quantity", 0).order("created_at", { ascending: false }).limit(WINES_PAGE_SIZE);
    const tSelect = performance.now();
    if (error) { showError("Kunde inte hämta viner", error.message); setLoading(false); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    const hydrated = await hydrateWineRecords(rows);
    console.log(`[perf] useWines start=${Math.round(t0)}ms select=${Math.round(tSelect - t0)}ms hydrate=${Math.round(performance.now() - tSelect)}ms rows=${rows.length}`);
    setWines(hydrated);
    setLoading(false);
  }), []);

  const fetchMoreWines = useCallback(async () => {
    if (!hasMoreWines) return;
    const offset = wines.length;
    const { data, error } = await supabase.from("wines").select("*").gt("quantity", 0).order("created_at", { ascending: false }).range(offset, offset + WINES_PAGE_SIZE - 1);
    if (error) { showError("Kunde inte hämta fler viner", error.message); return; }
    const rows = (data ?? []) as WineRow[];
    setHasMoreWines(rows.length === WINES_PAGE_SIZE);
    const hydrated = await hydrateWineRecords(rows);
    setWines((prev) => [...prev, ...hydrated]);
  }, [hasMoreWines, wines.length]);

  const deleteWine = useCallback(async (id: string, imagePath?: string | null) => {
    const { error } = await supabase.from("wines").delete().eq("id", id);
    if (error) { showError("Kunde inte ta bort", error.message); return; }
    if (imagePath) await supabase.storage.from("wine-images").remove([imagePath]).catch(() => {});
    setWines((current) => current.filter((wine) => wine.id !== id));
  }, []);

  useEffect(() => { void fetchWines(); }, []);

  return { wines, setWines, loading, fetchWines, fetchMoreWines, hasMoreWines, deleteWine };
}
