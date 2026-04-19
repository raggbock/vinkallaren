import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useCellarSpaceWines } from "../useCellarSpaceWines";

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockGt = jest.fn();
const mockOrder = jest.fn();
const mockOr = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    storage: { from: () => ({ createSignedUrls: jest.fn().mockResolvedValue({ data: [] }) }) },
  },
}));
jest.mock("../../lib/wine-helpers", () => ({
  hydrateWineRecords: (rows: any[]) => Promise.resolve(rows),
}));
jest.mock("../../lib/show-error", () => ({ showError: jest.fn() }));

function setupQueryChain(rows: any[]) {
  const terminal = Promise.resolve({ data: rows, error: null });
  mockOrder.mockReturnValue(terminal);
  mockOr.mockReturnValue({ order: mockOrder });
  mockIs.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
  mockEq.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
  mockGt.mockReturnValue({ order: mockOrder, or: mockOr, eq: mockEq, is: mockIs });
  mockSelect.mockReturnValue({ eq: mockEq, is: mockIs, gt: mockGt, order: mockOrder });
  mockFrom.mockReturnValue({ select: mockSelect });
}

const wineRow = (id: string, spaceId: string | null = "sp-1") => ({
  id, user_id: "u1", name: "Barolo", storage_space_id: spaceId,
  quantity: 1, type: "Rött", food_pairings: [], tags: [],
  producer: null, country: null, region: null, grape: null, vintage: null,
  storage_row: null, storage_slot: null, barcode: null,
  systembolaget_product_id: null, pairing_source: null, notes: null,
  cellar_location: null, image_path: null, acquired_at: null, drink_by_year: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
});

describe("useCellarSpaceWines", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("returns loaded=false with empty wines for a never-requested space", () => {
    setupQueryChain([]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    const s = result.current.getSpaceWines("sp-1");
    expect(s.loaded).toBe(false);
    expect(s.wines).toEqual([]);
  });

  test("requestSpace triggers fetch; getSpaceWines returns results after load", async () => {
    setupQueryChain([wineRow("w1"), wineRow("w2")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    expect(result.current.getSpaceWines("sp-1").wines).toHaveLength(2);
  });

  test("second requestSpace on same cacheKey does NOT refetch", async () => {
    setupQueryChain([wineRow("w1")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    const callsAfterFirst = mockFrom.mock.calls.length;
    act(() => { result.current.requestSpace("sp-1"); });
    expect(mockFrom.mock.calls.length).toBe(callsAfterFirst);
  });

  test("filter change clears cache; next requestSpace refetches", async () => {
    setupQueryChain([wineRow("w1")]);
    const { result, rerender } = renderHook(
      ({ f }: { f: Record<string, string> }) => useCellarSpaceWines(f, ""),
      { initialProps: { f: {} } }
    );
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    rerender({ f: { type: "Rött" } });
    const before = mockFrom.mock.calls.length;
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(mockFrom.mock.calls.length).toBeGreaterThan(before));
  });

  test("invalidateSpace clears only that space", async () => {
    setupQueryChain([wineRow("w1", "sp-1")]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    setupQueryChain([wineRow("w2", "sp-2")]);
    act(() => { result.current.requestSpace("sp-2"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-2").loaded).toBe(true));
    act(() => { result.current.invalidateSpace("sp-1"); });
    expect(result.current.getSpaceWines("sp-1").loaded).toBe(false);
    expect(result.current.getSpaceWines("sp-2").loaded).toBe(true);
  });

  test("__unplaced__ triggers an `.is('storage_space_id', null)` query", async () => {
    setupQueryChain([wineRow("w1", null)]);
    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("__unplaced__"); });
    await waitFor(() => expect(result.current.getSpaceWines("__unplaced__").loaded).toBe(true));
    expect(mockIs).toHaveBeenCalledWith("storage_space_id", null);
  });

  test("fetch error sets loaded=true, empty wines, calls showError", async () => {
    const { showError } = require("../../lib/show-error");
    mockOrder.mockReturnValue(Promise.resolve({ data: null, error: { message: "DB error" } }));
    mockOr.mockReturnValue({ order: mockOrder });
    mockIs.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
    mockEq.mockReturnValue({ gt: mockGt, order: mockOrder, or: mockOr });
    mockGt.mockReturnValue({ order: mockOrder, or: mockOr, eq: mockEq, is: mockIs });
    mockSelect.mockReturnValue({ eq: mockEq, is: mockIs, gt: mockGt, order: mockOrder });
    mockFrom.mockReturnValue({ select: mockSelect });

    const { result } = renderHook(() => useCellarSpaceWines({}, ""));
    act(() => { result.current.requestSpace("sp-1"); });
    await waitFor(() => expect(result.current.getSpaceWines("sp-1").loaded).toBe(true));
    expect(result.current.getSpaceWines("sp-1").wines).toEqual([]);
    expect(showError).toHaveBeenCalledWith("Kunde inte hämta viner", "DB error");
  });
});
