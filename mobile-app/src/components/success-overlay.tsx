import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

type SuccessConfig = { icon: string; title: string; subtitle?: string };

const PRESETS: Record<string, SuccessConfig> = {
  wine_added: { icon: "🍷", title: "Tillagt!", subtitle: "Vinet finns nu i din källare" },
  wine_drunk: { icon: "🥂", title: "Skål!", subtitle: "Sparad i historiken" },
  tasting_saved: { icon: "📝", title: "Sparat!", subtitle: "Provningsanteckning registrerad" },
  storage_saved: { icon: "📦", title: "Sparat!", subtitle: "Förvaringsplatsen är skapad" },
  edit_saved: { icon: "✓", title: "Uppdaterat!" },
  history_edited: { icon: "✏️", title: "Uppdaterat!", subtitle: "Historikposten är ändrad" },
  generic: { icon: "✓", title: "Sparat!" },
};

export function useSuccessOverlay() {
  const [config, setConfig] = useState<SuccessConfig | null>(null);

  const show = useCallback((preset: keyof typeof PRESETS | SuccessConfig) => {
    const c = typeof preset === "string" ? PRESETS[preset] ?? PRESETS.generic : preset;
    setConfig(c);
  }, []);

  const clear = useCallback(() => setConfig(null), []);

  return { config, show, clear };
}

export function SuccessOverlay({ config, onDone }: { config: SuccessConfig | null; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const iconScale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!config) return;
    opacity.setValue(0);
    scale.setValue(0.6);
    iconScale.setValue(0.3);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, tension: 100, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone());
    }, 1400);

    return () => clearTimeout(timer);
  }, [config]);

  if (!config) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.icon, { transform: [{ scale: iconScale }] }]}>
          {config.icon}
        </Animated.Text>
        <Text style={styles.title}>{config.title}</Text>
        {config.subtitle ? <Text style={styles.subtitle}>{config.subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43, 23, 20, 0.55)",
  },
  card: {
    backgroundColor: "#2b1714",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(244, 195, 140, 0.25)",
  },
  icon: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    color: "#fff6ee",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#d4bfaa",
    fontSize: 14,
  },
});
