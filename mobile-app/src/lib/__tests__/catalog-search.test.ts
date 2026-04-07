jest.mock("../supabase", () => ({ supabase: {} }));
jest.mock("../../components/form-controls", () => ({}));

import { mergeHybridMatches } from "../catalog-search";
import type { CatalogTextMatch, CatalogImageMatch } from "../../types/product-catalog";

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
