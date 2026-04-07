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
  });
  test("search filters by name", () => {
    const { result } = renderHook(() => useCellarFilters(wines, emptyStorageMap));
    act(() => result.current.setSearchQuery("barolo"));
    expect(result.current.filteredWines).toHaveLength(1);
  });
  test("search is case-insensitive", () => {
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
