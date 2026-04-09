import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/tokens";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

const WINE_TYPE_COLORS: Record<string, string> = {
  Rött: "#8B2252",
  Vitt: "#E8D44D",
  Rosé: "#F4A6B0",
  Mousserande: "#F5E6CA",
  Sött: "#D4A017",
};

function slotColor(type: string): string {
  return WINE_TYPE_COLORS[type] ?? colors.textSecondary;
}

type ShelfGridProps = {
  space: StorageSpaceRow;
  wines: WineRecord[];
  onGoToWine?: (wine: WineRecord) => void;
};

export function ShelfGrid({ space, wines, onGoToWine }: ShelfGridProps) {
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
        <View key={r} style={s.shelfRow}>
          <Text style={s.rowLabel}>{r + 1}</Text>
          <View style={s.shelf}>
            {Array.from({ length: slots }, (_, sl) => {
              const wine = wineByPos.get(`${r + 1}-${sl + 1}`);
              return (
                <Pressable key={sl} onPress={wine ? () => setSelected(wine) : undefined} style={s.slotWrapper}>
                  {/* Bottle circle sitting in the cradle */}
                  {wine ? (
                    <View style={[s.bottle, { backgroundColor: slotColor(wine.type) }]}>
                      <View style={s.bottleShine} />
                    </View>
                  ) : null}
                  {/* Half-circle cradle (bottom half) */}
                  <View style={[s.cradle, !wine && s.cradleEmpty]} />
                </Pressable>
              );
            })}
          </View>
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
            <Pressable style={s.popup} onPress={(e) => e.stopPropagation()}>
              <View style={[s.popupDot, { backgroundColor: slotColor(selected.type) }]} />
              <Text style={s.popupName}>{selected.name}</Text>
              {selected.producer ? <Text style={s.popupDetail}>{selected.producer}</Text> : null}
              <View style={s.popupRow}>
                {selected.vintage ? <Text style={s.popupPill}>{selected.vintage}</Text> : null}
                <Text style={s.popupPill}>{selected.type}</Text>
                {selected.country ? <Text style={s.popupPill}>{selected.country}</Text> : null}
              </View>
              {selected.grape ? <Text style={s.popupDetail}>{selected.grape}</Text> : null}
              <Text style={s.popupPos}>Rad {selected.storage_row}, plats {selected.storage_slot}</Text>
              <View style={s.popupButtons}>
                {onGoToWine ? (
                  <Pressable onPress={() => { const w = selected; setSelected(null); onGoToWine(w); }} style={s.goToBtn}>
                    <Text style={s.goToBtnText}>Gå till vin</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setSelected(null)} style={s.closeBtn}>
                  <Text style={s.closeBtnText}>Stäng</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const SLOT_SIZE = 28;

const s = StyleSheet.create({
  container: { gap: 6, paddingVertical: 8 },
  shelfRow: { flexDirection: "row", alignItems: "flex-end" },
  rowLabel: { width: 18, fontSize: 10, color: colors.textSecondary, textAlign: "right", marginRight: 4, marginBottom: 2 },
  shelf: { flexDirection: "row", gap: 5 },
  slotWrapper: {
    width: SLOT_SIZE, height: SLOT_SIZE + 4,
    alignItems: "center", justifyContent: "flex-end",
  },
  cradle: {
    width: SLOT_SIZE, height: SLOT_SIZE / 2,
    borderBottomLeftRadius: SLOT_SIZE / 2,
    borderBottomRightRadius: SLOT_SIZE / 2,
    backgroundColor: "#C4B8A8",
  },
  cradleEmpty: {
    backgroundColor: "#D8CFBF",
  },
  bottle: {
    width: SLOT_SIZE - 4, height: SLOT_SIZE - 4,
    borderRadius: (SLOT_SIZE - 4) / 2,
    marginBottom: -6,
    zIndex: 1,
  },
  bottleShine: {
    position: "absolute", top: 5, left: 6,
    width: 10, height: 5, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, paddingLeft: 22 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: colors.textSecondary },
  overlay: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  popup: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24,
    maxWidth: 300, width: "85%", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: colors.border,
    ...Platform.select({ web: { boxShadow: "0 8px 30px rgba(0,0,0,0.25)" } as any, default: { elevation: 10 } }),
  },
  popupDot: { width: 28, height: 28, borderRadius: 14, marginBottom: 4 },
  popupName: { fontSize: 18, fontWeight: "700", color: colors.text, textAlign: "center" },
  popupDetail: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  popupRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  popupPill: {
    fontSize: 12, color: colors.accent, fontWeight: "600",
    backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  popupPos: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  popupButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  goToBtn: {
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  goToBtnText: { color: colors.textLight, fontWeight: "600", fontSize: 13 },
  closeBtn: {
    backgroundColor: colors.surfaceAlt, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  closeBtnText: { color: colors.text, fontWeight: "600", fontSize: 13 },
});
