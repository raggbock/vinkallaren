import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { styles as theme, colors } from "../styles/theme";

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

const styles = StyleSheet.create({
  foodSection: { gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
});
