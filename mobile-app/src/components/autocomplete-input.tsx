import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

import { normalizeLookupValue } from "../lib/cellar-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "./form-controls";

const BLUR_DELAY_MS = 220;
const PAGE_SIZE = 10;
const MAX_SUGGESTIONS = 50;
const SEARCH_DEBOUNCE_MS = 300;
const SCROLL_THRESHOLD = 40;

export function AutocompleteInput({
  label, value, onChangeText, onOptionSelected, options, optionRows,
  searchAsync, placeholder, minimumQueryLength = 1, editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onOptionSelected?: (value: string, parentName?: string | null) => void;
  options: string[];
  optionRows?: ReferenceOptionRow[];
  searchAsync?: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  placeholder?: string;
  minimumQueryLength?: number;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [asyncResults, setAsyncResults] = useState<Suggestion[]>([]);
  const [asyncHasMore, setAsyncHasMore] = useState(false);
  const [asyncOffset, setAsyncOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQueryRef = useRef("");

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!searchAsync) return;
    const query = normalizeLookupValue(value);
    if (!query || query.length < minimumQueryLength) {
      setAsyncResults([]);
      setAsyncHasMore(false);
      setAsyncOffset(0);
      currentQueryRef.current = "";
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      currentQueryRef.current = query;
      void searchAsync(query, 0).then(({ suggestions, hasMore, nextOffset }) => {
        setAsyncResults(suggestions);
        setAsyncHasMore(hasMore);
        setAsyncOffset(nextOffset);
        setVisibleCount(PAGE_SIZE);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
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
      .sort((left, right) => {
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
      })
      .filter((option, index, all) => {
        const key = normalizeLookupValue(option.name) + "|" + normalizeLookupValue(option.parentName ?? "");
        return all.findIndex((o) => normalizeLookupValue(o.name) + "|" + normalizeLookupValue(o.parentName ?? "") === key) === index;
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [searchAsync, minimumQueryLength, optionRows, options, value]);

  const suggestions = searchAsync ? asyncResults : clientSuggestions;
  const visibleSuggestions = suggestions.slice(0, visibleCount);
  const showSuggestions = focused && value.trim().length > 0 && suggestions.length > 0
    && !(suggestions.length === 1 && normalizeLookupValue(suggestions[0].name) === normalizeLookupValue(value));

  function cancelBlur() {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
  }

  function selectOption(option: Suggestion) {
    cancelBlur();
    onChangeText(option.name);
    onOptionSelected?.(option.name, option.parentName);
    setFocused(false);
  }

  function loadMoreAsync() {
    if (!searchAsync || loadingMore || !asyncHasMore) return;
    const query = currentQueryRef.current;
    if (!query) return;
    setLoadingMore(true);
    void searchAsync(query, asyncOffset).then(({ suggestions: newResults, hasMore, nextOffset }) => {
      const existingKeys = new Set(asyncResults.map((r) => normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      const unique = newResults.filter((r) => !existingKeys.has(normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      setAsyncResults((prev) => [...prev, ...unique]);
      setAsyncHasMore(hasMore);
      setAsyncOffset(nextOffset);
      setLoadingMore(false);
    });
  }

  const prefetchThreshold = Math.floor(suggestions.length * 0.8);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < SCROLL_THRESHOLD) {
      if (visibleCount < suggestions.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, suggestions.length));
      }
    }
    if (searchAsync && asyncHasMore && !loadingMore && visibleCount >= prefetchThreshold) {
      loadMoreAsync();
    }
  }

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.autocompleteWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#8f8178"
          style={styles.input}
          value={value}
          editable={editable}
          onChangeText={(nextValue) => { onChangeText(nextValue); setVisibleCount(PAGE_SIZE); setFocused(true); }}
          onFocus={() => { cancelBlur(); setFocused(true); }}
          onBlur={() => { blurTimeoutRef.current = setTimeout(() => setFocused(false), BLUR_DELAY_MS); }}
        />
        {editable && showSuggestions ? (
          <ScrollView style={styles.autocompleteListInline} nestedScrollEnabled onScroll={handleScroll} scrollEventThrottle={100}>
            {visibleSuggestions.map((option) => (
              <Pressable
                key={`${label}-${option.name}-${option.parentName ?? ""}`}
                onPress={() => selectOption(option)} onPressIn={cancelBlur} onResponderGrant={cancelBlur}
                style={(state) => [styles.autocompleteItem, ("hovered" in state && (state as { hovered?: boolean }).hovered) && styles.autocompleteItemHover]}
              >
                <Text style={styles.autocompleteText}>
                  {option.name}
                  {option.parentName ? <Text style={styles.autocompleteParent}>{` (${option.parentName})`}</Text> : null}
                </Text>
              </Pressable>
            ))}
            {loadingMore ? (
              <ActivityIndicator size="small" color="#8f8178" style={{ paddingVertical: 8 }} />
            ) : visibleCount < suggestions.length || asyncHasMore ? (
              <Text style={styles.autocompleteMoreHint}>
                {visibleCount < suggestions.length ? `${suggestions.length - visibleCount} till \u2193` : "Scrolla f\u00f6r fler \u2193"}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: { gap: 6 },
  inputLabel: { color: "#564a40", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "#fffaf5", color: "#231815", fontSize: 15, borderWidth: 1, borderColor: "#e6d7c8" },
  autocompleteWrapper: { gap: 6 },
  autocompleteListInline: { borderRadius: 16, backgroundColor: "#fffaf5", borderWidth: 1, borderColor: "#e6d7c8", overflow: "hidden", maxHeight: 280, marginBottom: 8 },
  autocompleteItem: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fffaf5", cursor: "pointer" as unknown as undefined },
  autocompleteItemHover: { backgroundColor: "#f2e7db" },
  autocompleteText: { color: "#231815", fontSize: 15 },
  autocompleteParent: { color: "#756861", fontSize: 13 },
  autocompleteMoreHint: { textAlign: "center", color: "#8f8178", fontSize: 12, paddingVertical: 8 },
});
