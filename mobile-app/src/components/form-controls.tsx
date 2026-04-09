import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Children, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { styles as theme, colors } from "../styles/theme";

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
    backgroundColor: "#f0e5d9",
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


function SvgLogo() {
  const logoRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || !logoRef.current) return;
    const el = logoRef.current as unknown as HTMLDivElement;
    el.innerHTML = `<svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
      <!-- Oval crest — outer border -->
      <ellipse cx="180" cy="72" rx="155" ry="65" fill="none" stroke="#2A2A2A" stroke-width="1.8" opacity="0.14"/>
      <!-- Inner accent border -->
      <ellipse cx="180" cy="72" rx="146" ry="58" fill="none" stroke="#C83C2D" stroke-width="0.6" opacity="0.13"/>

      <!-- Grape cluster ornament top -->
      <circle cx="162" cy="8" r="4" fill="#C83C2D" opacity="0.16"/>
      <circle cx="172" cy="5" r="3.5" fill="#C83C2D" opacity="0.14"/>
      <circle cx="180" cy="7" r="4.2" fill="#C83C2D" opacity="0.17"/>
      <circle cx="189" cy="4.5" r="3.5" fill="#C83C2D" opacity="0.14"/>
      <circle cx="198" cy="8" r="4" fill="#C83C2D" opacity="0.16"/>
      <circle cx="167" cy="13" r="3" fill="#C83C2D" opacity="0.11"/>
      <circle cx="175" cy="12" r="3.2" fill="#C83C2D" opacity="0.1"/>
      <circle cx="185" cy="12" r="3.2" fill="#C83C2D" opacity="0.1"/>
      <circle cx="193" cy="13" r="3" fill="#C83C2D" opacity="0.11"/>
      <!-- Vine leaves hint -->
      <path d="M152 10 Q148 4, 142 6 Q145 2, 150 5" stroke="#2A2A2A" stroke-width="0.7" fill="none" opacity="0.1" stroke-linecap="round"/>
      <path d="M208 10 Q212 4, 218 6 Q215 2, 210 5" stroke="#2A2A2A" stroke-width="0.7" fill="none" opacity="0.1" stroke-linecap="round"/>
      <!-- Tendril -->
      <path d="M142 8 Q136 12, 138 18" stroke="#2A2A2A" stroke-width="0.5" fill="none" opacity="0.08" stroke-linecap="round"/>
      <path d="M218 8 Q224 12, 222 18" stroke="#2A2A2A" stroke-width="0.5" fill="none" opacity="0.08" stroke-linecap="round"/>

      <!-- SEDAN 2026 -->
      <text x="180" y="48" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="10" fill="#C83C2D" letter-spacing="4.5" font-weight="600">SEDAN 2026</text>

      <!-- Thin decorative rule -->
      <line x1="105" y1="53" x2="255" y2="53" stroke="#C83C2D" stroke-width="0.35" opacity="0.15"/>

      <!-- Vinkällaren -->
      <text x="180" y="84" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="42" fill="#2A2A2A" font-weight="700" letter-spacing="1.5">Vinkällaren</text>

      <!-- Thin decorative rule -->
      <line x1="110" y1="91" x2="250" y2="91" stroke="#C83C2D" stroke-width="0.35" opacity="0.15"/>

      <!-- SAMLA · SMAKA · UPPTÄCK -->
      <text x="180" y="106" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="8.5" fill="#555555" letter-spacing="4.5" font-weight="400">SAMLA · SMAKA · UPPTÄCK</text>

      <!-- Small grape ornament bottom -->
      <circle cx="170" cy="133" r="3.2" fill="#C83C2D" opacity="0.12"/>
      <circle cx="180" cy="135" r="3.8" fill="#C83C2D" opacity="0.14"/>
      <circle cx="190" cy="133" r="3.2" fill="#C83C2D" opacity="0.12"/>
      <circle cx="175" cy="138" r="2.5" fill="#C83C2D" opacity="0.09"/>
      <circle cx="185" cy="138" r="2.5" fill="#C83C2D" opacity="0.09"/>
    </svg>`;
  }, []);
  if (Platform.OS !== "web") {
    return <Text style={{ fontFamily: "Georgia", fontSize: 28, fontWeight: "700", color: "#2A2A2A" }}>Vinkällaren</Text>;
  }
  return <View ref={logoRef} style={{ width: "100%", height: 150 }} />;
}

export function PanelHeader({ rightLabel, onRightPress }: { title?: string; rightLabel?: string; onRightPress?: () => void }) {
  return (
    <View style={styles.panelHero}>
      <SvgLogo />
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
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  doubleRow: { flexDirection: "row", gap: 12 },
  doubleRowItem: { flex: 1 },
  insightCard: {
    backgroundColor: colors.textLight,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  insightValue: {
    color: colors.text,
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
    backgroundColor: colors.accent,
  },
  suggestionText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  suggestionTextActive: {
    color: colors.textLight,
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
    backgroundColor: colors.textLight,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  categoryRowExpanded: {
    backgroundColor: "#f0e5d9",
    borderColor: "#d4c4b4",
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  notesText: {
    color: colors.textSecondary,
    lineHeight: 21,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.accent,
    fontWeight: "700",
  },
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
  panelHeroLogo: {
    width: "100%",
    height: 140,
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
    color: colors.surfaceAlt,
    fontSize: 20,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  panelHeroLink: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 12,
  },
  storageSpaceForm: {
    backgroundColor: colors.textLight,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
});
