import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useWines } from "../useWines";
import { useHistory } from "../useHistory";
import type { WineRecord } from "../../types/wine";
import type { WineHistoryRecord } from "../../types/wine-history";

// --- Mock setup ---

const mockSelect = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockRange = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock("../../lib/supabase", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    storage: { from: () => ({ remove: jest.fn().mockResolvedValue({}) }) },
  },
}));

jest.mock("../../lib/wine-helpers", () => ({
  hydrateWineRecords: (rows: any[]) => Promise.resolve(rows),
  hydrateWineHistoryRecords: (rows: any[]) => Promise.resolve(rows),
}));

jest.mock("../../lib/show-error", () => ({ showError: jest.fn() }));

jest.mock("../../lib/cellar-helpers", () => ({
  buildStats: (wines: any[]) => ({ totalBottles: wines.length }),
  buildPairingOptions: () => [],
  buildStorageSpaceBottleCounts: () => new Map(),
  buildValueOptions: () => [],
  buildVintageOptions: () => [],
}));

// --- Factories ---

const wine = (overrides: Partial<WineRecord> = {}): WineRecord => ({
  id: "w1", user_id: "u1", name: "Barolo", producer: "Saffirio",
  country: "Italien", region: "Piemonte", grape: "Nebbiolo",
  vintage: 2018, quantity: 1, type: "Rött", barcode: null,
  systembolaget_product_id: null, storage_space_id: null,
  storage_row: null, storage_slot: null, tags: [],
  food_pairings: ["lamm"], pairing_source: null,
  notes: null, cellar_location: null, image_path: null,
  image_url: null, acquired_at: null, drink_by_year: null,
  created_at: "2026-01-01", updated_at: "2026-01-01",
  ...overrides,
});

const historyEntry = (overrides: Partial<WineHistoryRecord> = {}): WineHistoryRecord => ({
  id: "h1", user_id: "u1", wine_id: "w1", name: "Barolo",
  producer: null, country: "Italien", region: null, grape: null,
  vintage: 2018, type: "Rött", barcode: null,
  systembolaget_product_id: null, storage_space_id: null,
  storage_row: null, storage_slot: null, cellar_location: null,
  image_path: null, image_url: null,
  quantity_consumed: 1, rating: 4, tasting_notes: null,
  tasting_data: null, consumed_at: "2026-01-01", created_at: "2026-01-01",
  ...overrides,
});

function setupChain(data: any[], error: any = null) {
  mockLimit.mockResolvedValue({ data, error });
  mockRange.mockResolvedValue({ data, error });
  mockOrder.mockReturnValue({ limit: mockLimit, range: mockRange });
  mockSelect.mockReturnValue({ order: mockOrder });
  mockDelete.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });
}

// --- useWines ---

describe("useWines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupChain([]);
  });

  test("initializes with empty wines and loading=true", () => {
    mockLimit.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useWines());
    expect(result.current.wines).toHaveLength(0);
    expect(result.current.loading).toBe(true);
  });

  test("after fetch: sets wines and loading=false", async () => {
    setupChain([wine(), wine({ id: "w2", name: "Chablis" })]);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.wines).toHaveLength(2);
  });

  test("hasMoreWines is true when exactly 50 results returned", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => wine({ id: `w${i}` }));
    setupChain(fifty);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMoreWines).toBe(true);
  });

  test("hasMoreWines is false when fewer than 50 results returned", async () => {
    setupChain([wine()]);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMoreWines).toBe(false);
  });

  test("deleteWine removes wine from local state", async () => {
    setupChain([wine({ id: "w1" }), wine({ id: "w2", name: "Chablis" })]);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.deleteWine("w1"); });
    expect(result.current.wines.find((w) => w.id === "w1")).toBeUndefined();
    expect(result.current.wines).toHaveLength(1);
  });

  test("stats reflect loaded wines", async () => {
    setupChain([wine(), wine({ id: "w2" })]);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual({ totalBottles: 2 });
  });

  test("pairingOptions derived from wines", async () => {
    setupChain([wine()]);
    const { result } = renderHook(() => useWines());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(Array.isArray(result.current.pairingOptions)).toBe(true);
  });
});

// --- useHistory ---

describe("useHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupChain([]);
  });

  test("initializes with empty entries and loadingHistory=true", () => {
    mockLimit.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHistory());
    expect(result.current.historyEntries).toHaveLength(0);
    expect(result.current.loadingHistory).toBe(true);
  });

  test("after fetch: sets entries and loadingHistory=false", async () => {
    setupChain([historyEntry(), historyEntry({ id: "h2" })]);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));
    expect(result.current.historyEntries).toHaveLength(2);
  });

  test("hasMoreHistory is true when exactly 50 results returned", async () => {
    const fifty = Array.from({ length: 50 }, (_, i) => historyEntry({ id: `h${i}` }));
    setupChain(fifty);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));
    expect(result.current.hasMoreHistory).toBe(true);
  });

  test("hasMoreHistory is false when fewer than 50 results returned", async () => {
    setupChain([historyEntry()]);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));
    expect(result.current.hasMoreHistory).toBe(false);
  });

  test("fetchMoreHistory appends to existing entries", async () => {
    setupChain([historyEntry()]);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loadingHistory).toBe(false));

    // Force hasMoreHistory=true so fetchMoreHistory actually runs
    act(() => { result.current.setHistoryEntries(
      Array.from({ length: 50 }, (_, i) => historyEntry({ id: `h${i}` }))
    ); });
    // Patch hasMoreHistory via internal state — re-trigger with 50-item page
    const fifty = Array.from({ length: 50 }, (_, i) => historyEntry({ id: `h${i}` }));
    setupChain(fifty);
    const { result: result2 } = renderHook(() => useHistory());
    await waitFor(() => expect(result2.current.loadingHistory).toBe(false));

    setupChain([historyEntry({ id: "h_extra" })]);
    await act(async () => { await result2.current.fetchMoreHistory(); });
    // hasMoreHistory was true (50 loaded), fetchMoreHistory should have been called
    // Since the second page returns 1 item, entries grow by 1
    expect(result2.current.historyEntries.length).toBe(51);
  });
});
