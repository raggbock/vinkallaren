import { supabase } from "./supabase";
import { normalizeLookupValue } from "./cellar-helpers";
import type { Suggestion } from "../components/form-controls";
import type { CatalogTextMatch, ProductCatalogWineRow } from "../types/product-catalog";

const BATCH_SIZE = 50;

export async function searchCatalogWineNames(
  query: string, offset = 0,
): Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }> {
  const { data, error } = await supabase
    .from("product_catalog_wines")
    .select("name, producer")
    .ilike("name", `%${query}%`)
    .order("name", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);
  if (error) return { suggestions: [], hasMore: false, nextOffset: offset };

  const seen = new Set<string>();
  const results: Suggestion[] = [];
  for (const row of data ?? []) {
    const key = normalizeLookupValue(row.name) + "|" + normalizeLookupValue(row.producer ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ name: row.name, parentName: row.producer ?? null });
  }
  results.sort((a, b) => {
    const aStarts = normalizeLookupValue(a.name).startsWith(query) ? 0 : 1;
    const bStarts = normalizeLookupValue(b.name).startsWith(query) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });
  const rowCount = (data ?? []).length;
  return { suggestions: results, hasMore: rowCount === BATCH_SIZE, nextOffset: offset + rowCount };
}

export async function fetchCatalogEntriesByName(name: string): Promise<ProductCatalogWineRow[]> {
  const { data, error } = await supabase
    .from("product_catalog_wines")
    .select("*")
    .ilike("name", name)
    .order("updated_at", { ascending: false });
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
