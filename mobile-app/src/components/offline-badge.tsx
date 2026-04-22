import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { colors } from "../styles/theme";

export function OfflineBadge() {
  const { online } = useOnlineStatus();
  if (online) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Offline — ändringar synkas automatiskt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.warm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  text: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
