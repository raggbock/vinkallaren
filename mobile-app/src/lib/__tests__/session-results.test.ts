import {
  stddev,
  averageRating,
  consensusLevel,
  buildSessionResults,
  getSharedAromas,
  getWsetParameterComparison,
} from "../session-results";
import type { SessionWineRow, SessionTastingRow } from "../../types/tasting-session";

// --- Helpers ---

function makeWine(id: string, overrides: Partial<SessionWineRow> = {}): SessionWineRow {
  return {
    id,
    session_id: "sess-1",
    position: 1,
    name: `Wine ${id}`,
    producer: null,
    country: null,
    region: null,
    grape: null,
    vintage: null,
    type: null,
    wine_id: null,
    created_at: "2026-04-07T00:00:00Z",
    ...overrides,
  };
}

function makeTasting(
  id: string,
  sessionWineId: string,
  userId: string,
  rating: number | null = null,
  tastingData: Record<string, unknown> | null = null,
): SessionTastingRow {
  return {
    id,
    session_id: "sess-1",
    session_wine_id: sessionWineId,
    user_id: userId,
    rating,
    notes: null,
    food_pairings: [],
    tasting_data: tastingData,
    created_at: "2026-04-07T00:00:00Z",
  };
}

// --- stddev ---

describe("stddev", () => {
  it("returns 0 for empty array", () => {
    expect(stddev([])).toBe(0);
  });

  it("returns 0 for single value", () => {
    expect(stddev([5])).toBe(0);
  });

  it("returns 0 for identical values", () => {
    expect(stddev([3, 3, 3])).toBe(0);
  });

  it("returns ~2 for [2,4,4,4,5,5,7,9]", () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });
});

// --- averageRating ---

describe("averageRating", () => {
  it("returns null when all values are null", () => {
    expect(averageRating([null, null])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(averageRating([])).toBeNull();
  });

  it("filters nulls and averages remaining values", () => {
    expect(averageRating([3, null, 5])).toBe(4);
  });

  it("returns value for single non-null entry", () => {
    expect(averageRating([7])).toBe(7);
  });
});

// --- consensusLevel ---

describe("consensusLevel", () => {
  it("returns 'high' when spread < 0.8", () => {
    expect(consensusLevel(0.5)).toBe("high");
  });

  it("returns 'low' when spread > 0.8", () => {
    expect(consensusLevel(1.2)).toBe("low");
  });

  it("returns 'low' at exactly 0.8 (boundary)", () => {
    expect(consensusLevel(0.8)).toBe("low");
  });
});

// --- buildSessionResults ---

describe("buildSessionResults", () => {
  it("handles empty wines list", () => {
    const result = buildSessionResults([], [], "quick", "2026-04-07");
    expect(result.wineCount).toBe(0);
    expect(result.wines).toHaveLength(0);
    expect(result.favorite).toBeNull();
    expect(result.mostDivided).toBeNull();
    expect(result.participantCount).toBe(0);
  });

  it("quick format: favorite is wine with highest average rating", () => {
    const wines = [makeWine("w1"), makeWine("w2")];
    const tastings = [
      makeTasting("t1", "w1", "u1", 7),
      makeTasting("t2", "w2", "u1", 9),
    ];
    const result = buildSessionResults(wines, tastings, "quick", "2026-04-07");
    expect(result.favorite?.wine.id).toBe("w2");
  });

  it("mostDivided is null when all rating spreads are 0", () => {
    const wines = [makeWine("w1")];
    const tastings = [makeTasting("t1", "w1", "u1", 5)];
    const result = buildSessionResults(wines, tastings, "quick", "2026-04-07");
    expect(result.mostDivided).toBeNull();
  });

  it("counts unique participants", () => {
    const wines = [makeWine("w1")];
    const tastings = [
      makeTasting("t1", "w1", "u1", 5),
      makeTasting("t2", "w1", "u2", 7),
      makeTasting("t3", "w1", "u1", 6), // duplicate user
    ];
    const result = buildSessionResults(wines, tastings, "quick", "2026-04-07");
    expect(result.participantCount).toBe(2);
  });
});

// --- getSharedAromas ---

describe("getSharedAromas", () => {
  it("returns empty array when tastings is empty", () => {
    expect(getSharedAromas([])).toEqual([]);
  });

  it("returns empty array when no tasting_data", () => {
    expect(getSharedAromas([makeTasting("t1", "w1", "u1")])).toEqual([]);
  });

  it("returns aromas mentioned by 2+ users", () => {
    const t1 = makeTasting("t1", "w1", "u1", null, {
      nose: { aromas: ["cherry", "vanilla"] },
      palate: { flavours: [] },
    });
    const t2 = makeTasting("t2", "w1", "u2", null, {
      nose: { aromas: ["cherry"] },
      palate: { flavours: ["vanilla"] },
    });
    const shared = getSharedAromas([t1, t2]);
    expect(shared).toContain("cherry");
    expect(shared).toContain("vanilla");
  });

  it("does not return aromas mentioned by only one user", () => {
    const t1 = makeTasting("t1", "w1", "u1", null, {
      nose: { aromas: ["oak"] },
      palate: { flavours: [] },
    });
    const shared = getSharedAromas([t1]);
    expect(shared).not.toContain("oak");
  });
});

// --- getWsetParameterComparison ---

describe("getWsetParameterComparison", () => {
  it("returns empty array when no tastings have data", () => {
    expect(getWsetParameterComparison([])).toEqual([]);
  });

  it("counts parameter values across tastings", () => {
    const t1 = makeTasting("t1", "w1", "u1", null, {
      palate: { acidity: "high", sweetness: "dry" },
    });
    const t2 = makeTasting("t2", "w1", "u2", null, {
      palate: { acidity: "medium" },
    });
    const result = getWsetParameterComparison([t1, t2]);
    const acidity = result.find((p) => p.param === "acidity");
    expect(acidity).toBeDefined();
    expect(acidity?.counts["high"]).toBe(1);
    expect(acidity?.counts["medium"]).toBe(1);
  });

  it("only includes params with at least one value", () => {
    const t1 = makeTasting("t1", "w1", "u1", null, {
      palate: { body: "full" },
    });
    const result = getWsetParameterComparison([t1]);
    const paramKeys = result.map((p) => p.param);
    expect(paramKeys).toContain("body");
    expect(paramKeys).not.toContain("tannin"); // no data for tannin
  });
});
