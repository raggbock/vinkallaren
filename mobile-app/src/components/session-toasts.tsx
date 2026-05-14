import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import type { SessionToast } from "../types/tasting-session";

export function SessionToasts({ toasts }: { toasts: SessionToast[] }) {
  return (
    <View pointerEvents="none" style={s.overlay}>
      {toasts.map((t) => (
        <ToastBubble key={t.id} message={t.message} />
      ))}
    </View>
  );
}

function ToastBubble({ message }: { message: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 90, friction: 12 }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        s.bubble,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <View style={s.dot} />
      <Text style={s.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: { position: "absolute", top: 12, left: 12, right: 12, gap: 8, zIndex: 9999, alignItems: "center" },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28, 22, 22, 0.92)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
    maxWidth: 420,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  text: { color: colors.textLight, fontSize: 13, fontWeight: "600", letterSpacing: 0.2, flexShrink: 1 },
});
