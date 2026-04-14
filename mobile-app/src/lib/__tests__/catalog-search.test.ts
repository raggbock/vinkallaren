import { supabase } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("../../components/form-controls", () => ({}));

import { mergeHybridMatches, searchCatalogWineNames } from "../catalog-search";
import type { CatalogTextMatch, CatalogImageMatch } from "../../types/product-catalog";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// --- mergeHybridMatches ---

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
    const result = mergeHybridMatches([], [imageMatch("a", 0)], 5);
    expect(result[0].similarity).toBeCloseTo(0.4);
  });

  test("hybrid match blends text 0.6 + image 0.4", () => {
    const result = mergeHybridMatches([textMatch("a", 0.8)], [imageMatch("a", 0)], 5);
    expect(result[0].similarity).toBeCloseTo(0.88);
  });

  test("respects maxResults", () => {
    const texts = Array.from({ length: 10 }, (_, i) => textMatch(`t${i}`, 0.5));
    expect(mergeHybridMatches(texts, [], 3)).toHaveLength(3);
  });

  test("sorts by similarity descending", () => {
    const result = mergeHybridMatches([textMatch("a", 0.5), textMatch("b", 0.9)], [], 5);
    expect(result[0].id).toBe("b");
  });
});

// --- searchCatalogWineNames ---

describe("searchCatalogWineNames", () => {
  beforeEach(() => jest.clearAllMocks());

  function makeRow(name: string, producer: string | null = null) {
    return { id: `id-${name}`, name, producer, vintage: null, image_url: null, score: 0.9 };
  }

  test("returns empty result without calling rpc for short queries", async () => {
    const result = await searchCatalogWineNames("ab");

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(result.suggestions).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  test("passes offset to rpc as result_offset", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

    await searchCatalogWineNames("barolo", 40);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "autocomplete_catalog",
      expect.objectContaining({ result_offset: 40 }),
    );
  });

  test("returns hasMore=true when results exceed page size", async () => {
    // Page size is 20; return 21 rows to trigger hasMore
    const rows = Array.from({ length: 21 }, (_, i) => makeRow(`Wine ${i}`));
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: rows, error: null });

    const result = await searchCatalogWineNames("barolo");

    expect(result.hasMore).toBe(true);
    expect(result.suggestions).toHaveLength(20);
  });

  test("returns hasMore=false when results are within page size", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`Wine ${i}`));
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: rows, error: null });

    const result = await searchCatalogWineNames("barolo");

    expect(result.hasMore).toBe(false);
    expect(result.suggestions).toHaveLength(5);
  });

  test("returns empty result on rpc error", async () => {
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: "DB error" } });

    const result = await searchCatalogWineNames("barolo");

    expect(result.suggestions).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  test("maps producer to parentName in suggestions", async () => {
    const rows = [makeRow("Barolo", "Conterno")];
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: rows, error: null });

    const result = await searchCatalogWineNames("barolo");

    expect(result.suggestions[0]).toEqual({ name: "Barolo", parentName: "Conterno" });
  });

  test("nextOffset advances by number of returned results", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`Wine ${i}`));
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: rows, error: null });

    const result = await searchCatalogWineNames("barolo", 20);

    expect(result.nextOffset).toBe(25);
  });
});
