import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { normalizeLookupValue } from "../lib/cellar-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "../components/form-controls";

const PAGE_SIZE = 10;
const MAX_SUGGESTIONS = 50;
const SEARCH_DEBOUNCE_MS = 150;
const SCROLL_THRESHOLD = 40;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [asyncResults, setAsyncResults] = useState<Suggestion[]>([]);
  const [asyncHasMore, setAsyncHasMore] = useState(false);
  const [asyncOffset, setAsyncOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQueryRef = useRef("");

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

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
        setAsyncResults(suggestions); setAsyncHasMore(hasMore);
        setAsyncOffset(nextOffset); setVisibleCount(PAGE_SIZE);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [value, searchAsync, minimumQueryLength]);

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
      .sort((left, right) => rankSuggestion(left, right, query))
      .filter((option, index, all) => {
        const key = normalizeLookupValue(option.name) + "|" + normalizeLookupValue(option.parentName ?? "");
        return all.findIndex((o) => normalizeLookupValue(o.name) + "|" + normalizeLookupValue(o.parentName ?? "") === key) === index;
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [searchAsync, minimumQueryLength, optionRows, options, value]);

  const suggestions = searchAsync ? asyncResults : clientSuggestions;
  const visibleSuggestions = suggestions.slice(0, visibleCount);

  function loadMoreAsync() {
    if (!searchAsync || loadingMore || !asyncHasMore) return;
    const query = currentQueryRef.current;
    if (!query) return;
    setLoadingMore(true);
    void searchAsync(query, asyncOffset).then(({ suggestions: newResults, hasMore, nextOffset }) => {
      const existingKeys = new Set(asyncResults.map((r) => normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      const unique = newResults.filter((r) => !existingKeys.has(normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      setAsyncResults((prev) => [...prev, ...unique]);
      setAsyncHasMore(hasMore); setAsyncOffset(nextOffset); setLoadingMore(false);
    });
  }

  const prefetchThreshold = Math.floor(suggestions.length * 0.8);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < SCROLL_THRESHOLD && visibleCount < suggestions.length) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, suggestions.length));
    }
    if (searchAsync && asyncHasMore && !loadingMore && visibleCount >= prefetchThreshold) {
      loadMoreAsync();
    }
  }

  function resetVisibleCount() { setVisibleCount(PAGE_SIZE); }

  return { suggestions, visibleSuggestions, loadingMore, asyncHasMore, handleScroll, resetVisibleCount };
}

function rankSuggestion(
  left: { name: string; haystack: string },
  right: { name: string; haystack: string },
  query: string,
): number {
  const leftName = normalizeLookupValue(left.name);
  const rightName = normalizeLookupValue(right.name);
  const leftStarts = leftName.startsWith(query) ? 0 : 1;
  const rightStarts = rightName.startsWith(query) ? 0 : 1;
  if (leftStarts !== rightStarts) return leftStarts - rightStarts;
  const leftIdx = leftName.split(/\s+/).findIndex((w) => w.startsWith(query));
  const rightIdx = rightName.split(/\s+/).findIndex((w) => w.startsWith(query));
  const leftWord = leftIdx >= 0 ? 0 : 1;
  const rightWord = rightIdx >= 0 ? 0 : 1;
  if (leftWord !== rightWord) return leftWord - rightWord;
  if (leftIdx >= 0 && rightIdx >= 0 && leftIdx !== rightIdx) return leftIdx - rightIdx;
  const leftHay = normalizeLookupValue(left.haystack).startsWith(query) ? 0 : 1;
  const rightHay = normalizeLookupValue(right.haystack).startsWith(query) ? 0 : 1;
  if (leftHay !== rightHay) return leftHay - rightHay;
  return left.name.localeCompare(right.name);
}
