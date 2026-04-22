import { useEffect, useState } from "react";
import { Platform } from "react-native";

function readInitial(): boolean {
  if (Platform.OS === "web") return typeof navigator !== "undefined" ? navigator.onLine : true;
  return true;
}

export function useOnlineStatus(): { online: boolean } {
  const [online, setOnline] = useState<boolean>(readInitial);

  useEffect(() => {
    if (Platform.OS === "web") {
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    }
    const NetInfo = require("@react-native-community/netinfo").default;
    const sub = NetInfo.addEventListener((state: { isConnected: boolean | null }) => {
      setOnline(Boolean(state.isConnected));
    });
    return () => sub();
  }, []);

  return { online };
}
