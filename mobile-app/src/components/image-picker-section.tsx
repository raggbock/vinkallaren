import { useEffect, useRef } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function ImagePickerSection({ styles, imageUri, isDesktopWeb, onChooseImage, onTakePhoto, highlighted }: {
  styles: SharedStyles; imageUri: string; isDesktopWeb: boolean;
  onChooseImage: () => void; onTakePhoto: () => void;
  highlighted?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!highlighted) { pulse.setValue(0); return; }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]),
      { iterations: 3 },
    ).start();
  }, [highlighted]);

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(200, 60, 45, 0)", "rgba(200, 60, 45, 0.5)"],
  });

  return (
    <Animated.View
      style={[s.container, highlighted && { borderColor, borderWidth: 2, borderRadius: 16 }]}
    >
      {highlighted && !imageUri ? (
        <Text style={s.nudge}>En bild på etiketten hjälper dig hitta vinet igen!</Text>
      ) : null}
      <View style={styles.imageButtonRow}>
        {isDesktopWeb ? (
          <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Ladda upp bild av etiketten</Text>
          </Pressable>
        ) : (
          <>
            <Pressable onPress={onTakePhoto} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Ta foto av etiketten</Text>
            </Pressable>
            <Pressable onPress={onChooseImage} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{imageUri ? "Byt bild" : "Välj flaskbild"}</Text>
            </Pressable>
          </>
        )}
      </View>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.wineImage} resizeMode="contain" accessibilityLabel="Vald vinbild" /> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { gap: 12, padding: 4 },
  nudge: { color: colors.accent, fontSize: 13, fontWeight: "600", textAlign: "center" },
});
