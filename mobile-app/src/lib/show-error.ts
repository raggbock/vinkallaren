import { Alert, Platform } from "react-native";

export function showError(title: string, detail?: string) {
  Alert.alert(title, detail ?? "Försök igen.");
}

export function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Avbryt", style: "cancel" },
      { text: "OK", style: "destructive", onPress: onConfirm },
    ]);
  }
}
