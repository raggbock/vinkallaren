import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { colors } from "../styles/theme";

type Props = {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** "fullscreen" fills entire screen (dark bg), "centered" shows a card over overlay */
  mode?: "fullscreen" | "centered";
  /** Style for the inner card when mode="centered" */
  cardStyle?: ViewStyle;
};

export function AnimatedModal({ visible, onClose, children, mode = "fullscreen", cardStyle }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      translateY.setValue(24);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 14, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (mode === "centered") {
    return (
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <Animated.View style={[styles.overlay, { opacity }]}>
          <Pressable style={styles.overlayTouchable} onPress={onClose} />
          <Animated.View style={[styles.centeredCard, cardStyle, { opacity, transform: [{ scale }, { translateY }] }]}>
            {children}
          </Animated.View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.fullscreen, { opacity, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(43, 23, 20, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
    gap: 14,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
