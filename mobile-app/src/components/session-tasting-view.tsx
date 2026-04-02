import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LabeledInput, SuggestionRow } from "./form-controls";
import type { SessionWineRow } from "../types/tasting-session";
import type { WsetTastingData } from "../lib/wset-data";
import { buildWsetSummary } from "../lib/wset-data";

export function SessionTastingView({
  wine,
  format,
  initialRating,
  initialNotes,
  initialFoodPairings,
  initialWsetData,
  saving,
  onSave,
  onOpenWset,
  onBack,
}: {
  wine: SessionWineRow;
  format: "quick" | "wset";
  initialRating: number | null;
  initialNotes: string | null;
  initialFoodPairings: string[];
  initialWsetData: WsetTastingData | null;
  saving: boolean;
  onSave: (data: { rating: number | null; notes: string | null; foodPairings: string[]; wsetData: WsetTastingData | null }) => void;
  onOpenWset: (wineType?: string) => void;
  onBack: () => void;
}) {
  const [rating, setRating] = useState(initialRating ? String(initialRating) : "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [foodPairings, setFoodPairings] = useState(initialFoodPairings.join(", "));

  function handleSave() {
    const pairings = foodPairings.split(",").map((s) => s.trim()).filter(Boolean);
    onSave({
      rating: rating ? Number(rating) : null,
      notes: notes.trim() || null,
      foodPairings: pairings,
      wsetData: initialWsetData,
    });
  }

  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={localStyles.position}>Vin {wine.position}</Text>
          <Text style={localStyles.wineName}>{wine.name}</Text>
          <Text style={localStyles.wineMeta}>
            {[wine.producer, wine.vintage, wine.country].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Pressable onPress={onBack}>
          <Text style={localStyles.backText}>Tillbaka</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={localStyles.form} keyboardShouldPersistTaps="handled">
        <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={rating} onSelect={setRating} />

        {format === "wset" ? (
          initialWsetData ? (
            <Pressable onPress={() => onOpenWset(wine.type || "")} style={localStyles.wsetCard}>
              <Text style={localStyles.wsetLabel}>WSET Tasting</Text>
              <Text style={localStyles.wsetSummary}>{buildWsetSummary(initialWsetData)}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => onOpenWset(wine.type || "")} style={localStyles.wsetButton}>
              <Text style={localStyles.wsetButtonText}>WSET Tasting</Text>
            </Pressable>
          )
        ) : null}

        <LabeledInput label="Smaknotering" value={notes} onChangeText={setNotes} placeholder="t.ex. mörk frukt, bra syra" multiline />
        <LabeledInput label="Passar till" value={foodPairings} onChangeText={setFoodPairings} placeholder="lamm, pasta, ost" />

        <Pressable onPress={handleSave} style={localStyles.saveButton} disabled={saving}>
          <Text style={localStyles.saveButtonText}>{saving ? "Sparar..." : "Spara provning"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  position: { color: "#6f1d1b", fontSize: 11, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  wineName: { color: "#231815", fontSize: 20, fontWeight: "700" },
  wineMeta: { color: "#564a40", fontSize: 13, marginTop: 2 },
  backText: { color: "#6f1d1b", fontSize: 15, fontWeight: "600" },
  form: { gap: 14, paddingBottom: 24 },
  wsetCard: { backgroundColor: "#ead8ca", borderRadius: 12, padding: 12, gap: 4 },
  wsetLabel: { color: "#6f1d1b", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  wsetSummary: { color: "#564a40", fontSize: 13, lineHeight: 18 },
  wsetButton: { backgroundColor: "#ead8ca", borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  wsetButtonText: { color: "#6f1d1b", fontWeight: "700" },
  saveButton: { backgroundColor: "#6f1d1b", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fffaf5", fontWeight: "700", fontSize: 15 },
});
