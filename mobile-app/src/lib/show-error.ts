import { Alert } from "react-native";

export function showError(title: string, detail?: string) {
  Alert.alert(title, detail ?? "Försök igen.");
}
