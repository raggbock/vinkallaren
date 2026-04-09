import { Image, Pressable, Text, View } from "react-native";

import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function ImagePickerSection({ styles, imageUri, isDesktopWeb, onChooseImage, onTakePhoto }: {
  styles: SharedStyles; imageUri: string; isDesktopWeb: boolean;
  onChooseImage: () => void; onTakePhoto: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
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
    </View>
  );
}
