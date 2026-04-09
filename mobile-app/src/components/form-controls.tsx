import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { styles as theme } from "../styles/theme";

import type { ReferenceOptionRow } from "../types/reference-data";
import type { StorageSpaceRow } from "../types/storage-space";

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

export type Suggestion = { name: string; parentName: string | null };

// Re-export for backward-compatible imports
export { AutocompleteInput } from "./autocomplete-input";

export function LabeledInput({ label, multiline, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={theme.inputGroup}>
      <Text style={theme.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor="#8f8178"
        style={[theme.input, multiline && styles.textarea]}
        multiline={multiline}
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

  return (
    <View style={theme.inputGroup}>
      <Text style={theme.inputLabel}>{label}</Text>
      <View style={dateStyles.row}>
        <View style={dateStyles.inputWrap}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder="ÅÅÅÅ-MM-DD"
            placeholderTextColor="#8f8178"
            style={theme.input}
            {...(Platform.OS === "web"
              ? { type: "date" } // react-native-web supports type="date"
              : { keyboardType: "number-pad" as const, maxLength: 10 })}
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
    backgroundColor: "#f0e5d9",
  },
  todayBtnActive: { backgroundColor: "#6f1d1b" },
  todayText: { color: "#564a40", fontWeight: "700", fontSize: 13 },
  todayTextActive: { color: "#fff6ee" },
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
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleCategory = (label: string) => setExpandedCategory((prev) => (prev === label ? null : label));

  return (
    <View style={styles.foodSection}>
      <Pressable onPress={() => setSectionOpen((v) => !v)} style={({ pressed }) => [styles.categoryRow, sectionOpen && styles.categoryRowExpanded, pressed && { opacity: 0.7 }]}>
        <Text style={theme.inputLabel}>{title}{selected.length > 0 ? ` (${selected.length})` : ""}</Text>
        <Text style={theme.foodCategoryChevron}>{sectionOpen ? "▾" : "›"}</Text>
      </Pressable>
      {sectionOpen && selected.length > 0 && (
        <View style={styles.tagRow}>
          {selected.map((item) => (
            <Pressable key={`selected-${item}`} onPress={() => onSelect(item)} style={[theme.foodPill, theme.foodPillActive]}>
              <Text style={theme.foodTextActive}>{item} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}
      {sectionOpen && groups.map((group) => {
        const isExpanded = expandedCategory === group.label;
        const hasSelection = group.items.some((item) => selected.includes(item));
        return (
          <View key={group.label} style={theme.foodCategoryGroup}>
            <Pressable
              onPress={() => toggleCategory(group.label)}
              style={({ pressed }) => [styles.categoryRow, isExpanded && styles.categoryRowExpanded, pressed && { opacity: 0.7 }]}
            >
              <Text style={[theme.foodCategoryLabel, hasSelection && theme.foodCategoryLabelActive]}>{group.label}</Text>
              <Text style={theme.foodCategoryChevron}>{isExpanded ? "▾" : "›"}</Text>
            </Pressable>
            {isExpanded && (
              <View style={styles.tagRow}>
                {group.items.map((item) => {
                  const isSelected = selected.includes(item);
                  return (
                    <Pressable
                      key={`${group.label}-${item}`}
                      onPress={() => onSelect(item)}
                      style={({ pressed }) => [theme.foodPill, isSelected && theme.foodPillActive, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={[theme.foodText, isSelected && theme.foodTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
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
      {title ? <Text style={theme.inputLabel}>{title}</Text> : null}
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

import { SPACE_TYPE_LABELS, SPACE_TYPE_OPTIONS, SPACE_TYPE_VALUES } from "../lib/storage-types";

export function StorageSpaceForm({
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  draft: { name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string };
  saving: boolean;
  onDraftChange: (patch: Partial<{ name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string }>) => void;
  onSave: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{expanded ? "Dölj" : "＋ Ny förvaringsplats"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        <View style={styles.storageSpaceForm}>
          <Text style={theme.inputLabel}>Ny förvaringsplats</Text>
          <LabeledInput label="Namn" value={draft.name} onChangeText={(v) => onDraftChange({ name: v })} placeholder="t.ex. Vinkyl köket" />
          <SuggestionRow
            title="Typ"
            options={SPACE_TYPE_OPTIONS}
            selected={SPACE_TYPE_LABELS[draft.spaceType] || "Källare"}
            onSelect={(v) => onDraftChange({ spaceType: SPACE_TYPE_VALUES[v] || "kallare" })}
          />
          <SuggestionRow title="Platser" options={["Med platser", "Utan platser"]}
            selected={draft.rowCount === "0" ? "Utan platser" : "Med platser"}
            onSelect={(v) => { if (v === "Utan platser") { onDraftChange({ rowCount: "0", slotsPerRow: "0" }); } else { onDraftChange({ rowCount: "6", slotsPerRow: "6" }); } }} />
          {draft.rowCount !== "0" ? (
            <View style={styles.doubleRow}>
              <View style={styles.doubleRowItem}>
                <LabeledInput label="Antal rader" value={draft.rowCount} onChangeText={(v) => onDraftChange({ rowCount: v })} keyboardType="number-pad" />
              </View>
              <View style={styles.doubleRowItem}>
                <LabeledInput label="Platser per rad" value={draft.slotsPerRow} onChangeText={(v) => onDraftChange({ slotsPerRow: v })} keyboardType="number-pad" />
              </View>
            </View>
          ) : null}
          <View style={styles.doubleRow}>
            <Pressable onPress={async () => { await onSave(); setExpanded(false); }} style={[theme.primaryButton, { flex: 1 }]} disabled={saving}>
              <Text style={theme.primaryButtonText}>{saving ? "Sparar..." : "Spara plats"}</Text>
            </Pressable>
            <Pressable onPress={() => setExpanded(false)} style={[styles.secondaryButton, { flex: 1 }]}>
              <Text style={styles.secondaryButtonText}>Avbryt</Text>
            </Pressable>
          </View>
        </View>
      </Expandable>
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

const logoBanner = require("../../assets/logo-banner.png");

export function PanelHeader({ rightLabel, onRightPress }: { title?: string; rightLabel?: string; onRightPress?: () => void }) {
  return (
    <View style={styles.panelHero}>
      <Image source={logoBanner} style={styles.panelHeroLogo} resizeMode="contain" />
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
      <ActivityIndicator color="#6f1d1b" />
      <Text style={styles.notesText}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  doubleRow: { flexDirection: "row", gap: 12 },
  doubleRowItem: { flex: 1 },
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
  foodSection: { gap: 8 },
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
    color: "#564a40",
    fontWeight: "600",
  },
  suggestionTextActive: {
    color: "#fff6ee",
  },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  categoryRowExpanded: {
    backgroundColor: "#f0e5d9",
    borderColor: "#d4c4b4",
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
    color: "#564a40",
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
    color: "#564a40",
    lineHeight: 21,
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
  panelHero: {
    backgroundColor: "#2b1714",
    marginTop: -18,
    marginHorizontal: -18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    alignItems: "center",
    gap: 10,
  },
  panelHeroLogo: {
    width: "100%",
    height: 160,
  },
  panelHeroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  panelTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  panelHeroTitle: {
    color: "#ead8ca",
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  panelHeroLink: {
    color: "#8a7566",
    fontWeight: "600",
    fontSize: 12,
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
