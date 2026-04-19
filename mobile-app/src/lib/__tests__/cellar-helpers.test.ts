import {
  buildNumericOptions,
  parseTags,
  toNumberOrNull,
  emptyToNull,
  mergeTagText,
  normalizeLookupValue,
  getSuggestedPairings,
} from "../cellar-helpers";

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

