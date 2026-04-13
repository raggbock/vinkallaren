import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeLookupValue } from "../lib/cellar-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "../components/form-controls";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 150;

type SearchAsyncFn = (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;

export function useAutocompleteSearch({
  value, options, optionRows, searchAsync, minimumQueryLength = 1,
}: {
  value: string;
  options: string[];
  optionRows?: ReferenceOptionRow[];
  searchAsync?: SearchAsyncFn;
  minimumQueryLength?: number;
}) {
  const [asyncResults, setAsyncResults] = useState<Suggestion[]>([]);
  const [asyncHasMore, setAsyncHasMore] = useState(false);
  const [asyncOffset, setAsyncOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQueryRef = useRef("");

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // Async search (wine catalog)
  useEffect(() => {
    if (!searchAsync) return;
    const query = normalizeLookupValue(value);
    if (!query || query.length < minimumQueryLength) {
      setAsyncResults([]); setAsyncHasMore(false); setAsyncOffset(0);
      currentQueryRef.current = "";
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      currentQueryRef.current = query;
      void searchAsync(query, 0).then(({ suggestions, hasMore, nextOffset }) => {
        setAsyncResults(suggestions); setAsyncHasMore(hasMore); setAsyncOffset(nextOffset);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [value, searchAsync, minimumQueryLength]);

  // Client-side search (countries, regions, grapes)
  const clientSuggestions = useMemo((): Suggestion[] => {
    if (searchAsync) return [];
    const query = normalizeLookupValue(value);
    if (!query || query.length < minimumQueryLength) return [];

    const searchableOptions = optionRows?.length
      ? optionRows.map((row) => ({
          name: row.name, parentName: row.parent_name ?? null,
          haystack: [row.name, ...(row.aliases ?? []), row.parent_name ?? ""].join(" "),
        }))
      : options.map((option) => ({
          name: option, parentName: null as string | null, haystack: option,
        }));

    return searchableOptions
      .filter((option) => normalizeLookupValue(option.haystack).includes(query))
      .sort((left, right) => {
        const ln = normalizeLookupValue(left.name);
        const rn = normalizeLookupValue(right.name);
        const lStarts = ln.startsWith(query) ? 0 : 1;
        const rStarts = rn.startsWith(query) ? 0 : 1;
        if (lStarts !== rStarts) return lStarts - rStarts;
        const lIdx = ln.split(/\s+/).findIndex((w) => w.startsWith(query));
        const rIdx = rn.split(/\s+/).findIndex((w) => w.startsWith(query));
        if ((lIdx >= 0) !== (rIdx >= 0)) return lIdx >= 0 ? -1 : 1;
        if (lIdx >= 0 && rIdx >= 0 && lIdx !== rIdx) return lIdx - rIdx;
        return left.name.localeCompare(right.name);
      })
      .filter((option, index, all) => {
        const key = normalizeLookupValue(option.name) + "|" + normalizeLookupValue(option.parentName ?? "");
        return all.findIndex((o) => normalizeLookupValue(o.name) + "|" + normalizeLookupValue(o.parentName ?? "") === key) === index;
      })
      .slice(0, PAGE_SIZE * 5);
  }, [searchAsync, minimumQueryLength, optionRows, options, value]);

  const suggestions = searchAsync ? asyncResults : clientSuggestions;

  function loadMore() {
    if (!searchAsync || loadingMore || !asyncHasMore) return;
    const query = currentQueryRef.current;
    if (!query) return;
    setLoadingMore(true);
    const existingKeys = new Set(asyncResults.map((r) => normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
    void searchAsync(query, asyncOffset).then(({ suggestions: newResults, hasMore, nextOffset }) => {
      const unique = newResults.filter((r) => !existingKeys.has(normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      setAsyncResults((prev) => [...prev, ...unique]);
      setAsyncHasMore(hasMore); setAsyncOffset(nextOffset); setLoadingMore(false);
    });
  }

  return { suggestions, loadingMore, asyncHasMore, loadMore };
}
