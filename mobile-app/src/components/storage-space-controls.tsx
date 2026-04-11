import { Pressable, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { styles as theme, colors } from "../styles/theme";
import { SPACE_TYPE_LABELS, SPACE_TYPE_OPTIONS, SPACE_TYPE_VALUES } from "../lib/storage-types";
import type { StorageSpaceRow } from "../types/storage-space";
import { Expandable } from "./form-controls";
import { LabeledInput } from "./form-controls";
import { SuggestionRow } from "./form-controls";

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

type StorageSpaceDraft = { name: string; spaceType: string; rowCount: string; slotsPerRow: string; notes: string };

export function StorageSpaceForm({
  draft,
  saving,
  onDraftChange,
  onSave,
}: {
  draft: StorageSpaceDraft;
  saving: boolean;
  onDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
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
          <SuggestionRow
            title="Platser"
            options={["Med platser", "Utan platser"]}
            selected={draft.rowCount === "0" ? "Utan platser" : "Med platser"}
            onSelect={(v) => {
              if (v === "Utan platser") {
                onDraftChange({ rowCount: "0", slotsPerRow: "0" });
              } else {
                onDraftChange({ rowCount: "6", slotsPerRow: "6" });
              }
            }}
          />
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

const styles = StyleSheet.create({
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
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.accent, fontWeight: "700" },
  storageSpaceForm: {
    backgroundColor: colors.textLight,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.surfaceAlt,
  },
  doubleRow: { flexDirection: "row", gap: 12 },
  doubleRowItem: { flex: 1 },
});
