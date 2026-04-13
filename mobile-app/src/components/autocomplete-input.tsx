import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useRef, useState } from "react";

import { normalizeLookupValue } from "../lib/cellar-helpers";
import { styles as theme, colors } from "../styles/theme";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { Suggestion } from "./form-controls";
import { useAutocompleteSearch } from "../hooks/useAutocompleteSearch";

const BLUR_DELAY_MS = 220;

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
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { suggestions, loadingMore, asyncHasMore, loadMore } =
    useAutocompleteSearch({ value, options, optionRows, searchAsync, minimumQueryLength });

  useEffect(() => {
    return () => { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); };
  }, []);

  const showSuggestions = focused && value.trim().length > 0 && suggestions.length > 0
    && !(suggestions.length === 1 && normalizeLookupValue(suggestions[0].name) === normalizeLookupValue(value));

  function cancelBlur() { if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current); }

  function selectOption(option: Suggestion) {
    cancelBlur();
    onChangeText(option.name);
    onOptionSelected?.(option.name, option.parentName);
    setFocused(false);
  }

  return (
    <View style={theme.inputGroup}>
      <Text style={theme.inputLabel}>{label}</Text>
      <View style={styles.autocompleteWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          style={theme.input}
          value={value}
          editable={editable}
          accessibilityLabel={label || placeholder}
          onChangeText={(nextValue) => { onChangeText(nextValue); setFocused(true); }}
          onFocus={() => { cancelBlur(); setFocused(true); }}
          onBlur={() => { blurTimeoutRef.current = setTimeout(() => setFocused(false), BLUR_DELAY_MS); }}
        />
        {editable && showSuggestions ? (
          <ScrollView style={styles.autocompleteListInline} nestedScrollEnabled>
            {suggestions.map((option, i) => (
              <Pressable
                key={`${option.name}-${option.parentName ?? ""}-${i}`}
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
              <ActivityIndicator size="small" color={colors.textSecondary} style={{ paddingVertical: 8 }} />
            ) : asyncHasMore ? (
              <Pressable onPress={() => { cancelBlur(); loadMore(); }} onPressIn={cancelBlur} style={styles.loadMoreBtn}>
                <Text style={styles.loadMoreText}>Ladda fler...</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  autocompleteWrapper: { gap: 6 },
  autocompleteListInline: { borderRadius: 16, backgroundColor: colors.textLight, borderWidth: 1, borderColor: colors.border, overflow: "hidden", maxHeight: 280, marginBottom: 8 },
  autocompleteItem: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.textLight, cursor: "pointer" as unknown as undefined },
  autocompleteItemHover: { backgroundColor: colors.surfaceAlt },
  autocompleteText: { color: colors.text, fontSize: 15 },
  autocompleteParent: { color: colors.textSecondary, fontSize: 13 },
  loadMoreBtn: { paddingVertical: 12, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  loadMoreText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
});
