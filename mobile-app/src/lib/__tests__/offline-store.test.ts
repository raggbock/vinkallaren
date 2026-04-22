import { offlineStore } from "../offline-store";

describe("offlineStore", () => {
  beforeEach(async () => {
    await offlineStore.clear();
  });

  test("get returns null for missing key", async () => {
    expect(await offlineStore.get("missing")).toBeNull();
  });

  test("set then get roundtrips JSON", async () => {
    await offlineStore.set("k", { a: 1, b: "x" });
    expect(await offlineStore.get("k")).toEqual({ a: 1, b: "x" });
  });

  test("remove deletes a key", async () => {
    await offlineStore.set("k", 1);
    await offlineStore.remove("k");
    expect(await offlineStore.get("k")).toBeNull();
  });

  test("corrupt JSON returns null rather than throwing", async () => {
    const mod = await import("@react-native-async-storage/async-storage");
    await (mod.default as any).setItem("k", "{not json");
    expect(await offlineStore.get("k")).toBeNull();
  });
});
