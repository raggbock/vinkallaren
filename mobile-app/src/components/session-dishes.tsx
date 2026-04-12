import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import type { SessionDishRow } from "../types/tasting-session";

type Props = {
  dishes: SessionDishRow[];
  isHost: boolean;
  onAdd: (name: string) => void;
  onRemove: (dishId: string) => void;
};

export function SessionDishes({ dishes, isHost, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const name = input.trim();
    if (!name) return;
    onAdd(name);
    setInput("");
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Maträtter ({dishes.length})</Text>

      {dishes.length > 0 ? (
        <View style={s.chipRow}>
          {dishes.map((d) => (
            <View key={d.id} style={s.chip}>
              <Text style={s.chipText}>{d.name}</Text>
              {isHost ? (
                <Pressable onPress={() => onRemove(d.id)} hitSlop={8}>
                  <Text style={s.chipRemove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.hint}>Inga maträtter tillagda ännu.</Text>
      )}

      {isHost ? (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Lägg till maträtt..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable onPress={handleAdd} style={[s.addBtn, !input.trim() && s.addBtnDisabled]} disabled={!input.trim()}>
            <Text style={s.addBtnText}>Lägg till</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function DishToggleChips({
  dishes,
  selectedIds,
  onToggle,
}: {
  dishes: SessionDishRow[];
  selectedIds: Set<string>;
  onToggle: (dishId: string) => void;
}) {
  if (dishes.length === 0) return null;

  return (
    <View style={s.toggleSection}>
      <Text style={s.toggleLabel}>Maträtter</Text>
      <View style={s.chipRow}>
        {dishes.map((d) => {
          const selected = selectedIds.has(d.id);
          return (
            <Pressable key={d.id} onPress={() => onToggle(d.id)} style={[s.toggleChip, selected && s.toggleChipActive]}>
              <Text style={[s.toggleChipText, selected && s.toggleChipTextActive]}>{d.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8 },
  title: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chipRemove: { color: colors.textSecondary, fontSize: 11 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: colors.textLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceAlt },
  addBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  toggleSection: { gap: 6 },
  toggleLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  toggleChip: { backgroundColor: colors.textLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.surfaceAlt },
  toggleChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleChipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  toggleChipTextActive: { color: colors.textLight },
});
