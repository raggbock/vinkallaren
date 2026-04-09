import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/tokens";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

const WINE_TYPE_COLORS: Record<string, string> = {
  Rött: "#8B2252",
  Vitt: "#E8D44D",
  Rosé: "#F4A6B0",
  Mousserande: "#F5E6CA",
  Sött: "#D4A017",
  Orange: "#E8943A",
};

function slotColor(type: string): string {
  return WINE_TYPE_COLORS[type] ?? colors.textSecondary;
}

type ShelfGridProps = {
  space: StorageSpaceRow;
  wines: WineRecord[];
};

export function ShelfGrid({ space, wines }: ShelfGridProps) {
  const [selected, setSelected] = useState<WineRecord | null>(null);

  const wineByPos = new Map<string, WineRecord>();
  for (const w of wines) {
    if (w.storage_space_id === space.id && w.storage_row != null && w.storage_slot != null) {
      wineByPos.set(`${w.storage_row}-${w.storage_slot}`, w);
    }
  }

  const rows = space.row_count || 0;
  const slots = space.slots_per_row || 0;
  if (rows === 0 || slots === 0) return null;

  return (
    <View style={s.container}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={s.row}>
          <Text style={s.rowLabel}>{r + 1}</Text>
          {Array.from({ length: slots }, (_, sl) => {
            const wine = wineByPos.get(`${r + 1}-${sl + 1}`);
            return (
              <Pressable key={sl} onPress={wine ? () => setSelected(wine) : undefined} style={[s.slot, wine ? { backgroundColor: slotColor(wine.type) } : s.emptySlot]}>
                {wine ? <View style={s.shine} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={s.legendRow}>
        {Object.entries(WINE_TYPE_COLORS).map(([label, color]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>
      {selected ? (
        <Modal transparent animationType="fade" onRequestClose={() => setSelected(null)}>
          <Pressable style={s.overlay} onPress={() => setSelected(null)}>
            <View style={s.popup}>
              <Text style={s.popupName}>{selected.name}</Text>
              {selected.producer ? <Text style={s.popupDetail}>{selected.producer}</Text> : null}
              <View style={s.popupRow}>
                {selected.vintage ? <Text style={s.popupPill}>{selected.vintage}</Text> : null}
                <Text style={s.popupPill}>{selected.type}</Text>
                {selected.country ? <Text style={s.popupPill}>{selected.country}</Text> : null}
              </View>
              {selected.grape ? <Text style={s.popupDetail}>{selected.grape}</Text> : null}
              <Text style={s.popupPos}>Rad {selected.storage_row}, plats {selected.storage_slot}</Text>
              <Pressable onPress={() => setSelected(null)} style={s.closeBtn}>
                <Text style={s.closeBtnText}>Stäng</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 6, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowLabel: { width: 18, fontSize: 10, color: colors.textSecondary, textAlign: "right", marginRight: 4 },
  slot: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  emptySlot: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
  },
  shine: {
    position: "absolute", top: 4, left: 8,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, paddingLeft: 22 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: colors.textSecondary },
  overlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  popup: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24,
    maxWidth: 300, width: "85%", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  popupName: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  popupDetail: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  popupRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  popupPill: {
    fontSize: 12, color: colors.accent, fontWeight: "600",
    backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  popupPos: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  closeBtn: {
    marginTop: 8, backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  closeBtnText: { color: colors.textLight, fontWeight: "600", fontSize: 13 },
});
