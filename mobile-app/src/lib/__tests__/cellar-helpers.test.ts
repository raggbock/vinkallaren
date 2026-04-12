import {
  buildNumericOptions,
  parseTags,
  toNumberOrNull,
  emptyToNull,
  mergeTagText,
  normalizeLookupValue,
  getSuggestedPairings,
  buildStats,
  buildVintageOptions,
  buildStorageSpaceBottleCounts,
  buildPairingOptions,
} from "../cellar-helpers";

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

type WineRecord = {
  id: string;
  user_id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  grape: string | null;
  vintage: number | null;
  quantity: number;
  type: string;
  barcode: string | null;
  systembolaget_product_id: string | null;
  storage_space_id: string | null;
  storage_row: number | null;
  storage_slot: number | null;
  tags: string[];
  food_pairings: string[];
  pairing_source: string | null;
  notes: string | null;
  cellar_location: string | null;
  image_path: string | null;
  image_url: string | null;
  acquired_at: string | null;
  drink_by_year: number | null;
  created_at: string;
  updated_at: string;
};

let _idCounter = 0;
function wine(overrides: Partial<WineRecord> = {}): WineRecord {
  _idCounter += 1;
  return {
    id: `wine-${_idCounter}`,
    user_id: "user-1",
    name: `Wine ${_idCounter}`,
    producer: null,
    country: null,
    region: null,
    grape: null,
    vintage: null,
    quantity: 1,
    type: "Rött",
    barcode: null,
    systembolaget_product_id: null,
    storage_space_id: null,
    storage_row: null,
    storage_slot: null,
    tags: [],
    food_pairings: [],
    pairing_source: null,
    notes: null,
    cellar_location: null,
    image_path: null,
    image_url: null,
    acquired_at: null,
    drink_by_year: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildNumericOptions
// ---------------------------------------------------------------------------

describe("buildNumericOptions", () => {
  it("returns ['1'] for count 1", () => {
    expect(buildNumericOptions(1)).toEqual(["1"]);
  });

  it("returns ['1','2','3'] for count 3", () => {
    expect(buildNumericOptions(3)).toEqual(["1", "2", "3"]);
  });

  it("returns at least ['1'] for count 0 (minimum 1)", () => {
    expect(buildNumericOptions(0)).toEqual(["1"]);
  });

  it("returns at least ['1'] for negative count", () => {
    expect(buildNumericOptions(-5)).toEqual(["1"]);
  });

  it("returns correct length for count 10", () => {
    const result = buildNumericOptions(10);
    expect(result).toHaveLength(10);
    expect(result[0]).toBe("1");
    expect(result[9]).toBe("10");
  });
});

// ---------------------------------------------------------------------------
// parseTags
// ---------------------------------------------------------------------------

describe("parseTags", () => {
  it("splits by comma", () => {
    expect(parseTags("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("trims each tag", () => {
    expect(parseTags("  foo  ,  bar  ")).toEqual(["foo", "bar"]);
  });

  it("filters out empty segments", () => {
    expect(parseTags("a,,b")).toEqual(["a", "b"]);
  });

  it("returns empty array for blank input", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("handles single tag without comma", () => {
    expect(parseTags("organiskt")).toEqual(["organiskt"]);
  });

  it("filters whitespace-only segments", () => {
    expect(parseTags("a,   ,b")).toEqual(["a", "b"]);
  });
});

// ---------------------------------------------------------------------------
// toNumberOrNull
// ---------------------------------------------------------------------------

describe("toNumberOrNull", () => {
  it("returns a positive integer", () => {
    expect(toNumberOrNull("5")).toBe(5);
  });

  it("returns a positive float", () => {
    expect(toNumberOrNull("3.14")).toBe(3.14);
  });

  it("returns null for zero", () => {
    expect(toNumberOrNull("0")).toBeNull();
  });

  it("returns null for negative number", () => {
    expect(toNumberOrNull("-1")).toBeNull();
  });

  it("returns null for NaN string", () => {
    expect(toNumberOrNull("abc")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(toNumberOrNull("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// emptyToNull
// ---------------------------------------------------------------------------

describe("emptyToNull", () => {
  it("returns trimmed string for non-empty input", () => {
    expect(emptyToNull("  hello  ")).toBe("hello");
  });

  it("returns null for empty string", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(emptyToNull("   ")).toBeNull();
  });

  it("preserves non-whitespace content", () => {
    expect(emptyToNull("Bordeaux")).toBe("Bordeaux");
  });
});

// ---------------------------------------------------------------------------
// mergeTagText
// ---------------------------------------------------------------------------

describe("mergeTagText", () => {
  it("appends a new tag to empty current value", () => {
    expect(mergeTagText("", "organiskt")).toBe("organiskt");
  });

  it("appends a new tag to existing tags", () => {
    expect(mergeTagText("organiskt", "naturvin")).toBe("organiskt, naturvin");
  });

  it("removes an existing tag (toggle off)", () => {
    expect(mergeTagText("organiskt, naturvin", "organiskt")).toBe("naturvin");
  });

  it("handles multiple existing tags and appends a new one", () => {
    const result = mergeTagText("a, b, c", "d");
    expect(result).toBe("a, b, c, d");
  });

  it("removes tag from middle of list", () => {
    expect(mergeTagText("a, b, c", "b")).toBe("a, c");
  });
});

// ---------------------------------------------------------------------------
// normalizeLookupValue
// ---------------------------------------------------------------------------

describe("normalizeLookupValue", () => {
  it("lowercases the input", () => {
    expect(normalizeLookupValue("Bordeaux")).toBe("bordeaux");
  });

  it("strips common diacritics", () => {
    expect(normalizeLookupValue("Château")).toBe("chateau");
  });

  it("handles Swedish diacritics", () => {
    expect(normalizeLookupValue("Märklig")).toBe("marklig");
  });

  it("normalizes curly single quotes to straight quotes", () => {
    // \u2019 is the right single quotation mark
    expect(normalizeLookupValue("d\u2019Alsace")).toBe("d'Alsace".toLowerCase());
  });

  it("normalizes backtick to straight quote", () => {
    expect(normalizeLookupValue("d\u0060Alsace")).toBe("d'alsace");
  });

  it("handles already-normalized plain string", () => {
    expect(normalizeLookupValue("bordeaux")).toBe("bordeaux");
  });
});

// ---------------------------------------------------------------------------
// getSuggestedPairings
// ---------------------------------------------------------------------------

describe("getSuggestedPairings", () => {
  it("returns fisk for Vitt wine type", () => {
    expect(getSuggestedPairings("Vitt")).toContain("fisk");
  });

  it("returns skaldjur for Vitt", () => {
    expect(getSuggestedPairings("Vitt")).toContain("skaldjur");
  });

  it("returns aperitif for Mousserande", () => {
    expect(getSuggestedPairings("Mousserande")).toContain("aperitif");
  });

  it("returns grillat for Rosé", () => {
    expect(getSuggestedPairings("Rosé")).toContain("grillat");
  });

  it("returns dessert for Dessertvin", () => {
    expect(getSuggestedPairings("Dessertvin")).toContain("dessert");
  });

  it("returns lamm for Rött (default)", () => {
    expect(getSuggestedPairings("Rött")).toContain("lamm");
  });

  it("returns nöt for unknown type (falls through to Rött default)", () => {
    expect(getSuggestedPairings("Okänt")).toContain("nöt");
  });

  it("is case-insensitive — 'vitt' matches Vitt branch", () => {
    expect(getSuggestedPairings("vitt")).toContain("fisk");
  });
});

// ---------------------------------------------------------------------------
// buildStats
// ---------------------------------------------------------------------------

describe("buildStats", () => {
  it("returns zeros and defaults for empty array", () => {
    const stats = buildStats([]);
    expect(stats.totalBottles).toBe(0);
    expect(stats.totalLabels).toBe(0);
    expect(stats.drinkSoon).toBe(0);
    expect(stats.topCountry).toBe("Ingen data");
    expect(stats.topType).toBe("Ingen data");
    expect(stats.topPairing).toBe("Ingen data");
    expect(stats.averageVintage).toBe("-");
  });

  it("sums totalBottles across wines", () => {
    const wines = [wine({ quantity: 3 }), wine({ quantity: 7 })];
    expect(buildStats(wines).totalBottles).toBe(10);
  });

  it("counts totalLabels as number of wine entries", () => {
    const wines = [wine(), wine(), wine()];
    expect(buildStats(wines).totalLabels).toBe(3);
  });

  it("counts drinkSoon correctly for wines due this year or next", () => {
    const currentYear = new Date().getFullYear();
    const wines = [
      wine({ quantity: 2, drink_by_year: currentYear }),
      wine({ quantity: 3, drink_by_year: currentYear + 1 }),
      wine({ quantity: 5, drink_by_year: currentYear + 5 }),
      wine({ quantity: 1, drink_by_year: null }),
    ];
    expect(buildStats(wines).drinkSoon).toBe(5);
  });

  it("identifies topCountry by bottle count", () => {
    const wines = [
      wine({ country: "Frankrike", quantity: 5 }),
      wine({ country: "Italien", quantity: 3 }),
      wine({ country: "Frankrike", quantity: 2 }),
    ];
    expect(buildStats(wines).topCountry).toBe("Frankrike (7)");
  });

  it("identifies topType by bottle count", () => {
    const wines = [
      wine({ type: "Vitt", quantity: 4 }),
      wine({ type: "Rött", quantity: 6 }),
    ];
    expect(buildStats(wines).topType).toBe("Rött (6)");
  });

  it("identifies topPairing by bottle count", () => {
    const wines = [
      wine({ food_pairings: ["fisk", "sallad"], quantity: 2 }),
      wine({ food_pairings: ["fisk"], quantity: 5 }),
    ];
    expect(buildStats(wines).topPairing).toBe("fisk (7)");
  });

  it("computes averageVintage correctly", () => {
    const wines = [
      wine({ vintage: 2018 }),
      wine({ vintage: 2020 }),
      wine({ vintage: 2022 }),
    ];
    expect(buildStats(wines).averageVintage).toBe("2020");
  });

  it("rounds averageVintage", () => {
    const wines = [wine({ vintage: 2019 }), wine({ vintage: 2020 })];
    // (2019+2020)/2 = 2019.5 → rounds to 2020
    expect(buildStats(wines).averageVintage).toBe("2020");
  });

  it("excludes null vintages from average", () => {
    const wines = [wine({ vintage: 2020 }), wine({ vintage: null })];
    expect(buildStats(wines).averageVintage).toBe("2020");
  });
});

// ---------------------------------------------------------------------------
// buildVintageOptions
// ---------------------------------------------------------------------------

describe("buildVintageOptions", () => {
  it("returns ['Alla'] for empty wines array", () => {
    expect(buildVintageOptions([])).toEqual(["Alla"]);
  });

  it("'Alla' is always first", () => {
    const wines = [wine({ vintage: 2018 }), wine({ vintage: 2020 })];
    expect(buildVintageOptions(wines)[0]).toBe("Alla");
  });

  it("sorts vintages descending after 'Alla'", () => {
    const wines = [
      wine({ vintage: 2015 }),
      wine({ vintage: 2020 }),
      wine({ vintage: 2018 }),
    ];
    expect(buildVintageOptions(wines)).toEqual(["Alla", "2020", "2018", "2015"]);
  });

  it("deduplicates vintages", () => {
    const wines = [wine({ vintage: 2019 }), wine({ vintage: 2019 }), wine({ vintage: 2021 })];
    expect(buildVintageOptions(wines)).toEqual(["Alla", "2021", "2019"]);
  });

  it("excludes null vintages", () => {
    const wines = [wine({ vintage: null }), wine({ vintage: 2020 })];
    expect(buildVintageOptions(wines)).toEqual(["Alla", "2020"]);
  });
});

// ---------------------------------------------------------------------------
// buildStorageSpaceBottleCounts
// ---------------------------------------------------------------------------

describe("buildStorageSpaceBottleCounts", () => {
  it("returns an empty map for no wines", () => {
    expect(buildStorageSpaceBottleCounts([])).toEqual(new Map());
  });

  it("sums quantities per storage space", () => {
    const wines = [
      wine({ storage_space_id: "space-1", quantity: 3 }),
      wine({ storage_space_id: "space-1", quantity: 2 }),
      wine({ storage_space_id: "space-2", quantity: 5 }),
    ];
    const counts = buildStorageSpaceBottleCounts(wines);
    expect(counts.get("space-1")).toBe(5);
    expect(counts.get("space-2")).toBe(5);
  });

  it("ignores wines without a storage_space_id", () => {
    const wines = [
      wine({ storage_space_id: null, quantity: 10 }),
      wine({ storage_space_id: "space-1", quantity: 2 }),
    ];
    const counts = buildStorageSpaceBottleCounts(wines);
    expect(counts.size).toBe(1);
    expect(counts.get("space-1")).toBe(2);
  });

  it("creates separate entries for different storage spaces", () => {
    const wines = [
      wine({ storage_space_id: "a", quantity: 1 }),
      wine({ storage_space_id: "b", quantity: 1 }),
    ];
    const counts = buildStorageSpaceBottleCounts(wines);
    expect(counts.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// buildPairingOptions
// ---------------------------------------------------------------------------

describe("buildPairingOptions", () => {
  it("returns ['Alla'] for empty wines array", () => {
    expect(buildPairingOptions([])).toEqual(["Alla"]);
  });

  it("'Alla' is always first", () => {
    const wines = [wine({ food_pairings: ["fisk"] })];
    expect(buildPairingOptions(wines)[0]).toBe("Alla");
  });

  it("includes pairings from all wines", () => {
    const wines = [
      wine({ food_pairings: ["fisk", "sallad"] }),
      wine({ food_pairings: ["lamm"] }),
    ];
    const options = buildPairingOptions(wines);
    expect(options).toContain("fisk");
    expect(options).toContain("sallad");
    expect(options).toContain("lamm");
  });

  it("deduplicates pairings", () => {
    const wines = [
      wine({ food_pairings: ["fisk"] }),
      wine({ food_pairings: ["fisk", "lamm"] }),
    ];
    const options = buildPairingOptions(wines);
    expect(options.filter((o) => o === "fisk")).toHaveLength(1);
  });

  it("includes all pairings from a single wine with multiple pairings", () => {
    const wines = [wine({ food_pairings: ["ost", "nöt", "grillat"] })];
    const options = buildPairingOptions(wines);
    expect(options).toEqual(["Alla", "ost", "nöt", "grillat"]);
  });
});
