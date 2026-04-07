import { emptyWsetData, getColourOptions, swedishLabel, buildWsetSummary, showTannin } from "../wset-data";

describe("emptyWsetData", () => {
  test("returns complete empty structure", () => {
    const data = emptyWsetData();
    expect(data.protocol).toBe("wset_l2");
    expect(data.appearance.intensity).toBeNull();
    expect(data.nose.aromas).toEqual([]);
    expect(data.palate.sweetness).toBeNull();
    expect(data.conclusions.quality).toBeNull();
  });
});

describe("getColourOptions", () => {
  test("rött returns red colours", () => {
    expect(getColourOptions("Rött")).toEqual(["purple", "ruby", "garnet", "tawny"]);
  });
  test("rosé returns rose colours", () => {
    expect(getColourOptions("Rosé")).toEqual(["pink", "pink-orange", "orange"]);
  });
  test("vitt/other returns white colours", () => {
    expect(getColourOptions("Vitt")).toEqual(["lemon", "gold", "amber"]);
    expect(getColourOptions("Mousserande")).toEqual(["lemon", "gold", "amber"]);
  });
});

describe("swedishLabel", () => {
  test("translates known values", () => {
    expect(swedishLabel("dry")).toBe("Torrt");
    expect(swedishLabel("high")).toBe("Hög");
    expect(swedishLabel("outstanding")).toBe("Enastående");
  });
  test("passes through unknown values", () => {
    expect(swedishLabel("custom")).toBe("custom");
  });
});

describe("buildWsetSummary", () => {
  test("combines all sections with pipes", () => {
    const data = {
      ...emptyWsetData(),
      appearance: { intensity: "deep" as const, colour: "ruby" },
      nose: { intensity: "pronounced" as const, aromas: ["cherry", "vanilla"], aromaNote: null },
      palate: { sweetness: "dry" as const, acidity: "high" as const, tannin: "high" as const, alcohol: "high" as const, body: "full" as const, flavourIntensity: "pronounced" as const, flavours: [], flavourNote: null, finish: "long" as const },
      conclusions: { quality: "very good" as const },
    };
    const summary = buildWsetSummary(data);
    expect(summary).toContain("deep, ruby");
    expect(summary).toContain("pronounced, cherry, vanilla");
    expect(summary).toContain("dry");
    expect(summary).toContain("very good");
  });
  test("empty data returns No data", () => {
    expect(buildWsetSummary(emptyWsetData())).toBe("No data");
  });
});

describe("showTannin", () => {
  test("true for red wine", () => { expect(showTannin("Rött")).toBe(true); });
  test("false for white wine", () => { expect(showTannin("Vitt")).toBe(false); });
  test("false for rosé", () => { expect(showTannin("Rosé")).toBe(false); });
});
