import { Platform } from "react-native";

const SESSION_PATH = /^\/provning\/([0-9a-f-]{36})\/?$/i;

export function parseSessionIdFromUrl(): string | null {
  if (Platform.OS !== "web") return null;
  const match = window.location.pathname.match(SESSION_PATH);
  return match ? match[1] : null;
}

export function writeSessionRoute(sessionId: string | null): void {
  if (Platform.OS !== "web") return;
  const target = sessionId ? `/provning/${sessionId}` : "/";
  if (window.location.pathname === target) return;
  window.history.replaceState(null, "", target);
}
