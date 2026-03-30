import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";

import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";

const BLUR_DELAY_MS = 220;
const PAGE_SIZE = 10;
const MAX_SUGGESTIONS = 50;
const SEARCH_DEBOUNCE_MS = 300;
const SCROLL_THRESHOLD = 40;

import { normalizeLookupValue } from "../lib/cellar-helpers";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";

export type Suggestion = { name: string; parentName: string | null };

export function LabeledInput({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#8f8178"
        style={[styles.input, multiline && styles.textarea]}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

export function DateInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="ÅÅÅÅ-MM-DD"
          placeholderTextColor="#8f8178"
          style={styles.input}
          // @ts-expect-error -- react-native-web supports type="date" but it's not in RN types
          type="date"
        />
      </View>
    );
  }

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="ÅÅÅÅ-MM-DD"
        placeholderTextColor="#8f8178"
        style={styles.input}
      />
    </View>
  );
}

export function AutocompleteInput({
  label,
  value,
  onChangeText,
  onOptionSelected,
  options,
  optionRows,
  searchAsync,
  placeholder,
  minimumQueryLength = 1,
  editable = true,
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

  // Debounced server search
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

  // Client-side filtering (used when searchAsync is not provided)
  const clientSuggestions = useMemo((): Suggestion[] => {
    if (searchAsync) return [];
    const query = normalizeLookupValue(value);
    if (!query || query.length < minimumQueryLength) return [];

    const searchableOptions = optionRows?.length
      ? optionRows.map((row) => ({
          name: row.name,
          parentName: row.parent_name ?? null,
          haystack: [row.name, ...(row.aliases ?? []), row.parent_name ?? ""].join(" "),
        }))
      : options.map((option) => ({
          name: option,
          parentName: null as string | null,
          haystack: option,
        }));

    return searchableOptions
      .filter((option) => normalizeLookupValue(option.haystack).includes(query))
      .sort((left, right) => {
        const leftName = normalizeLookupValue(left.name);
        const rightName = normalizeLookupValue(right.name);
        const leftNameStarts = leftName.startsWith(query) ? 0 : 1;
        const rightNameStarts = rightName.startsWith(query) ? 0 : 1;
        if (leftNameStarts !== rightNameStarts) return leftNameStarts - rightNameStarts;
        const leftWordIdx = leftName.split(/\s+/).findIndex((w) => w.startsWith(query));
        const rightWordIdx = rightName.split(/\s+/).findIndex((w) => w.startsWith(query));
        const leftWordStarts = leftWordIdx >= 0 ? 0 : 1;
        const rightWordStarts = rightWordIdx >= 0 ? 0 : 1;
        if (leftWordStarts !== rightWordStarts) return leftWordStarts - rightWordStarts;
        if (leftWordIdx >= 0 && rightWordIdx >= 0 && leftWordIdx !== rightWordIdx) return leftWordIdx - rightWordIdx;
        const leftHaystackStarts = normalizeLookupValue(left.haystack).startsWith(query) ? 0 : 1;
        const rightHaystackStarts = normalizeLookupValue(right.haystack).startsWith(query) ? 0 : 1;
        if (leftHaystackStarts !== rightHaystackStarts) return leftHaystackStarts - rightHaystackStarts;
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

  const showSuggestions =
    focused &&
    value.trim().length > 0 &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && normalizeLookupValue(suggestions[0].name) === normalizeLookupValue(value));

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
      // Deduplicate against existing results
      const existingKeys = new Set(asyncResults.map((r) => normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      const unique = newResults.filter((r) => !existingKeys.has(normalizeLookupValue(r.name) + "|" + normalizeLookupValue(r.parentName ?? "")));
      setAsyncResults((prev) => [...prev, ...unique]);
      setAsyncHasMore(hasMore);
      setAsyncOffset(nextOffset);
      setLoadingMore(false);
    });
  }

  // Prefetch next server page when 80% of loaded results are visible
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
          onChangeText={(nextValue) => {
            onChangeText(nextValue);
            setVisibleCount(PAGE_SIZE);
            setFocused(true);
          }}
          onFocus={() => {
            cancelBlur();
            setFocused(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => {
              setFocused(false);
            }, BLUR_DELAY_MS);
          }}
        />
        {editable && showSuggestions ? (
          <ScrollView
            style={styles.autocompleteListInline}
            nestedScrollEnabled
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {visibleSuggestions.map((option) => (
              <Pressable
                key={`${label}-${option.name}-${option.parentName ?? ""}`}
                onPress={() => selectOption(option)}
                onPressIn={cancelBlur}
                onResponderGrant={cancelBlur}
                style={(state) => [
                  styles.autocompleteItem,
                  ("hovered" in state && (state as { hovered?: boolean }).hovered) && styles.autocompleteItemHover,
                ]}
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
                {visibleCount < suggestions.length
                  ? `${suggestions.length - visibleCount} till \u2193`
                  : "Scrolla f\u00f6r fler \u2193"}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

export function DoubleRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.doubleRow}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={styles.doubleRowItem}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Text style={styles.insightValue}>{value}</Text>
    </View>
  );
}

export function SuggestionRow({
  title,
  options,
  selected,
  onSelect,
  disabled = false,
  disabledOptions,
}: {
  title: string;
  options: string[];
  selected?: string | string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  disabledOptions?: Set<string>;
}) {
  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={styles.tagRow}>
        {options.map((option) => {
          const isSelected = Array.isArray(selected) ? selected.includes(option) : selected === option;
          const isOccupied = disabledOptions?.has(option) && !isSelected;

          return (
            <Pressable
              key={`${title}-${option}`}
              onPress={() => onSelect(option)}
              disabled={disabled || isOccupied}
              style={[styles.suggestionPill, isSelected && styles.suggestionPillActive, isOccupied && { opacity: 0.35 }]}
            >
              <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function GroupedSuggestionRow({
  title,
  groups,
  selected,
  onSelect,
}: {
  title: string;
  groups: Array<{ label: string; items: string[] }>;
  selected: string[];
  onSelect: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleGroups = expanded ? groups : groups.slice(0, 3);

  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>{title}</Text>
      {visibleGroups.map((group) => (
        <View key={group.label} style={{ marginBottom: 8 }}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.tagRow}>
            {group.items.map((item) => {
              const isSelected = selected.includes(item);
              return (
                <Pressable
                  key={`${group.label}-${item}`}
                  onPress={() => onSelect(item)}
                  style={[styles.suggestionPill, isSelected && styles.suggestionPillActive]}
                >
                  <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {groups.length > 3 && !expanded ? (
        <Pressable onPress={() => setExpanded(true)}>
          <Text style={styles.expandLink}>Visa fler kategorier ({groups.length - 3} till)</Text>
        </Pressable>
      ) : null}
      {expanded ? (
        <Pressable onPress={() => setExpanded(false)}>
          <Text style={styles.expandLink}>Visa färre</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StorageSpaceSelector({
  title,
  spaces,
  onSelect,
  selectedId,
  clearLabel,
}: {
  title?: string;
  spaces: StorageSpaceRow[];
  onSelect: (value: string) => void;
  selectedId?: string;
  clearLabel: string;
}) {
  if (spaces.length === 0) {
    return null;
  }

  return (
    <View style={styles.foodSection}>
      {title ? <Text style={styles.inputLabel}>{title}</Text> : null}
      <View style={styles.tagRow}>
        <Pressable
          onPress={() => onSelect("")}
          style={[styles.suggestionPill, !selectedId && styles.suggestionPillActive]}
        >
          <Text style={[styles.suggestionText, !selectedId && styles.suggestionTextActive]}>{clearLabel}</Text>
        </Pressable>
        {spaces.map((space) => {
          const isSelected = selectedId === space.id;

          return (
            <Pressable
              key={space.id}
              onPress={() => onSelect(space.id)}
              style={[styles.suggestionPill, isSelected && styles.suggestionPillActive]}
            >
              <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{space.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const SPACE_TYPE_OPTIONS = ["Vinkyl", "Vinställ", "Källare", "Övrigt"];
const SPACE_TYPE_VALUES: Record<string, string> = { "Vinkyl": "vinkyl", "Vinställ": "vinstall", "Källare": "kallare", "Övrigt": "ovrigt" };
const SPACE_TYPE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(SPACE_TYPE_VALUES).map(([k, v]) => [v, k]));

export function StorageSpaceForm({
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  draft: { name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string };
  saving: boolean;
  onDraftChange: (patch: Partial<{ name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string }>) => void;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Pressable onPress={() => setExpanded(true)} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>＋ Ny förvaringsplats</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.storageSpaceForm}>
      <Text style={styles.inputLabel}>Ny förvaringsplats</Text>
      <LabeledInput label="Namn" value={draft.name} onChangeText={(v) => onDraftChange({ name: v })} placeholder="t.ex. Vinkyl köket" />
      <SuggestionRow
        title="Typ"
        options={SPACE_TYPE_OPTIONS}
        selected={SPACE_TYPE_LABELS[draft.spaceType] || "Källare"}
        onSelect={(v) => onDraftChange({ spaceType: SPACE_TYPE_VALUES[v] || "kallare" })}
      />
      <View style={styles.doubleRow}>
        <View style={styles.doubleRowItem}>
          <LabeledInput label="Antal rader" value={draft.rowCount} onChangeText={(v) => onDraftChange({ rowCount: v })} keyboardType="number-pad" />
        </View>
        <View style={styles.doubleRowItem}>
          <LabeledInput label="Platser per rad" value={draft.slotsPerRow} onChangeText={(v) => onDraftChange({ slotsPerRow: v })} keyboardType="number-pad" />
        </View>
      </View>
      <View style={styles.doubleRow}>
        <Pressable onPress={onSave} style={[styles.primaryButton, { flex: 1 }]} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara plats"}</Text>
        </Pressable>
        <Pressable onPress={() => setExpanded(false)} style={[styles.secondaryButton, { flex: 0 }]}>
          <Text style={styles.secondaryButtonText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ImportSelectionRow({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.importOptionRow, selected && styles.importOptionRowActive]}>
      <Text style={[styles.importOptionText, selected && styles.importOptionTextActive]}>{label}</Text>
      <Text style={[styles.importOptionState, selected && styles.importOptionTextActive]}>
        {selected ? "Ja" : "Nej"}
      </Text>
    </Pressable>
  );
}

export function LoadingInline({ label = "Laddar viner..." }: { label?: string }) {
  return (
    <View style={styles.loadingInline}>
      <ActivityIndicator color="#6f1d1b" />
      <Text style={styles.notesText}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#6f6259",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fffaf5",
    color: "#231815",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  autocompleteWrapper: {
    gap: 6,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  autocompleteListInline: {
    borderRadius: 16,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#e6d7c8",
    overflow: "hidden",
    maxHeight: 280,
    marginBottom: 8,
  },
  autocompleteItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fffaf5",
    cursor: "pointer" as unknown as undefined,
  },
  autocompleteItemHover: {
    backgroundColor: "#f2e7db",
  },
  autocompleteText: {
    color: "#231815",
    fontSize: 15,
  },
  autocompleteParent: {
    color: "#8f8178",
    fontSize: 13,
  },
  autocompleteMoreHint: {
    textAlign: "center",
    color: "#8f8178",
    fontSize: 12,
    paddingVertical: 8,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  doubleRowItem: {
    flex: 1,
  },
  metricCard: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(255, 246, 238, 0.12)",
    paddingVertical: 18,
    paddingHorizontal: 14,
    gap: 6,
  },
  metricValue: {
    color: "#fff6ee",
    fontSize: 26,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#f8d9b5",
    fontSize: 13,
  },
  insightCard: {
    backgroundColor: "#fffaf5",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  insightValue: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  foodSection: {
    gap: 8,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f0e5d9",
  },
  suggestionPillActive: {
    backgroundColor: "#6f1d1b",
  },
  suggestionText: {
    color: "#6f6259",
    fontWeight: "600",
  },
  suggestionTextActive: {
    color: "#fff6ee",
  },
  groupLabel: {
    color: "#8f8178",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  expandLink: {
    color: "#6f1d1b",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  importOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ead8ca",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fffaf5",
  },
  importOptionRowActive: {
    borderColor: "#6f1d1b",
    backgroundColor: "#f7ece8",
  },
  importOptionText: {
    color: "#231815",
    fontWeight: "600",
  },
  importOptionState: {
    color: "#6f6259",
    fontWeight: "700",
  },
  importOptionTextActive: {
    color: "#6f1d1b",
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  notesText: {
    color: "#6f6259",
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: "#6f1d1b",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  storageSpaceForm: {
    backgroundColor: "#fffaf5",
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
});
