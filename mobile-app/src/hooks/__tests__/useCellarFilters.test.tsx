import { renderHook, act } from "@testing-library/react-native";
import { useCellarFilters } from "../useCellarFilters";

describe("useCellarFilters", () => {
  test("filterState is empty object when all set to Alla", () => {
    const { result } = renderHook(() => useCellarFilters());
    expect(result.current.filterState).toEqual({});
  });

  test("selecting a country adds it to filterState", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSelectedCountryFilter("Italien"); });
    expect(result.current.filterState).toEqual({ country: "Italien" });
  });

  test("selecting a storage space id adds storage_space_id key", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSelectedStorageSpaceFilterId("sp-1"); });
    expect(result.current.filterState).toEqual({ storage_space_id: "sp-1" });
  });

  test("resetFilters clears all state", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => {
      result.current.setSelectedCountryFilter("Italien");
      result.current.setSearchQuery("barolo");
    });
    act(() => { result.current.resetFilters(); });
    expect(result.current.filterState).toEqual({});
    expect(result.current.searchQuery).toBe("");
  });

  test("searchQuery is independent of filterState", () => {
    const { result } = renderHook(() => useCellarFilters());
    act(() => { result.current.setSearchQuery("hello"); });
    expect(result.current.searchQuery).toBe("hello");
    expect(result.current.filterState).toEqual({});
  });
});
