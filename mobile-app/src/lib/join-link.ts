import { Platform, Share, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";

const BASE_URL = "https://minvinkallare.se";

/** Extract join code from current URL path: /join/ABC123 → ABC123 */
export function parseJoinCodeFromUrl(): string | null {
  if (Platform.OS !== "web") return null;
  const path = window.location.pathname;
  const match = path.match(/^\/join\/([A-Z0-9]{6})$/i);
  if (!match) return null;
  window.history.replaceState(null, "", "/");
  return match[1].toUpperCase();
}

export function buildJoinLink(joinCode: string): string {
  return `${BASE_URL}/join/${joinCode}`;
}

export function buildShareMessage(title: string, joinCode: string): string {
  return `Vinprovning: ${title}\nGå med här: ${buildJoinLink(joinCode)}`;
}

export async function shareSession(title: string, joinCode: string): Promise<void> {
  const message = buildShareMessage(title, joinCode);
  if (Platform.OS !== "web") {
    try {
      await Share.share({ message });
    } catch {
      // User cancelled — ignore
    }
    return;
  }
  // Web: try Web Share API, fallback to clipboard
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text: message });
      return;
    } catch {
      // User cancelled or not supported — fallback to clipboard
    }
  }
  await Clipboard.setStringAsync(message);
  Alert.alert("Kopierat!", "Länken har kopierats. Klistra in i valfri chatt.");
}
