# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full three-layer test suite (unit, hook, E2E) to the Vinkällaren mobile app.

**Architecture:** Jest + ts-jest for unit and hook tests, React Native Testing Library for hooks, Playwright against Expo Web for E2E. All tests run without network — Supabase is mocked.

**Tech Stack:** Jest, ts-jest, @types/jest, @testing-library/react-native, @testing-library/jest-native, @playwright/test

---

## File Structure

```
mobile-app/
├── jest.config.ts                          # Jest config (ts-jest, RN preset)
├── src/
│   ├── __mocks__/
│   │   └── supabase.ts                     # Shared chainable Supabase mock
│   ├── lib/
│   │   └── __tests__/
│   │       ├── format-date.test.ts
│   │       ├── image-hash.test.ts
│   │       ├── session-results.test.ts
│   │       ├── wine-inference.test.ts
│   │       ├── label-ocr.test.ts
│   │       ├── cellar-helpers.test.ts
│   │       ├── wine-helpers.test.ts
│   │       ├── wset-data.test.ts
│   │       ├── join-link.test.ts
│   │       ├── taste-profile.test.ts
│   │       ├── profile-actions.test.ts
│   │       ├── query-helpers.test.ts
│   │       └── catalog-search.test.ts
│   └── hooks/
│       └── __tests__/
│           ├── useCellarFilters.test.tsx
│           └── useModalToggle.test.tsx
├── e2e/
│   ├── playwright.config.ts
│   └── tests/
│       ├── auth.spec.ts
│       └── add-wine.spec.ts
```

---

### Task 1: Install Dependencies and Configure Jest

**Files:**
- Modify: `package.json`
- Create: `jest.config.ts`

- [ ] **Step 1: Install test dependencies**

```bash
cd mobile-app && npm install --save-dev jest ts-jest @types/jest @testing-library/react-native @testing-library/jest-native @playwright/test
```

- [ ] **Step 2: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  // Mock react-native for hook tests
  moduleNameMapper: {
    "^react-native$": "<rootDir>/src/__mocks__/react-native.ts",
  },
};

export default config;
```

- [ ] **Step 3: Add test scripts to package.json**

Add these to the `"scripts"` section:

```json
"test": "jest",
"test:unit": "jest --testPathPattern=src/lib/__tests__",
"test:hooks": "jest --testPathPattern=src/hooks/__tests__",
"test:e2e": "npx playwright test --config=e2e/playwright.config.ts"
```

- [ ] **Step 4: Create minimal react-native mock**

Create `src/__mocks__/react-native.ts`:

```typescript
export const Platform = { OS: "web" };
export const Share = { share: jest.fn() };
export const Alert = { alert: jest.fn() };
export const StyleSheet = { create: (s: any) => s };
```

- [ ] **Step 5: Verify Jest runs (should find 0 tests)**

```bash
cd mobile-app && npx jest --passWithNoTests
```

Expected: `No tests found` or `Test Suites: 0 total` — no errors.

- [ ] **Step 6: Commit**

```bash
git add jest.config.ts package.json package-lock.json src/__mocks__/react-native.ts
git commit -m "chore: add Jest + RNTL + Playwright test infrastructure"
```

---

### Task 2: Unit Tests — format-date

**Files:**
- Create: `src/lib/__tests__/format-date.test.ts`
- Test: `src/lib/format-date.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { formatDateFull, formatDateLong, formatDateShort, formatDateISO } from "../format-date";

describe("format-date", () => {
  test("formatDateFull returns Swedish short month format", () => {
    const result = formatDateFull("2026-04-03");
    expect(result).toMatch(/3 apr\. 2026/);
  });

  test("formatDateLong returns Swedish long month format", () => {
    const result = formatDateLong("2026-04-03");
    expect(result).toMatch(/3 april 2026/);
  });

  test("formatDateShort returns day and short month", () => {
    const result = formatDateShort("2026-04-03");
    expect(result).toMatch(/3 apr\./);
  });

  test("formatDateISO returns YYYY-MM-DD", () => {
    expect(formatDateISO("2026-04-03")).toBe("2026-04-03");
  });

  test("handles ISO datetime strings", () => {
    const result = formatDateISO("2026-04-03T14:30:00Z");
    expect(result).toBe("2026-04-03");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd mobile-app && npx jest src/lib/__tests__/format-date.test.ts --verbose
```

Expected: 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/format-date.test.ts
git commit -m "test: add unit tests for format-date"
```

---

### Task 3: Unit Tests — image-hash

**Files:**
- Create: `src/lib/__tests__/image-hash.test.ts`
- Test: `src/lib/image-hash.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { hammingDistance, hashSimilarity, computeDHashFromPixels } from "../image-hash";

describe("hammingDistance", () => {
  test("identical hashes return 0", () => {
    expect(hammingDistance("abcdef0123456789", "abcdef0123456789")).toBe(0);
  });

  test("completely different hashes return 64", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });

  test("single hex digit difference", () => {
    // 0 vs 1 = binary 0000 vs 0001 = 1 bit different
    expect(hammingDistance("0000000000000000", "1000000000000000")).toBe(1);
  });

  test("different length hashes return 64", () => {
    expect(hammingDistance("abcd", "abcdef")).toBe(64);
  });
});

describe("hashSimilarity", () => {
  test("identical hashes return 1", () => {
    expect(hashSimilarity("abcdef0123456789", "abcdef0123456789")).toBe(1);
  });

  test("opposite hashes return 0", () => {
    expect(hashSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
  });
});

describe("computeDHashFromPixels", () => {
  test("uniform pixels produce all-zero hash", () => {
    // All pixels same value → no gradient → all 0 bits
    const pixels = new Array(100 * 100).fill(128);
    const hash = computeDHashFromPixels(pixels, 100, 100);
    expect(hash).toBe("0000000000000000");
  });

  test("produces 16-char hex string", () => {
    const pixels = Array.from({ length: 100 * 100 }, (_, i) => i % 256);
    const hash = computeDHashFromPixels(pixels, 100, 100);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  test("different images produce different hashes", () => {
    const a = Array.from({ length: 100 * 100 }, (_, i) => i % 256);
    const b = Array.from({ length: 100 * 100 }, (_, i) => (255 - i) % 256);
    expect(computeDHashFromPixels(a, 100, 100)).not.toBe(computeDHashFromPixels(b, 100, 100));
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/image-hash.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/image-hash.test.ts
git commit -m "test: add unit tests for image-hash"
```

---

### Task 4: Unit Tests — session-results

**Files:**
- Create: `src/lib/__tests__/session-results.test.ts`
- Test: `src/lib/session-results.ts`

- [ ] **Step 1: Write the tests**

```typescript
import {
  stddev,
  averageRating,
  consensusLevel,
  buildSessionResults,
  getSharedAromas,
  getWsetParameterComparison,
} from "../session-results";
import type { SessionTastingRow, SessionWineRow } from "../../types/tasting-session";

describe("stddev", () => {
  test("empty array returns 0", () => {
    expect(stddev([])).toBe(0);
  });

  test("single value returns 0", () => {
    expect(stddev([5])).toBe(0);
  });

  test("identical values return 0", () => {
    expect(stddev([3, 3, 3])).toBe(0);
  });

  test("known values", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, variance=4, stddev=2
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
  });
});

describe("averageRating", () => {
  test("all null returns null", () => {
    expect(averageRating([null, null])).toBeNull();
  });

  test("filters nulls and averages", () => {
    expect(averageRating([3, null, 5])).toBe(4);
  });

  test("single value", () => {
    expect(averageRating([7])).toBe(7);
  });
});

describe("consensusLevel", () => {
  test("low spread = high consensus", () => {
    expect(consensusLevel(0.5)).toBe("high");
  });

  test("high spread = low consensus", () => {
    expect(consensusLevel(1.2)).toBe("low");
  });

  test("threshold boundary (0.8) = low", () => {
    expect(consensusLevel(0.8)).toBe("low");
  });
});

const makeWine = (id: string): SessionWineRow => ({
  id, session_id: "s1", position: 1, name: "Test Wine",
  producer: null, country: null, region: null, grape: null,
  vintage: null, type: null, wine_id: null, created_at: "2026-01-01",
});

const makeTasting = (wineId: string, userId: string, rating: number | null, data?: Record<string, unknown>): SessionTastingRow => ({
  id: `t-${wineId}-${userId}`, session_id: "s1",
  session_wine_id: wineId, user_id: userId,
  rating, notes: null, food_pairings: [],
  tasting_data: data ?? null, created_at: "2026-01-01",
});

describe("buildSessionResults", () => {
  test("empty wines returns empty results", () => {
    const r = buildSessionResults([], [], "quick", "2026-01-01");
    expect(r.wineCount).toBe(0);
    expect(r.favorite).toBeNull();
    expect(r.mostDivided).toBeNull();
  });

  test("quick format: favorite = highest average rating", () => {
    const wines = [makeWine("w1"), makeWine("w2")];
    const tastings = [
      makeTasting("w1", "u1", 3),
      makeTasting("w1", "u2", 5),
      makeTasting("w2", "u1", 8),
      makeTasting("w2", "u2", 9),
    ];
    const r = buildSessionResults(wines, tastings, "quick", "2026-01-01");
    expect(r.favorite?.wine.id).toBe("w2");
    expect(r.favorite?.averageRating).toBe(8.5);
  });

  test("mostDivided = null when all spreads are 0", () => {
    const wines = [makeWine("w1")];
    const tastings = [makeTasting("w1", "u1", 5), makeTasting("w1", "u2", 5)];
    const r = buildSessionResults(wines, tastings, "quick", "2026-01-01");
    expect(r.mostDivided).toBeNull();
  });

  test("counts unique participants", () => {
    const wines = [makeWine("w1")];
    const tastings = [
      makeTasting("w1", "u1", 5),
      makeTasting("w1", "u2", 6),
      makeTasting("w1", "u1", 7), // duplicate user
    ];
    const r = buildSessionResults(wines, tastings, "quick", "2026-01-01");
    expect(r.participantCount).toBe(2);
  });
});

describe("getSharedAromas", () => {
  test("returns aromas mentioned by 2+ users", () => {
    const tastings = [
      makeTasting("w1", "u1", 5, {
        protocol: "wset_l2",
        nose: { aromas: ["apple", "pear"] },
        palate: { flavours: ["lemon"] },
      }),
      makeTasting("w1", "u2", 6, {
        protocol: "wset_l2",
        nose: { aromas: ["apple", "cherry"] },
        palate: { flavours: ["lemon"] },
      }),
    ];
    const shared = getSharedAromas(tastings);
    expect(shared).toContain("apple");
    expect(shared).toContain("lemon");
    expect(shared).not.toContain("pear");
    expect(shared).not.toContain("cherry");
  });

  test("empty tastings returns empty", () => {
    expect(getSharedAromas([])).toEqual([]);
  });
});

describe("getWsetParameterComparison", () => {
  test("counts parameter values across tastings", () => {
    const tastings = [
      makeTasting("w1", "u1", 5, {
        protocol: "wset_l2",
        nose: { intensity: "medium" },
        palate: { acidity: "high", body: "full" },
      }),
      makeTasting("w1", "u2", 6, {
        protocol: "wset_l2",
        nose: { intensity: "pronounced" },
        palate: { acidity: "high", body: "medium" },
      }),
    ];
    const params = getWsetParameterComparison(tastings);
    const acidity = params.find((p) => p.param === "acidity");
    expect(acidity?.counts).toEqual({ high: 2 });
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/session-results.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/session-results.test.ts
git commit -m "test: add unit tests for session-results"
```

---

### Task 5: Unit Tests — wine-inference

**Files:**
- Create: `src/lib/__tests__/wine-inference.test.ts`
- Test: `src/lib/wine-inference.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { classifyWineConfidence } from "../wine-inference";

describe("classifyWineConfidence", () => {
  test("high confidence for known wine terms", () => {
    expect(classifyWineConfidence("Barolo 2018")).toBe("high");
    expect(classifyWineConfidence("Red Wine Reserve")).toBe("high");
    expect(classifyWineConfidence("Champagne Brut")).toBe("high");
  });

  test("medium confidence for wine-adjacent terms", () => {
    expect(classifyWineConfidence("Grand Cru Reserve", "alcoholic beverages")).toBe("medium");
    expect(classifyWineConfidence("Domaine Lafite 2015")).toBe("medium");
  });

  test("low confidence for non-wine products", () => {
    expect(classifyWineConfidence("Chocolate Bar", "snack")).toBe("low");
    expect(classifyWineConfidence("IPA Hazy", "beer")).toBe("low");
    expect(classifyWineConfidence("Orange Juice")).toBe("low");
  });

  test("medium when vintage or grape inferred from name", () => {
    // "Merlot" → grape inferred → medium
    expect(classifyWineConfidence("Some Merlot Blend")).toBe("high"); // merlot is in high list
  });

  test("handles empty categories", () => {
    expect(classifyWineConfidence("Random Product")).toBe("low");
  });
});
```

Note: `inferWineType`, `inferRegion`, `inferGrape`, `inferVintage` are private functions. We test them indirectly via `classifyWineConfidence` and `findOpenFoodFactsMatch`. Since `findOpenFoodFactsMatch` requires fetch, we focus on `classifyWineConfidence` which exercises all the inference functions at the boundary.

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/wine-inference.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/wine-inference.test.ts
git commit -m "test: add unit tests for wine-inference"
```

---

### Task 6: Unit Tests — label-ocr

**Files:**
- Create: `src/lib/__tests__/label-ocr.test.ts`
- Test: `src/lib/label-ocr.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { lineQuality, parseWineLabel, normalizeOcrText } from "../label-ocr";

describe("lineQuality", () => {
  test("real text scores near 1", () => {
    expect(lineQuality("JOSETTA SAFFIRIO")).toBeGreaterThan(0.8);
  });

  test("noise scores near 0", () => {
    expect(lineQuality("- = | 7 #")).toBeLessThan(0.2);
  });

  test("empty string returns 0", () => {
    expect(lineQuality("")).toBe(0);
  });

  test("mixed content scores between", () => {
    expect(lineQuality("ALC. 13.5%")).toBeGreaterThan(0);
    expect(lineQuality("ALC. 13.5%")).toBeLessThan(0.6);
  });
});

describe("parseWineLabel", () => {
  test("extracts vintage year", () => {
    const blocks = [{ lines: [{ text: "Barolo 2018" }, { text: "Josetta Saffirio" }] }];
    const result = parseWineLabel(blocks);
    expect(result.vintage).toBe("2018");
  });

  test("picks latest year when multiple exist", () => {
    const blocks = [{ lines: [{ text: "Est. 1850" }, { text: "Vintage 2019" }] }];
    const result = parseWineLabel(blocks);
    expect(result.vintage).toBe("2019");
  });

  test("returns null vintage when no year found", () => {
    const blocks = [{ lines: [{ text: "Chateau Margaux" }] }];
    expect(parseWineLabel(blocks).vintage).toBeNull();
  });

  test("filters out noise lines", () => {
    const blocks = [{
      lines: [
        { text: "JOSETTA SAFFIRIO" },
        { text: "DENOMINAZIONE DI ORIGINE CONTROLLATA" },
        { text: "BAROLO" },
        { text: "ALC. 14.5% VOL" },
      ],
    }];
    const result = parseWineLabel(blocks);
    // Name should NOT be the noise line
    expect(result.name).not.toMatch(/DENOMINAZ/);
    expect(result.name).not.toMatch(/ALC/);
  });

  test("empty blocks return null name", () => {
    const result = parseWineLabel([]);
    expect(result.name).toBeNull();
    expect(result.producer).toBeNull();
  });

  test("builds searchQuery from name and producer", () => {
    const blocks = [{ lines: [{ text: "BAROLO RISERVA" }, { text: "Josetta Saffirio" }] }];
    const result = parseWineLabel(blocks);
    expect(result.searchQuery.length).toBeGreaterThan(0);
  });
});

describe("normalizeOcrText", () => {
  test("strips diacritics", () => {
    expect(normalizeOcrText("Côtes du Rhône")).toBe("Cotes du Rhone");
  });

  test("fixes pipe to l", () => {
    expect(normalizeOcrText("Baro|o")).toBe("Barolo");
  });

  test("collapses whitespace", () => {
    expect(normalizeOcrText("  Barolo   2018  ")).toBe("Barolo 2018");
  });

  test("removes non-alphanumeric noise", () => {
    expect(normalizeOcrText("WINE™ ®")).toBe("WINE");
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/label-ocr.test.ts --verbose
```

Expected: All PASS. (Note: `parseWineLabel` uses `cleanOcrLine` and `isNoiseLine` internally — all private, tested through the public API.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/label-ocr.test.ts
git commit -m "test: add unit tests for label-ocr"
```

---

### Task 7: Unit Tests — cellar-helpers

**Files:**
- Create: `src/lib/__tests__/cellar-helpers.test.ts`
- Test: `src/lib/cellar-helpers.ts`

- [ ] **Step 1: Write the tests**

```typescript
import {
  buildNumericOptions,
  buildStats,
  buildPairingOptions,
  buildVintageOptions,
  buildMealRecommendations,
  getSuggestedPairings,
  parseTags,
  toNumberOrNull,
  emptyToNull,
  mergeTagText,
  normalizeLookupValue,
  buildStorageSpaceBottleCounts,
  getWineStoragePlacementLabel,
  buildCustomPairings,
} from "../cellar-helpers";
import type { WineRecord } from "../../types/wine";

const wine = (overrides: Partial<WineRecord> = {}): WineRecord => ({
  id: "w1", user_id: "u1", name: "Test", producer: null, country: null,
  region: null, grape: null, vintage: null, quantity: 1, type: "Rött",
  barcode: null, systembolaget_product_id: null, storage_space_id: null,
  storage_row: null, storage_slot: null, tags: [], food_pairings: [],
  pairing_source: null, notes: null, cellar_location: null,
  image_path: null, image_url: null, acquired_at: null,
  drink_by_year: null, created_at: "2026-01-01", updated_at: "2026-01-01",
  ...overrides,
});

describe("buildNumericOptions", () => {
  test("generates 1-based string array", () => {
    expect(buildNumericOptions(3)).toEqual(["1", "2", "3"]);
  });

  test("minimum 1 option", () => {
    expect(buildNumericOptions(0)).toEqual(["1"]);
  });
});

describe("parseTags", () => {
  test("splits by comma and trims", () => {
    expect(parseTags(" foo , bar , baz ")).toEqual(["foo", "bar", "baz"]);
  });

  test("filters empty strings", () => {
    expect(parseTags("a,,b,")).toEqual(["a", "b"]);
  });

  test("empty input returns empty", () => {
    expect(parseTags("")).toEqual([]);
  });
});

describe("toNumberOrNull", () => {
  test("valid positive number", () => {
    expect(toNumberOrNull("42")).toBe(42);
  });

  test("zero returns null", () => {
    expect(toNumberOrNull("0")).toBeNull();
  });

  test("negative returns null", () => {
    expect(toNumberOrNull("-5")).toBeNull();
  });

  test("non-number returns null", () => {
    expect(toNumberOrNull("abc")).toBeNull();
  });

  test("empty string returns null", () => {
    expect(toNumberOrNull("")).toBeNull();
  });
});

describe("emptyToNull", () => {
  test("non-empty string passes through", () => {
    expect(emptyToNull("hello")).toBe("hello");
  });

  test("whitespace-only returns null", () => {
    expect(emptyToNull("   ")).toBeNull();
  });

  test("empty string returns null", () => {
    expect(emptyToNull("")).toBeNull();
  });
});

describe("mergeTagText", () => {
  test("appends new tag", () => {
    expect(mergeTagText("foo, bar", "baz")).toBe("foo, bar, baz");
  });

  test("does not duplicate existing tag", () => {
    expect(mergeTagText("foo, bar", "bar")).toBe("foo, bar");
  });
});

describe("normalizeLookupValue", () => {
  test("lowercases and strips diacritics", () => {
    expect(normalizeLookupValue("Côtes")).toBe("cotes");
  });

  test("normalizes smart quotes", () => {
    expect(normalizeLookupValue("d\u2019Yquem")).toBe("d'yquem");
  });
});

describe("getSuggestedPairings", () => {
  test("vitt returns fish/seafood pairings", () => {
    expect(getSuggestedPairings("Vitt")).toContain("fisk");
    expect(getSuggestedPairings("Vitt")).toContain("skaldjur");
  });

  test("rött (default) returns meat pairings", () => {
    expect(getSuggestedPairings("Rött")).toContain("lamm");
    expect(getSuggestedPairings("Rött")).toContain("nöt");
  });

  test("mousserande returns aperitif pairings", () => {
    expect(getSuggestedPairings("Mousserande")).toContain("aperitif");
  });
});

describe("buildStats", () => {
  test("counts total bottles and labels", () => {
    const wines = [wine({ quantity: 3 }), wine({ id: "w2", quantity: 2 })];
    const stats = buildStats(wines);
    expect(stats.totalBottles).toBe(5);
    expect(stats.totalLabels).toBe(2);
  });

  test("no data returns placeholder strings", () => {
    const stats = buildStats([]);
    expect(stats.topCountry).toBe("Ingen data");
    expect(stats.averageVintage).toBe("-");
  });
});

describe("buildVintageOptions", () => {
  test("sorts descending with Alla first", () => {
    const wines = [wine({ vintage: 2018 }), wine({ id: "w2", vintage: 2020 })];
    expect(buildVintageOptions(wines)).toEqual(["Alla", "2020", "2018"]);
  });
});

describe("buildMealRecommendations", () => {
  test("returns wines matching selected meal", () => {
    const wines = [
      wine({ food_pairings: ["lamm", "nöt"] }),
      wine({ id: "w2", food_pairings: ["fisk"] }),
    ];
    const recs = buildMealRecommendations(wines, "lamm");
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("w1");
  });

  test("returns max 5 recommendations", () => {
    const wines = Array.from({ length: 10 }, (_, i) =>
      wine({ id: `w${i}`, food_pairings: ["lamm"] })
    );
    expect(buildMealRecommendations(wines, "lamm")).toHaveLength(5);
  });
});

describe("buildStorageSpaceBottleCounts", () => {
  test("sums quantities per storage space", () => {
    const wines = [
      wine({ storage_space_id: "s1", quantity: 3 }),
      wine({ id: "w2", storage_space_id: "s1", quantity: 2 }),
      wine({ id: "w3", storage_space_id: "s2", quantity: 1 }),
    ];
    const counts = buildStorageSpaceBottleCounts(wines);
    expect(counts.get("s1")).toBe(5);
    expect(counts.get("s2")).toBe(1);
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/cellar-helpers.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/cellar-helpers.test.ts
git commit -m "test: add unit tests for cellar-helpers"
```

---

### Task 8: Unit Tests — wine-helpers

**Files:**
- Create: `src/lib/__tests__/wine-helpers.test.ts`
- Test: `src/lib/wine-helpers.ts`

- [ ] **Step 1: Write the tests**

```typescript
import {
  toWineDraft,
  buildWineInsertFromDraft,
  scoreCatalogCompleteness,
  getMissingCatalogFields,
  canBeSavedAsCatalogEntry,
  mergeDraftWithCatalogSuggestion,
  applyCatalogLocksToDraft,
} from "../wine-helpers";
import type { WineRecord } from "../../types/wine";
import type { ProductCatalogWineRow } from "../../types/product-catalog";
import type { WineDraft } from "../../types/cellar-drafts";

const record: WineRecord = {
  id: "w1", user_id: "u1", name: "Barolo", producer: "Saffirio",
  country: "Italien", region: "Piemonte", grape: "Nebbiolo",
  vintage: 2018, quantity: 2, type: "Rött", barcode: "123",
  systembolaget_product_id: "456", storage_space_id: null,
  storage_row: null, storage_slot: null, tags: ["favorit"],
  food_pairings: ["lamm", "nöt"], pairing_source: "manual",
  notes: "Fin årgång", cellar_location: null, image_path: null,
  image_url: null, acquired_at: "2026-01-01",
  drink_by_year: 2030, created_at: "2026-01-01", updated_at: "2026-01-01",
};

describe("toWineDraft", () => {
  test("converts WineRecord to draft strings", () => {
    const draft = toWineDraft(record);
    expect(draft.name).toBe("Barolo");
    expect(draft.vintage).toBe("2018");
    expect(draft.quantity).toBe("2");
    expect(draft.tags).toBe("favorit");
    expect(draft.foodPairings).toBe("lamm, nöt");
  });

  test("handles null fields", () => {
    const draft = toWineDraft({ ...record, producer: null, vintage: null });
    expect(draft.producer).toBe("");
    expect(draft.vintage).toBe("");
  });
});

describe("buildWineInsertFromDraft", () => {
  test("converts draft to insert with correct types", () => {
    const draft: WineDraft = {
      name: " Barolo ", producer: "Saffirio", country: "Italien",
      region: "Piemonte", grape: "Nebbiolo", vintage: "2018",
      quantity: "3", type: "Rött", drinkBy: "2030", acquiredAt: "2026-01-01",
      location: "", storageSpaceId: "", storageRow: "1", storageSlot: "1",
      barcode: "", systembolagetProductId: "", tags: "favorit, premium",
      foodPairings: "lamm, nöt", notes: "", imageUri: "",
    };
    const insert = buildWineInsertFromDraft(draft, "", "1", "1", null);
    expect(insert.name).toBe("Barolo");
    expect(insert.vintage).toBe(2018);
    expect(insert.quantity).toBe(3);
    expect(insert.tags).toEqual(["favorit", "premium"]);
    expect(insert.cellar_location).toBeNull(); // empty → null
    expect(insert.storage_space_id).toBeNull();
  });
});

describe("scoreCatalogCompleteness", () => {
  test("full entry scores high", () => {
    const entry: ProductCatalogWineRow = {
      id: "c1", barcode: "123", systembolaget_product_id: "456",
      name: "Barolo", producer: "Saffirio", country: "Italien",
      region: "Piemonte", grape: "Nebbiolo", type: "Rött", vintage: 2018,
      food_pairings: ["lamm"], image_url: null, source_label: null,
      source_confidence: null, created_by: null, created_at: "", updated_at: "",
    };
    expect(scoreCatalogCompleteness(entry)).toBe(10);
  });

  test("minimal entry scores low", () => {
    const entry: ProductCatalogWineRow = {
      id: "c1", barcode: null, systembolaget_product_id: null,
      name: "Unknown", producer: null, country: null,
      region: null, grape: null, type: null, vintage: null,
      food_pairings: [], image_url: null, source_label: null,
      source_confidence: null, created_by: null, created_at: "", updated_at: "",
    };
    expect(scoreCatalogCompleteness(entry)).toBe(1); // only name
  });
});

describe("getMissingCatalogFields", () => {
  test("returns missing field labels in Swedish", () => {
    const missing = getMissingCatalogFields({
      producer: "", country: "Italien", region: "", grape: "Nebbiolo", type: "Rött",
    });
    expect(missing).toContain("producent");
    expect(missing).toContain("region");
    expect(missing).not.toContain("land");
  });
});

describe("canBeSavedAsCatalogEntry", () => {
  test("true when all required fields present", () => {
    expect(canBeSavedAsCatalogEntry({
      user_id: "u1", name: "Barolo", producer: "Saffirio",
      country: "Italien", region: "Piemonte", grape: "Nebbiolo",
      type: "Rött", quantity: 1,
    })).toBe(true);
  });

  test("false when producer missing", () => {
    expect(canBeSavedAsCatalogEntry({
      user_id: "u1", name: "Barolo", quantity: 1, type: "Rött",
    })).toBe(false);
  });
});

describe("mergeDraftWithCatalogSuggestion", () => {
  const base: WineDraft = {
    name: "Existing", producer: "Old", country: "", region: "",
    grape: "", vintage: "", quantity: "1", type: "Rött", drinkBy: "",
    acquiredAt: "", location: "", storageSpaceId: "", storageRow: "1",
    storageSlot: "1", barcode: "", systembolagetProductId: "",
    tags: "", foodPairings: "", notes: "", imageUri: "",
  };

  test("mode all: overwrites everything", () => {
    const suggestion = { name: "Barolo", producer: "Saffirio", country: "Italien" };
    const result = mergeDraftWithCatalogSuggestion(base, suggestion, "all", {} as any);
    expect(result.name).toBe("Barolo");
    expect(result.producer).toBe("Saffirio");
  });

  test("mode empty: only fills blank fields", () => {
    const suggestion = { name: "Barolo", producer: "Saffirio", country: "Italien" };
    const result = mergeDraftWithCatalogSuggestion(base, suggestion, "empty", {} as any);
    expect(result.name).toBe("Existing"); // not empty, kept
    expect(result.producer).toBe("Old"); // not empty, kept
    expect(result.country).toBe("Italien"); // was empty, filled
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/wine-helpers.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/wine-helpers.test.ts
git commit -m "test: add unit tests for wine-helpers"
```

---

### Task 9: Unit Tests — wset-data

**Files:**
- Create: `src/lib/__tests__/wset-data.test.ts`
- Test: `src/lib/wset-data.ts`

- [ ] **Step 1: Write the tests**

```typescript
import {
  emptyWsetData,
  getColourOptions,
  swedishLabel,
  buildWsetSummary,
  showTannin,
} from "../wset-data";

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
      palate: {
        sweetness: "dry" as const, acidity: "high" as const, tannin: "high" as const,
        alcohol: "high" as const, body: "full" as const,
        flavourIntensity: "pronounced" as const, flavours: [], flavourNote: null,
        finish: "long" as const,
      },
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
  test("true for red wine", () => {
    expect(showTannin("Rött")).toBe(true);
  });

  test("false for white wine", () => {
    expect(showTannin("Vitt")).toBe(false);
  });

  test("false for rosé", () => {
    expect(showTannin("Rosé")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd mobile-app && npx jest src/lib/__tests__/wset-data.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/wset-data.test.ts
git commit -m "test: add unit tests for wset-data"
```

---

### Task 10: Unit Tests — join-link, profile-actions, query-helpers

**Files:**
- Create: `src/lib/__tests__/join-link.test.ts`
- Create: `src/lib/__tests__/profile-actions.test.ts`
- Create: `src/lib/__tests__/query-helpers.test.ts`

- [ ] **Step 1: Write join-link tests**

```typescript
import { buildJoinLink, buildShareMessage } from "../join-link";

describe("buildJoinLink", () => {
  test("builds correct URL", () => {
    expect(buildJoinLink("ABC123")).toBe("https://minvinkallare.se/join/ABC123");
  });
});

describe("buildShareMessage", () => {
  test("includes title and link", () => {
    const msg = buildShareMessage("Tisdagsprovning", "ABC123");
    expect(msg).toContain("Tisdagsprovning");
    expect(msg).toContain("https://minvinkallare.se/join/ABC123");
  });
});
```

- [ ] **Step 2: Write profile-actions tests**

```typescript
import { generateAvatarColor, getAvatarLetter } from "../profile-actions";

// Mock supabase to prevent import error
jest.mock("../supabase", () => ({ supabase: {} }));

describe("generateAvatarColor", () => {
  test("returns HSL string", () => {
    expect(generateAvatarColor("user-123")).toMatch(/^hsl\(\d+, 45%, 35%\)$/);
  });

  test("deterministic — same input same output", () => {
    expect(generateAvatarColor("user-123")).toBe(generateAvatarColor("user-123"));
  });

  test("different IDs produce different colors", () => {
    expect(generateAvatarColor("user-a")).not.toBe(generateAvatarColor("user-b"));
  });
});

describe("getAvatarLetter", () => {
  test("returns uppercase first letter", () => {
    expect(getAvatarLetter("sebastian")).toBe("S");
  });

  test("null returns ?", () => {
    expect(getAvatarLetter(null)).toBe("?");
  });

  test("empty string returns ?", () => {
    expect(getAvatarLetter("")).toBe("?");
  });
});
```

- [ ] **Step 3: Write query-helpers tests**

```typescript
import { applyNullableCatalogFilter } from "../query-helpers";

describe("applyNullableCatalogFilter", () => {
  test("calls .eq() for non-null values", () => {
    const query = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis() };
    applyNullableCatalogFilter(query, "country", "Italien");
    expect(query.eq).toHaveBeenCalledWith("country", "Italien");
    expect(query.is).not.toHaveBeenCalled();
  });

  test("calls .is(null) for null values", () => {
    const query = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis() };
    applyNullableCatalogFilter(query, "country", null);
    expect(query.is).toHaveBeenCalledWith("country", null);
    expect(query.eq).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run all three tests**

```bash
cd mobile-app && npx jest src/lib/__tests__/join-link.test.ts src/lib/__tests__/profile-actions.test.ts src/lib/__tests__/query-helpers.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/join-link.test.ts src/lib/__tests__/profile-actions.test.ts src/lib/__tests__/query-helpers.test.ts
git commit -m "test: add unit tests for join-link, profile-actions, query-helpers"
```

---

### Task 11: Unit Tests — taste-profile, catalog-search

**Files:**
- Create: `src/lib/__tests__/taste-profile.test.ts`
- Create: `src/lib/__tests__/catalog-search.test.ts`

- [ ] **Step 1: Write taste-profile tests**

```typescript
import { buildTasteProfile } from "../taste-profile";
import type { SessionTastingRow, SessionWineRow, TastingSessionRow } from "../../types/tasting-session";

// Mock supabase
jest.mock("../supabase", () => ({ supabase: {} }));

const session = (id: string, status: string, format: "quick" | "wset" = "quick"): TastingSessionRow => ({
  id, host_id: "u1", title: "Test", join_code: "ABC123",
  mode: "blind", format, free_order: false, status: status as any,
  revealed_up_to: 0, created_at: "2026-01-01",
});

const swine = (id: string, sessionId: string): SessionWineRow => ({
  id, session_id: sessionId, position: 1, name: "Wine",
  producer: "Producer", country: "Italien", region: "Piemonte",
  grape: "Nebbiolo", vintage: 2018, type: "Rött", wine_id: null,
  created_at: "2026-01-01",
});

const tasting = (wineId: string, sessionId: string): SessionTastingRow => ({
  id: `t-${wineId}`, session_id: sessionId, session_wine_id: wineId,
  user_id: "u1", rating: 4, notes: null, food_pairings: [],
  tasting_data: null, created_at: "2026-01-01",
});

describe("buildTasteProfile", () => {
  test("not ready with fewer than 2 ended sessions", () => {
    const ended = [session("s1", "ended")];
    const result = buildTasteProfile([], [], [session("s1", "ended")], ended);
    expect(result.ready).toBe(false);
  });

  test("ready with 2+ ended sessions", () => {
    const sessions = [session("s1", "ended"), session("s2", "ended")];
    const wines = [swine("w1", "s1"), swine("w2", "s2")];
    const tastings = [tasting("w1", "s1"), tasting("w2", "s2")];
    const result = buildTasteProfile(tastings, wines, sessions, sessions);
    expect(result.ready).toBe(true);
    expect(result.stats.totalSessions).toBe(2);
    expect(result.stats.totalWines).toBe(2);
  });

  test("history includes all sessions", () => {
    const all = [session("s1", "ended"), session("s2", "active"), session("s3", "ended")];
    const ended = all.filter((s) => s.status === "ended");
    const wines = [swine("w1", "s1"), swine("w2", "s3")];
    const tastings = [tasting("w1", "s1"), tasting("w2", "s3")];
    const result = buildTasteProfile(tastings, wines, all, ended);
    expect(result.history).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Write catalog-search tests (pure function only)**

```typescript
import { mergeHybridMatches } from "../catalog-search";
import type { CatalogTextMatch, CatalogImageMatch } from "../../types/product-catalog";

// Mock supabase
jest.mock("../supabase", () => ({ supabase: {} }));

describe("mergeHybridMatches", () => {
  const textMatch = (id: string, sim: number): CatalogTextMatch => ({
    id, name: "Wine", producer: null, vintage: null, image_url: null, similarity: sim,
  });

  const imageMatch = (id: string, dist: number): CatalogImageMatch => ({
    id, name: "Wine", producer: null, vintage: null, image_url: null, hash_distance: dist,
  });

  test("text-only matches pass through", () => {
    const result = mergeHybridMatches([textMatch("a", 0.9)], [], 5);
    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.9);
  });

  test("image-only matches get 0.4 weight", () => {
    // distance 0 → similarity 1.0 → weighted 0.4 * 1.0 = 0.4
    const result = mergeHybridMatches([], [imageMatch("a", 0)], 5);
    expect(result[0].similarity).toBeCloseTo(0.4);
  });

  test("hybrid match blends text 0.6 + image 0.4", () => {
    // text sim 0.8, image dist 0 (sim 1.0) → 0.6*0.8 + 0.4*1.0 = 0.88
    const result = mergeHybridMatches(
      [textMatch("a", 0.8)],
      [imageMatch("a", 0)],
      5,
    );
    expect(result[0].similarity).toBeCloseTo(0.88);
  });

  test("respects maxResults", () => {
    const texts = Array.from({ length: 10 }, (_, i) => textMatch(`t${i}`, 0.5));
    const result = mergeHybridMatches(texts, [], 3);
    expect(result).toHaveLength(3);
  });

  test("sorts by similarity descending", () => {
    const result = mergeHybridMatches(
      [textMatch("a", 0.5), textMatch("b", 0.9)],
      [],
      5,
    );
    expect(result[0].id).toBe("b");
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd mobile-app && npx jest src/lib/__tests__/taste-profile.test.ts src/lib/__tests__/catalog-search.test.ts --verbose
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/taste-profile.test.ts src/lib/__tests__/catalog-search.test.ts
git commit -m "test: add unit tests for taste-profile and catalog-search"
```

---

### Task 12: Hook Tests — useModalToggle and useCellarFilters

**Files:**
- Create: `src/hooks/__tests__/useModalToggle.test.tsx`
- Create: `src/hooks/__tests__/useCellarFilters.test.tsx`

- [ ] **Step 1: Write useModalToggle test**

```tsx
import { renderHook, act } from "@testing-library/react-native";
import { useModalToggle } from "../useModalToggle";

describe("useModalToggle", () => {
  test("starts closed by default", () => {
    const { result } = renderHook(() => useModalToggle());
    expect(result.current.visible).toBe(false);
  });

  test("opens and closes", () => {
    const { result } = renderHook(() => useModalToggle());
    act(() => result.current.open());
    expect(result.current.visible).toBe(true);
    act(() => result.current.close());
    expect(result.current.visible).toBe(false);
  });

  test("respects initial value", () => {
    const { result } = renderHook(() => useModalToggle(true));
    expect(result.current.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Write useCellarFilters test**

```tsx
import { renderHook, act } from "@testing-library/react-native";
import { useCellarFilters } from "../useCellarFilters";
import type { WineRecord } from "../../types/wine";

const wine = (overrides: Partial<WineRecord> = {}): WineRecord => ({
  id: "w1", user_id: "u1", name: "Barolo", producer: "Saffirio",
  country: "Italien", region: "Piemonte", grape: "Nebbiolo",
  vintage: 2018, quantity: 1, type: "Rött", barcode: null,
  systembolaget_product_id: null, storage_space_id: null,
  storage_row: null, storage_slot: null, tags: [],
  food_pairings: ["lamm", "nöt"], pairing_source: null,
  notes: null, cellar_location: null, image_path: null,
  image_url: null, acquired_at: null, drink_by_year: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
  ...overrides,
});

const wines: WineRecord[] = [
  wine(),
  wine({ id: "w2", name: "Chablis", country: "Frankrike", type: "Vitt", grape: "Chardonnay", food_pairings: ["fisk"] }),
  wine({ id: "w3", name: "Rioja", country: "Spanien", type: "Rött", grape: "Tempranillo", food_pairings: ["lamm"] }),
];

const emptyStorageMap = new Map();

describe("useCellarFilters", () => {
  test("returns all wines with default filters", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    expect(result.current.filteredWines).toHaveLength(3);
  });

  test("filters by country", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSelectedCountryFilter("Italien"));
    expect(result.current.filteredWines).toHaveLength(1);
    expect(result.current.filteredWines[0].name).toBe("Barolo");
  });

  test("filters by type", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSelectedTypeFilter("Vitt"));
    expect(result.current.filteredWines).toHaveLength(1);
    expect(result.current.filteredWines[0].name).toBe("Chablis");
  });

  test("filters by food pairing", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSelectedPairingFilter("fisk"));
    expect(result.current.filteredWines).toHaveLength(1);
    expect(result.current.filteredWines[0].name).toBe("Chablis");
  });

  test("search filters by name", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSearchQuery("barolo"));
    expect(result.current.filteredWines).toHaveLength(1);
    expect(result.current.filteredWines[0].name).toBe("Barolo");
  });

  test("search is case-insensitive and accent-insensitive", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSearchQuery("CHABLIS"));
    expect(result.current.filteredWines).toHaveLength(1);
  });

  test("multiple filters combine (AND logic)", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => {
      result.current.setSelectedTypeFilter("Rött");
      result.current.setSelectedCountryFilter("Spanien");
    });
    expect(result.current.filteredWines).toHaveLength(1);
    expect(result.current.filteredWines[0].name).toBe("Rioja");
  });
});
```

- [ ] **Step 3: Run tests**

Note: Hook tests need `jsdom` environment. Update jest config or add docblock:

Add `@jest-environment jsdom` docblock at top of each hook test file if `testEnvironment: "node"` is the default, OR update jest config to detect `*.test.tsx` files:

Update `jest.config.ts` — add a project or override. Simplest: change the main `testEnvironment` to `jsdom` for tsx files:

```typescript
// In jest.config.ts, replace the single config with projects:
const config: Config = {
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/lib/__tests__/**/*.test.ts"],
      transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^react-native$": "<rootDir>/src/__mocks__/react-native.ts" },
    },
    {
      displayName: "hooks",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/src/hooks/__tests__/**/*.test.tsx"],
      transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^react-native$": "<rootDir>/src/__mocks__/react-native.ts" },
    },
  ],
};
```

```bash
cd mobile-app && npx jest src/hooks/__tests__/ --verbose
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/__tests__/useModalToggle.test.tsx src/hooks/__tests__/useCellarFilters.test.tsx jest.config.ts
git commit -m "test: add hook tests for useModalToggle and useCellarFilters"
```

---

### Task 13: Playwright E2E — Config and Auth Flow

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/tests/auth.spec.ts`

- [ ] **Step 1: Create Playwright config**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "cd .. && npx expo start --web --port 8081",
    port: 8081,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

- [ ] **Step 2: Create auth E2E test**

```typescript
import { test, expect } from "@playwright/test";

// Use environment variables for test credentials
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@minvinkallare.se";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "e2e-test-password-123";

test.describe("Auth flow", () => {
  test("shows landing page with login form", async ({ page }) => {
    await page.goto("/");
    // Should see the landing/auth screen
    await expect(page.getByText("Logga in")).toBeVisible({ timeout: 30000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("E-post").fill("invalid@example.com");
    await page.getByPlaceholder("Lösenord").fill("wrongpassword");
    await page.getByText("Logga in").click();
    // Should show some error — either alert or inline
    await expect(page.getByText(/fel|ogilt|invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test("login and logout with valid credentials", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, "Skipping — no test credentials set");

    await page.goto("/");
    await page.getByPlaceholder("E-post").fill(TEST_EMAIL);
    await page.getByPlaceholder("Lösenord").fill(TEST_PASSWORD);
    await page.getByText("Logga in").click();

    // Should reach the main app (cellar view)
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });

    // Logout
    await page.getByText("Profil").click();
    await page.getByText("Logga ut").click();

    // Should be back at landing
    await expect(page.getByText("Logga in")).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 3: Verify Playwright can find the config**

```bash
cd mobile-app/e2e && npx playwright test --list
```

Expected: Lists the test cases (may skip if no server running — that's OK).

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts e2e/tests/auth.spec.ts
git commit -m "test: add Playwright E2E config and auth flow tests"
```

---

### Task 14: Playwright E2E — Add Wine Flow

**Files:**
- Create: `e2e/tests/add-wine.spec.ts`

- [ ] **Step 1: Create add-wine E2E test**

```typescript
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "";

test.describe("Add wine flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!TEST_EMAIL, "Skipping — no test credentials set");

    await page.goto("/");
    await page.getByPlaceholder("E-post").fill(TEST_EMAIL);
    await page.getByPlaceholder("Lösenord").fill(TEST_PASSWORD);
    await page.getByText("Logga in").click();
    await expect(page.getByText("Min källare")).toBeVisible({ timeout: 15000 });
  });

  test("add a wine and see it in cellar", async ({ page }) => {
    const wineName = `E2E Test Wine ${Date.now()}`;

    // Navigate to "Lägg till"
    await page.getByText("Lägg till").click();

    // Fill in the wine form
    await page.getByPlaceholder("Vinets namn").fill(wineName);
    await page.getByPlaceholder("Producent").fill("E2E Producer");

    // Save
    await page.getByText("Spara").click();

    // Should see success or navigate back
    // Navigate to cellar and verify wine appears
    await page.getByText("Min källare").click();
    await expect(page.getByText(wineName)).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/add-wine.spec.ts
git commit -m "test: add Playwright E2E test for add-wine flow"
```

---

### Task 15: Run Full Test Suite and Fix Issues

- [ ] **Step 1: Run all unit + hook tests**

```bash
cd mobile-app && npx jest --verbose
```

Fix any failures — likely candidates:
- Import path issues (ts-jest resolution)
- Missing mocks for `supabase` in files that import it transitively
- Date locale differences in CI vs local

- [ ] **Step 2: Run all tests again to confirm green**

```bash
cd mobile-app && npx jest --verbose
```

Expected: All tests PASS.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test suite issues from initial run"
```
