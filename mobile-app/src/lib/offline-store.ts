import AsyncStorage from "@react-native-async-storage/async-storage";

export const offlineStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    await AsyncStorage.clear();
  },
};

export const K = {
  sessions: "tasting:sessions",
  sessionWines: (id: string) => `tasting:session:${id}:wines`,
  sessionTastings: (id: string) => `tasting:session:${id}:tastings`,
  queue: "tasting:queue",
  wsetDraft: (wineId: string) => `wset:draft:${wineId}`,
  lastSync: (id: string) => `offline:lastSync:${id}`,
};
