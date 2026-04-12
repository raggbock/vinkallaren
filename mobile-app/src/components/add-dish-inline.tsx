import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import { FOOD_CATEGORIES } from "../lib/cellar-helpers";

type Props = {
  userCategories: string[];
  onAdd: (name: string, category: string | null) => void;
};

export function AddDishInline({ userCategories, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const allCategories = [
    ...FOOD_CATEGORIES.map((c) => c.label),
    ...userCategories.filter((c) => !FOOD_CATEGORIES.some((fc) => fc.label === c)),
  ];

  function handleAdd() {
    const dishName = name.trim();
    if (!dishName) return;
    const cat = showNewCat ? newCategory.trim() || null : category;
    onAdd(dishName, cat);
    setName("");
    setCategory(null);
    setNewCategory("");
    setShowNewCat(false);
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={s.openBtn}>
        <Text style={s.openBtnText}>+ Lägg till egen maträtt</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.container}>
      <TextInput
        style={s.input}
        placeholder="Namn på maträtt..."
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <Text style={s.label}>Kategori</Text>
      <View style={s.chipRow}>
        {allCategories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => { setCategory(cat); setShowNewCat(false); }}
            style={[s.chip, category === cat && !showNewCat && s.chipActive]}
          >
            <Text style={[s.chipText, category === cat && !showNewCat && s.chipTextActive]}>{cat}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => { setShowNewCat(true); setCategory(null); }}
          style={[s.chip, showNewCat && s.chipActive]}
        >
          <Text style={[s.chipText, showNewCat && s.chipTextActive]}>Ny kategori...</Text>
        </Pressable>
      </View>

      {showNewCat ? (
        <TextInput
          style={s.input}
          placeholder="Kategorinamn..."
          placeholderTextColor={colors.textSecondary}
          value={newCategory}
          onChangeText={setNewCategory}
          autoFocus
        />
      ) : null}

      <View style={s.actionRow}>
        <Pressable onPress={handleAdd} style={[s.addBtn, !name.trim() && s.addBtnDisabled]} disabled={!name.trim()}>
          <Text style={s.addBtnText}>Lägg till</Text>
        </Pressable>
        <Pressable onPress={() => { setOpen(false); setName(""); setCategory(null); setShowNewCat(false); }} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8, backgroundColor: colors.textLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.surfaceAlt },
  openBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.textLight, borderWidth: 1, borderColor: colors.surfaceAlt },
  openBtnText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceAlt },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.textLight },
  actionRow: { flexDirection: "row", gap: 8 },
  addBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  cancelBtn: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  cancelBtnText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
});
