import { supabase } from "./supabase";
import type { Suggestion } from "../components/form-controls";
import type { CatalogTextMatch, CatalogImageMatch, ProductCatalogWineRow } from "../types/product-catalog";

let warmedUp = false;
/** Fire a minimal query to warm the Supabase connection + PG index cache. */
export function warmupCatalogSearch(): void {
  if (warmedUp) return;
  warmedUp = true;
  void supabase.rpc("autocomplete_catalog", { query: "vin", max_results: 1 }).then(() => {});
}

export async function searchCatalogWineNames(
  query: string, offset = 0,
): Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return { suggestions: [], hasMore: false, nextOffset: offset };

  const pageSize = 20;
  const { data, error } = await supabase.rpc("autocomplete_catalog", {
    query: trimmed,
    max_results: pageSize + 1,
    result_offset: offset,
  });
  if (error) return { suggestions: [], hasMore: false, nextOffset: offset };

  const rows = (data ?? []) as { id: string; name: string; producer: string | null; vintage: number | null; image_url: string | null; score: number }[];
  const hasMore = rows.length > pageSize;
  const results: Suggestion[] = rows.slice(0, pageSize).map((row) => ({
    name: row.name,
    parentName: row.producer ?? null,
  }));

  return { suggestions: results, hasMore, nextOffset: offset + results.length };
}

export async function fetchCatalogEntriesByName(name: string, producer?: string | null): Promise<ProductCatalogWineRow[]> {
  let query = supabase
    .from("product_catalog_wines")
    .select("*")
    .ilike("name", name);
  if (producer) query = query.ilike("producer", producer);
  const { data, error } = await query.order("vintage", { ascending: false, nullsFirst: false });
  if (error) return [];
  return (data ?? []) as ProductCatalogWineRow[];
}

export async function matchCatalogByText(query: string, maxResults = 5, rawOcrQuery?: string, vintage?: number | null): Promise<CatalogTextMatch[]> {
  if (query.trim().length < 3) return [];

  const rpcParams: Record<string, unknown> = {
    query: query.trim(),
    max_results: maxResults,
  };
  if (vintage) rpcParams.query_vintage = vintage;

  // Run both queries in parallel if we have a separate raw OCR query
  const rawTrimmed = rawOcrQuery?.trim() ?? "";
  const needsRawQuery = rawTrimmed.length >= 3 && rawTrimmed !== query.trim();

  const [primaryRes, extraRes] = await Promise.all([
    supabase.rpc("match_catalog_by_text", rpcParams),
    needsRawQuery
      ? supabase.rpc("match_catalog_by_text", { ...rpcParams, query: rawTrimmed })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const primary = (!primaryRes.error && primaryRes.data ? primaryRes.data : []) as CatalogTextMatch[];
  if (extraRes.data) {
    const seenIds = new Set(primary.map((m) => m.id));
    for (const match of extraRes.data as CatalogTextMatch[]) {
      if (!seenIds.has(match.id)) {
        primary.push(match);
        seenIds.add(match.id);
      }
    }
  }

  // Re-sort by similarity descending and cap
  return primary.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
}

/** Match catalog wines by perceptual image hash. Tries multiple crop hashes. */
export async function matchCatalogByImage(
  hashes: { label: string; hash: string }[],
  maxResults = 5,
): Promise<CatalogImageMatch[]> {
  // Query all crop variants in parallel
  const results = await Promise.all(
    hashes.map((h) => supabase.rpc("match_catalog_by_image", {
      query_hash: h.hash,
      max_results: maxResults,
    }))
  );

  // Merge: keep best (lowest) distance per wine across all crops
  const best = new Map<string, CatalogImageMatch>();
  for (const res of results) {
    for (const match of (res.data ?? []) as CatalogImageMatch[]) {
      const existing = best.get(match.id);
      if (!existing || match.hash_distance < existing.hash_distance) {
        best.set(match.id, match);
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => a.hash_distance - b.hash_distance)
    .slice(0, maxResults);
}

/** Combine text and image matches into a single ranked list */
export function mergeHybridMatches(
  textMatches: CatalogTextMatch[],
  imageMatches: CatalogImageMatch[],
  maxResults = 5,
): CatalogTextMatch[] {
  const merged = new Map<string, CatalogTextMatch>();

  // Text matches: similarity is already 0-1
  for (const m of textMatches) {
    merged.set(m.id, { ...m });
  }

  // Image matches: convert distance (0-64) to similarity (0-1), blend in
  for (const m of imageMatches) {
    const imgSim = 1 - m.hash_distance / 64;
    const existing = merged.get(m.id);
    if (existing) {
      // Hybrid score: boost text similarity with image similarity
      existing.similarity = 0.6 * existing.similarity + 0.4 * imgSim;
    } else {
      // Image-only match (OCR didn't find it)
      merged.set(m.id, {
        id: m.id,
        name: m.name,
        producer: m.producer,
        vintage: m.vintage,
        image_url: m.image_url,
        similarity: 0.4 * imgSim,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}
