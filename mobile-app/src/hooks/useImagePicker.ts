import * as ImagePicker from "expo-image-picker";
import { showError } from "../lib/show-error";

export function useImagePicker() {
  async function pickImageFromLibrary(): Promise<string | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError("Behörighet saknas", "Ge appen tillgång till bilder.");
      return null;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });
      return result.canceled ? null : result.assets[0].uri;
    } catch {
      showError("Kunde inte öppna bildbiblioteket", "Försök igen.");
      return null;
    }
  }

  async function takePhoto(): Promise<string | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showError("Behörighet saknas", "Ge appen tillgång till kameran.");
      return null;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      return result.canceled ? null : result.assets[0].uri;
    } catch {
      showError("Kunde inte öppna kameran", "Försök igen.");
      return null;
    }
  }

  return { pickImageFromLibrary, takePhoto };
}
