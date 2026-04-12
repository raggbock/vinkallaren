import type { SessionDishRow, SessionTastingDishRow, SessionTastingRow, SessionWineRow } from "../types/tasting-session";
import type { WsetTastingData } from "./wset-data";

export type WineResult = {
  wine: SessionWineRow;
  tastings: SessionTastingRow[];
  averageRating: number | null;
  ratingSpread: number; // standard deviation
  consensus: "high" | "low"; // σ < 0.8 = high consensus
  qualityCounts: Record<string, number>; // WSET quality level → count
  averageQuality: string | null; // most common quality ≥ "good"
};

export type DishWineResult = {
  dish: SessionDishRow;
  wine: SessionWineRow;
  averageRating: number;
  tastingCount: number;
};

export type SessionResults = {
  format: "quick" | "wset";
  wineCount: number;
  participantCount: number;
  date: string;
  wines: WineResult[];
  favorite: WineResult | null; // highest avg rating (quick) or most quality ≥ good (wset)
  mostDivided: WineResult | null; // highest spread
  participantIds: string[];
  dishWineResults: DishWineResult[];
};

const CONSENSUS_THRESHOLD = 0.8;

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function averageRating(ratings: (number | null)[]): number | null {
  const valid = ratings.filter((r): r is number => r != null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function consensusLevel(spread: number): "high" | "low" {
  return spread < CONSENSUS_THRESHOLD ? "high" : "low";
}

const QUALITY_ORDER = ["poor", "acceptable", "good", "very good", "outstanding"];

function getWsetQuality(tasting: SessionTastingRow): string | null {
  const data = tasting.tasting_data as WsetTastingData | null;
  return data?.conclusions?.quality ?? null;
}

function buildWineResult(wine: SessionWineRow, tastings: SessionTastingRow[]): WineResult {
  const wineTastings = tastings.filter((t) => t.session_wine_id === wine.id);
  const ratings = wineTastings.map((t) => t.rating).filter((r): r is number => r != null);
  const avg = averageRating(wineTastings.map((t) => t.rating));
  const spread = stddev(ratings);

  const qualityCounts: Record<string, number> = {};
  for (const t of wineTastings) {
    const q = getWsetQuality(t);
    if (q) qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  }

  const goodOrBetter = Object.entries(qualityCounts)
    .filter(([k]) => QUALITY_ORDER.indexOf(k) >= 2)
    .sort((a, b) => b[1] - a[1]);

  return {
    wine,
    tastings: wineTastings,
    averageRating: avg,
    ratingSpread: spread,
    consensus: consensusLevel(spread),
    qualityCounts,
    averageQuality: goodOrBetter.length > 0 ? goodOrBetter[0][0] : null,
  };
}

function buildDishWineResults(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  dishes: SessionDishRow[],
  tastingDishes: SessionTastingDishRow[],
): DishWineResult[] {
  if (dishes.length === 0) return [];

  const wineMap = new Map(wines.map((w) => [w.id, w]));
  const results: DishWineResult[] = [];

  for (const dish of dishes) {
    const linkedTastingIds = new Set(
      tastingDishes.filter((td) => td.session_dish_id === dish.id).map((td) => td.session_tasting_id),
    );

    const byWine = new Map<string, number[]>();
    for (const t of tastings) {
      if (!linkedTastingIds.has(t.id) || t.rating == null) continue;
      const arr = byWine.get(t.session_wine_id) ?? [];
      arr.push(t.rating);
      byWine.set(t.session_wine_id, arr);
    }

    for (const [wineId, ratings] of byWine) {
      const wine = wineMap.get(wineId);
      if (!wine) continue;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      results.push({ dish, wine, averageRating: avg, tastingCount: ratings.length });
    }
  }

  results.sort((a, b) => b.averageRating - a.averageRating);
  return results;
}

export function buildSessionResults(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  format: "quick" | "wset",
  sessionDate: string,
  dishes: SessionDishRow[] = [],
  tastingDishes: SessionTastingDishRow[] = [],
): SessionResults {
  const participantIds = [...new Set(tastings.map((t) => t.user_id))];
  const wineResults = wines.map((w) => buildWineResult(w, tastings));

  // Sort: quick by avg rating desc, wset by quality level desc
  if (format === "quick") {
    wineResults.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  } else {
    wineResults.sort((a, b) => {
      const aIdx = QUALITY_ORDER.indexOf(a.averageQuality ?? "");
      const bIdx = QUALITY_ORDER.indexOf(b.averageQuality ?? "");
      return bIdx - aIdx;
    });
  }

  const favorite = format === "quick"
    ? wineResults.reduce<WineResult | null>((best, w) => (!best || (w.averageRating ?? 0) > (best.averageRating ?? 0)) ? w : best, null)
    : wineResults.find((w) => w.averageQuality != null) ?? null;

  const mostDivided = wineResults.reduce<WineResult | null>(
    (worst, w) => (!worst || w.ratingSpread > worst.ratingSpread) ? w : worst, null,
  );

  return {
    format,
    wineCount: wines.length,
    participantCount: participantIds.length,
    date: sessionDate,
    wines: wineResults,
    favorite,
    mostDivided: mostDivided && mostDivided.ratingSpread > 0 ? mostDivided : null,
    participantIds,
    dishWineResults: buildDishWineResults(wines, tastings, dishes, tastingDishes),
  };
}

/** Extract WSET parameter values from all tastings for a wine */
export function getWsetParameterComparison(tastings: SessionTastingRow[]): {
  param: string;
  label: string;
  counts: Record<string, number>;
}[] {
  const params: { key: string; label: string; path: (d: WsetTastingData) => string | null }[] = [
    { key: "sweetness", label: "Sötma", path: (d) => d.palate?.sweetness ?? null },
    { key: "acidity", label: "Syra", path: (d) => d.palate?.acidity ?? null },
    { key: "tannin", label: "Tannin", path: (d) => d.palate?.tannin ?? null },
    { key: "body", label: "Kropp", path: (d) => d.palate?.body ?? null },
    { key: "alcohol", label: "Alkohol", path: (d) => d.palate?.alcohol ?? null },
    { key: "finish", label: "Avslut", path: (d) => d.palate?.finish ?? null },
    { key: "noseIntensity", label: "Doftintensitet", path: (d) => d.nose?.intensity ?? null },
    { key: "flavourIntensity", label: "Smakintensitet", path: (d) => d.palate?.flavourIntensity ?? null },
  ];

  return params.map(({ key, label, path }) => {
    const counts: Record<string, number> = {};
    for (const t of tastings) {
      const data = t.tasting_data as WsetTastingData | null;
      if (!data) continue;
      const val = path(data);
      if (val) counts[val] = (counts[val] || 0) + 1;
    }
    return { param: key, label, counts };
  }).filter((p) => Object.keys(p.counts).length > 0);
}

/** Collect all aromas mentioned by 2+ participants for a wine */
export function getSharedAromas(tastings: SessionTastingRow[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tastings) {
    const data = t.tasting_data as WsetTastingData | null;
    if (!data) continue;
    const aromas = [...(data.nose?.aromas ?? []), ...(data.palate?.flavours ?? [])];
    const unique = new Set(aromas);
    for (const a of unique) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, c]) => c >= 2).map(([a]) => a);
}
