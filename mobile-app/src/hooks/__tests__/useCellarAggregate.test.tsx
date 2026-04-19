import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useCellarAggregate } from "../useCellarAggregate";
import { EMPTY_AGGREGATE } from "../../types/cellar-aggregate";

const mockRpc = jest.fn();
jest.mock("../../lib/supabase", () => ({
  supabase: { rpc: (...args: any[]) => mockRpc(...args) },
}));
jest.mock("../../lib/show-error", () => ({ showError: jest.fn() }));

const samplePayload = {
  stats: { totalBottles: 7, totalLabels: 5, averageVintage: "2018",
           topCountry: "Italien (4)", topType: "Rött (5)", topPairing: "lamm (2)" },
  bottleCountsBySpaceId: { "sp-1": 4, "sp-2": 3 },
  unplacedCount: 0,
  filterOptions: {
    countries: ["Italien", "Frankrike"], regions: ["Piemonte"], types: ["Rött"],
    vintages: ["2018", "2015"], grapes: ["Nebbiolo"], pairings: ["lamm"],
  },
};

describe("useCellarAggregate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("starts with EMPTY_AGGREGATE and loading=true", () => {
    mockRpc.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    expect(result.current.aggregate).toEqual(EMPTY_AGGREGATE);
    expect(result.current.loading).toBe(true);
  });

  test("calls RPC with filters and search on mount", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    renderHook(() => useCellarAggregate({ type: "Rött" }, "barolo"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenCalledWith("get_cellar_overview", {
      p_filters: { type: "Rött" },
      p_search: "barolo",
    });
  });

  test("sets aggregate from RPC response", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.aggregate.stats.totalBottles).toBe(7);
    expect(result.current.aggregate.bottleCountsBySpaceId["sp-1"]).toBe(4);
  });

  test("refetches when filters change", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result, rerender } = renderHook(
      ({ f, s }: { f: Record<string, string>; s: string }) => useCellarAggregate(f, s),
      { initialProps: { f: {}, s: "" } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    rerender({ f: { type: "Rött" }, s: "" });
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2));
  });

  test("passes null p_search when search is empty/whitespace", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    renderHook(() => useCellarAggregate({}, "   "));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockRpc).toHaveBeenLastCalledWith("get_cellar_overview", {
      p_filters: {}, p_search: null,
    });
  });

  test("refresh() triggers re-fetch", async () => {
    mockRpc.mockResolvedValue({ data: samplePayload, error: null });
    const { result } = renderHook(() => useCellarAggregate({}, ""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refresh(); });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
