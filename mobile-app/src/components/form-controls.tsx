import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";

import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";

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

export function AutocompleteInput({
  label,
  value,
  onChangeText,
  onOptionSelected,
  options,
  optionRows,
  placeholder,
  minimumQueryLength = 1,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onOptionSelected?: (value: string) => void;
  options: string[];
  optionRows?: ReferenceOptionRow[];
  placeholder?: string;
  minimumQueryLength?: number;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const suggestions = useMemo(() => {
    const query = normalizeLookupValue(value);

    if (!query || query.length < minimumQueryLength) {
      return [];
    }

    const searchableOptions = optionRows?.length
      ? optionRows.map((row) => ({
          value: row.name,
          haystack: [row.name, ...(row.aliases ?? []), row.parent_name ?? ""].join(" "),
        }))
      : options.map((option) => ({
          value: option,
          haystack: option,
        }));

    return searchableOptions
      .filter((option) => normalizeLookupValue(option.haystack).includes(query))
      .sort((left, right) => {
        const leftName = normalizeLookupValue(left.value);
        const rightName = normalizeLookupValue(right.value);

        // Tier 1: name starts with query
        const leftNameStarts = leftName.startsWith(query) ? 0 : 1;
        const rightNameStarts = rightName.startsWith(query) ? 0 : 1;
        if (leftNameStarts !== rightNameStarts) return leftNameStarts - rightNameStarts;

        // Tier 2: haystack starts with query (catches alias/producer matches)
        const leftHaystackStarts = normalizeLookupValue(left.haystack).startsWith(query) ? 0 : 1;
        const rightHaystackStarts = normalizeLookupValue(right.haystack).startsWith(query) ? 0 : 1;
        if (leftHaystackStarts !== rightHaystackStarts) return leftHaystackStarts - rightHaystackStarts;

        return left.value.localeCompare(right.value);
      })
      .map((option) => option.value)
      .filter((option, index, values) => values.indexOf(option) === index)
      .slice(0, 8);
  }, [minimumQueryLength, optionRows, options, value]);

  const showSuggestions =
    focused &&
    value.trim().length > 0 &&
    suggestions.length > 0 &&
    !suggestions.some((option) => normalizeLookupValue(option) === normalizeLookupValue(value));

  function selectOption(option: string) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    onChangeText(option);
    onOptionSelected?.(option);
    setFocused(false);
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
            setFocused(true);
          }}
          onFocus={() => {
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
            }
            setFocused(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => {
              setFocused(false);
            }, 220);
          }}
        />
        {editable && showSuggestions ? (
          <View style={styles.autocompleteListInline}>
            {suggestions.map((option) => (
              <Pressable
                key={`${label}-${option}`}
                onPress={() => selectOption(option)}
                onPressIn={() => {
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                }}
                onResponderGrant={() => {
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                }}
                style={styles.autocompleteItem}
              >
                <Text style={styles.autocompleteText}>{option}</Text>
              </Pressable>
            ))}
          </View>
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
}: {
  title: string;
  options: string[];
  selected?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>{title}</Text>
      <View style={styles.tagRow}>
        {options.map((option) => {
          const isSelected = selected === option;

          return (
            <Pressable
              key={`${title}-${option}`}
              onPress={() => onSelect(option)}
              disabled={disabled}
              style={[styles.suggestionPill, isSelected && styles.suggestionPillActive]}
            >
              <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
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

function normalizeLookupValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  },
  autocompleteText: {
    color: "#231815",
    fontSize: 15,
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
});
