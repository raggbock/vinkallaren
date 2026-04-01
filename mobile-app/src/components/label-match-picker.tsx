import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { AnimatedModal } from "./animated-modal";
import type { CatalogTextMatch } from "../hooks/useCellarData";

export function LabelMatchPickerModal({
  visible,
  matches,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  matches: CatalogTextMatch[];
  onSelect: (match: CatalogTextMatch) => void;
  onDismiss: () => void;
}) {
  return (
    <AnimatedModal visible={visible} onClose={onDismiss} mode="centered" cardStyle={pickerStyles.sheet}>
        <SafeAreaView>
          <Text style={pickerStyles.title}>Möjliga matchningar</Text>
          <Text style={pickerStyles.subtitle}>
            Resultatet baseras på etikettfoto och kan vara felaktigt. Kontrollera att vinet stämmer.
          </Text>

          <ScrollView style={pickerStyles.list}>
            {matches.map((match) => (
              <Pressable
                key={match.id}
                style={pickerStyles.matchRow}
                onPress={() => onSelect(match)}
              >
                <View style={pickerStyles.matchInfo}>
                  <Text style={pickerStyles.matchName}>{match.name}</Text>
                  <Text style={pickerStyles.matchMeta}>
                    {[match.producer, match.vintage].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={pickerStyles.matchScore}>
                  {Math.round(match.similarity * 100)}%
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={pickerStyles.dismissButton} onPress={onDismiss}>
            <Text style={pickerStyles.dismissText}>Ingen av dessa</Text>
          </Pressable>
        </SafeAreaView>
    </AnimatedModal>
  );
}

const pickerStyles = StyleSheet.create({
  sheet: {
    backgroundColor: "#2b1714",
    borderRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "60%",
    width: "90%",
    maxWidth: 420,
  },
  title: {
    color: "#fff6ee",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#c9a87c",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  list: {
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3d2220",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  matchInfo: {
    flex: 1,
    marginRight: 12,
  },
  matchName: {
    color: "#fff6ee",
    fontSize: 15,
    fontWeight: "600",
  },
  matchMeta: {
    color: "#c9a87c",
    fontSize: 13,
    marginTop: 2,
  },
  matchScore: {
    color: "#f4c38c",
    fontSize: 14,
    fontWeight: "700",
  },
  dismissButton: {
    backgroundColor: "#3d2220",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  dismissText: {
    color: "#c9a87c",
    fontSize: 16,
    fontWeight: "600",
  },
});
