import { ActivityIndicator, Animated, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

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
        <Pressable onPress={() => { setExpanded(true); }}>
          <Text style={styles.expandLink}>Visa fler kategorier ({groups.length - 3} till)</Text>
        </Pressable>
      ) : null}
      {expanded ? (
        <Pressable onPress={() => { setExpanded(false); }}>
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
          <Text style={styles.inputLabel}>Ny förvaringsplats</Text>
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
            <Pressable onPress={async () => { await onSave(); setExpanded(false); }} style={[styles.primaryButton, { flex: 1 }]} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? "Sparar..." : "Spara plats"}</Text>
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

const logoSquare = require("../../assets/logo-square.png");

export function PanelHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.panelHeader}>
      <View style={styles.panelHeaderLeft}>
        <Image source={logoSquare} style={styles.panelHeaderLogo} resizeMode="contain" />
        <Text style={styles.panelHeaderTitle}>{title}</Text>
      </View>
      {right}
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
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#564a40",
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
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  doubleRowItem: {
    flex: 1,
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
    color: "#564a40",
    fontWeight: "600",
  },
  suggestionTextActive: {
    color: "#fff6ee",
  },
  groupLabel: {
    color: "#756861",
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
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  panelHeaderLogo: {
    width: 36,
    height: 36,
  },
  panelHeaderTitle: {
    color: "#231815",
    fontSize: 24,
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
