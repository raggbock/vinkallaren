import { supabase } from "./supabase";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../types/tasting-session";
import type { WsetTastingData } from "./wset-data";

export type TasteProfileData = {
  ready: boolean; // false if < 2 completed sessions
  stats: {
    totalSessions: number;
    totalWines: number;
    lastSessionDate: string | null;
    mostCommonFormat: "quick" | "wset" | null;
  };
  preferences: PreferenceBar[]; // WSET only, wines rated ≥ good
  topRegions: { name: string; count: number }[];
  topGrapes: { name: string; count: number }[];
  history: SessionSummary[];
};

export type PreferenceBar = {
  label: string;
  values: { name: string; pct: number }[];
};

export type SessionSummary = {
  id: string;
  title: string;
  date: string;
  format: "quick" | "wset";
  wineCount: number;
  status: string;
};

const QUALITY_GOOD_OR_BETTER = ["good", "very good", "outstanding"];

export async function fetchTasteProfile(userId: string): Promise<TasteProfileData> {
  // 1. Fetch all user's tastings
  const { data: tastings } = await supabase
    .from("session_tastings")
    .select("*")
    .eq("user_id", userId);
  if (!tastings || tastings.length === 0) return emptyProfile();

  // 2. Get unique session IDs
  const sessionIds = [...new Set((tastings as SessionTastingRow[]).map((t) => t.session_id))];

  // 3. Fetch sessions and wines in parallel
  const [sessionsRes, winesRes] = await Promise.all([
    supabase.from("tasting_sessions").select("*").in("id", sessionIds).order("created_at", { ascending: false }),
    supabase.from("session_wines").select("*").in("session_id", sessionIds),
  ]);

  const sessions = (sessionsRes.data ?? []) as TastingSessionRow[];
  const wines = (winesRes.data ?? []) as SessionWineRow[];
  const endedSessions = sessions.filter((s) => s.status === "ended");

  return buildTasteProfile(tastings as SessionTastingRow[], wines, sessions, endedSessions);
}

export function buildTasteProfile(
  tastings: SessionTastingRow[],
  wines: SessionWineRow[],
  allSessions: TastingSessionRow[],
  endedSessions: TastingSessionRow[],
): TasteProfileData {
  if (endedSessions.length < 2) return emptyProfile();

  // Stats
  const formats = endedSessions.map((s) => s.format);
  const quickCount = formats.filter((f) => f === "quick").length;
  const wsetCount = formats.filter((f) => f === "wset").length;

  const stats = {
    totalSessions: endedSessions.length,
    totalWines: tastings.length,
    lastSessionDate: endedSessions[0]?.created_at ?? null,
    mostCommonFormat: (quickCount >= wsetCount ? "quick" : "wset") as "quick" | "wset",
  };

  // WSET preferences — only from wines rated ≥ good
  const preferences = buildPreferences(tastings);

  // Top regions & grapes (from all tasted wines, only shown if 5+ have data)
  const tastedWineIds = new Set(tastings.map((t) => t.session_wine_id));
  const tastedWines = wines.filter((w) => tastedWineIds.has(w.id));
  const regionItems = tastedWines.map((w) => w.region).filter((r): r is string => r != null);
  const grapeItems = tastedWines.map((w) => w.grape).filter((g): g is string => g != null);
  const topRegions = regionItems.length >= 5 ? topN(regionItems, 3) : [];
  const topGrapes = grapeItems.length >= 5 ? topN(grapeItems, 3) : [];

  // History
  const wineCountMap = new Map<string, number>();
  for (const w of wines) wineCountMap.set(w.session_id, (wineCountMap.get(w.session_id) ?? 0) + 1);

  const history: SessionSummary[] = allSessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.created_at,
    format: s.format,
    wineCount: wineCountMap.get(s.id) ?? 0,
    status: s.status,
  }));

  return { ready: true, stats, preferences, topRegions, topGrapes, history };
}

function buildPreferences(tastings: SessionTastingRow[]): PreferenceBar[] {
  const goodTastings = tastings.filter((t) => {
    const data = t.tasting_data as WsetTastingData | null;
    return data?.conclusions?.quality && QUALITY_GOOD_OR_BETTER.includes(data.conclusions.quality);
  });
  if (goodTastings.length < 3) return [];

  const params: { key: string; label: string; path: (d: WsetTastingData) => string | null }[] = [
    { key: "acidity", label: "Syra", path: (d) => d.palate?.acidity ?? null },
    { key: "body", label: "Kropp", path: (d) => d.palate?.body ?? null },
    { key: "sweetness", label: "Sötma", path: (d) => d.palate?.sweetness ?? null },
    { key: "tannin", label: "Tannin", path: (d) => d.palate?.tannin ?? null },
    { key: "alcohol", label: "Alkohol", path: (d) => d.palate?.alcohol ?? null },
  ];

  return params.map(({ label, path }) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const t of goodTastings) {
      const val = path(t.tasting_data as WsetTastingData);
      if (val) { counts[val] = (counts[val] || 0) + 1; total++; }
    }
    const values = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, pct: total > 0 ? count / total : 0 }));
    return { label, values };
  }).filter((p) => p.values.length > 0);
}

function topN(items: string[], n: number): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function emptyProfile(): TasteProfileData {
  return {
    ready: false,
    stats: { totalSessions: 0, totalWines: 0, lastSessionDate: null, mostCommonFormat: null },
    preferences: [],
    topRegions: [],
    topGrapes: [],
    history: [],
  };
}
