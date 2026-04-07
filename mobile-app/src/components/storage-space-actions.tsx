import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { confirmAction } from "../lib/show-error";
import { SPACE_TYPE_LABELS, SPACE_TYPE_OPTIONS, SPACE_TYPE_VALUES } from "../lib/storage-types";
import type { StorageSpaceRow } from "../types/storage-space";
import { Expandable, LabeledInput, SuggestionRow } from "./form-controls";

import type { styles as themeStyles } from "../styles/theme";
type SharedStyles = typeof themeStyles;

export type StorageSpaceActionsProps = {
  space: StorageSpaceRow;
  styles: SharedStyles;
  onUpdate: (id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number }) => void;
  onDelete: (id: string) => void;
};

export function StorageSpaceActions({ space, styles, onUpdate, onDelete }: StorageSpaceActionsProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [spaceType, setSpaceType] = useState(SPACE_TYPE_LABELS[space.space_type] || space.space_type);
  const [rowCount, setRowCount] = useState(String(space.row_count));
  const [slotsPerRow, setSlotsPerRow] = useState(String(space.slots_per_row));

  if (!editing) {
    return (
      <View style={styles.actionRow}>
        <Pressable onPress={() => setEditing(true)}><Text style={styles.linkText}>Redigera</Text></Pressable>
        <Pressable onPress={() => confirmAction("Ta bort förvaringsplats", `Vill du ta bort "${space.name}"?`, () => onDelete(space.id))}>
          <Text style={styles.dangerText}>Ta bort</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Expandable expanded={editing}>
      <View style={{ gap: 8, paddingVertical: 8 }}>
        <LabeledInput label="Namn" value={name} onChangeText={setName} />
        <SuggestionRow title="Typ" options={SPACE_TYPE_OPTIONS} selected={spaceType} onSelect={setSpaceType} />
        <SlotToggle rowCount={rowCount} setRowCount={setRowCount} setSlotsPerRow={setSlotsPerRow} />
        {rowCount !== "0" ? (
          <View style={styles.actionRow}>
            <LabeledInput label="Rader" value={rowCount} onChangeText={setRowCount} keyboardType="number-pad" />
            <LabeledInput label="Platser/rad" value={slotsPerRow} onChangeText={setSlotsPerRow} keyboardType="number-pad" />
          </View>
        ) : null}
        <View style={styles.actionRow}>
          <Pressable onPress={() => {
            onUpdate(space.id, {
              name, space_type: SPACE_TYPE_VALUES[spaceType] || space.space_type,
              row_count: parseInt(rowCount) || 0, slots_per_row: parseInt(slotsPerRow) || 0,
            });
            setEditing(false);
          }} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Spara</Text></Pressable>
          <Pressable onPress={() => setEditing(false)}><Text style={styles.linkText}>Avbryt</Text></Pressable>
        </View>
      </View>
    </Expandable>
  );
}

function SlotToggle({ rowCount, setRowCount, setSlotsPerRow }: {
  rowCount: string; setRowCount: (v: string) => void; setSlotsPerRow: (v: string) => void;
}) {
  return (
    <SuggestionRow
      title="Platser"
      options={["Med platser", "Utan platser"]}
      selected={rowCount === "0" ? "Utan platser" : "Med platser"}
      onSelect={(v) => {
        if (v === "Utan platser") { setRowCount("0"); setSlotsPerRow("0"); }
        else { setRowCount("6"); setSlotsPerRow("6"); }
      }}
    />
  );
}
