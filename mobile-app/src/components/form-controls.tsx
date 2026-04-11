import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { styles as theme, colors } from "../styles/theme";
import { SvgLogo as SvgLogoImpl } from "./svg-logo";

// Re-exports for backward-compatible imports
export { AutocompleteInput } from "./autocomplete-input";
export { SvgLogo } from "./svg-logo";
export { GroupedSuggestionRow } from "./grouped-suggestion-row";
export { StorageSpaceSelector, StorageSpaceForm } from "./storage-space-controls";

export type Suggestion = { name: string; parentName: string | null };

export function Expandable({ expanded, children }: { expanded: boolean; children: ReactNode }) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [height, setHeight] = useState(0);

  useEffect(() => {
    Animated.timing(anim, { toValue: expanded ? 1 : 0, duration: 250, useNativeDriver: false }).start();
  }, [expanded]);

  return (
    <Animated.View style={{
      height: height === 0 ? undefined : anim.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
      opacity: anim,
      overflow: "hidden",
    }}>
      <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) setHeight(h); }}>
        {children}
      </View>
    </Animated.View>
  );
}

export function LabeledInput({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={theme.inputGroup}>
      <Text style={theme.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[theme.input, multiline && styles.textarea]}
        multiline={multiline}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const isToday = value === todayString();
  const inputRef = useRef<TextInput>(null);

  // RN Web ignores the type prop — patch DOM directly
  useEffect(() => {
    if (Platform.OS !== "web" || !inputRef.current) return;
    const el = inputRef.current as unknown as HTMLElement;
    const input = el.querySelector ? el.querySelector("input") : el;
    if (input && "type" in input) (input as HTMLInputElement).type = "date";
  }, []);

  return (
    <View style={theme.inputGroup}>
      <Text style={theme.inputLabel}>{label}</Text>
      <View style={dateStyles.row}>
        <View style={dateStyles.inputWrap} ref={inputRef as any}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="ÅÅÅÅ-MM-DD"
            accessibilityLabel={label}
            placeholderTextColor={colors.textSecondary}
            style={theme.input}
            {...(Platform.OS !== "web" ? { keyboardType: "number-pad" as const, maxLength: 10 } : {})}
          />
        </View>
        <Pressable
          onPress={() => onChangeText(todayString())}
          style={[dateStyles.todayBtn, isToday && dateStyles.todayBtnActive]}
        >
          <Text style={[dateStyles.todayText, isToday && dateStyles.todayTextActive]}>Idag</Text>
        </Pressable>
      </View>
    </View>
  );
}

const dateStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  inputWrap: { flex: 1 },
  todayBtn: {
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  todayBtnActive: { backgroundColor: colors.accent },
  todayText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  todayTextActive: { color: colors.textLight },
});

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

export function InsightCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightCard}>
      <Text style={theme.inputLabel}>{label}</Text>
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
      <Text style={theme.inputLabel}>{title}</Text>
      <View style={styles.tagRow}>
        {options.map((option) => {
          const isSelected = Array.isArray(selected) ? selected.includes(option) : selected === option;
          const isOccupied = disabledOptions?.has(option) && !isSelected;

          return (
            <Pressable
              key={`${title}-${option}`}
              onPress={() => onSelect(option)}
              disabled={disabled || isOccupied}
              style={({ pressed }) => [styles.suggestionPill, isSelected && styles.suggestionPillActive, isOccupied && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.suggestionText, isSelected && styles.suggestionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PanelHeader({ rightLabel, onRightPress }: { title?: string; rightLabel?: string; onRightPress?: () => void }) {
  return (
    <View style={styles.panelHero}>
      <SvgLogoImpl />
      {rightLabel ? (
        <View style={styles.panelTitleRow}>
          <View />
          <Pressable onPress={onRightPress}><Text style={styles.panelHeroLink}>{rightLabel}</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function LoadingInline({ label = "Laddar viner..." }: { label?: string }) {
  return (
    <View style={styles.loadingInline}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.notesText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  textarea: { minHeight: 96, textAlignVertical: "top" },
  doubleRow: { flexDirection: "row", gap: 12 },
  doubleRowItem: { flex: 1 },
  insightCard: {
    backgroundColor: colors.textLight,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  insightValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  foodSection: { gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
  },
  suggestionPillActive: { backgroundColor: colors.accent },
  suggestionText: { color: colors.textSecondary, fontWeight: "600" },
  suggestionTextActive: { color: colors.textLight },
  loadingInline: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  notesText: { color: colors.textSecondary, lineHeight: 21 },
  panelHero: {
    backgroundColor: "transparent",
    marginTop: -8,
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  panelHeroLink: { color: colors.accent, fontWeight: "600", fontSize: 12 },
});
