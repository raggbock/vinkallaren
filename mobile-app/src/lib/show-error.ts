import { Alert, Platform } from "react-native";

const DEDUPE_WINDOW_MS = 3000;
const recent = new Map<string, number>();

export function showError(title: string, detail?: string) {
  const message = detail ?? "Försök igen.";
  const key = `${title}\n${message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return;
  recent.set(key, now);
  if (Platform.OS === "web") {
    // RN-web's Alert.alert is a no-op; fall back to the browser alert
    // so failed saves/loads actually surface to the user.
    (globalThis as { alert?: (message: string) => void }).alert?.(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
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
