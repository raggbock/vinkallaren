import { reorderSessionWines, batchAddWinesToSession, createSession } from "../session-actions";
import { supabase } from "../supabase";
import type { CreateSessionInput, TastingSessionRow, SessionWineRow } from "../../types/tasting-session";

// --- Mocks ---

jest.mock("../join-link", () => ({
  shareSession: jest.fn(),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("../supabase", () => {
  return {
    supabase: {
      from: jest.fn(),
      rpc: jest.fn(),
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

// --- Factories ---

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["insert", "update", "select", "upsert", "eq", "order", "single"];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

function makeSessionInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return { title: "Test session", mode: "blind", format: "quick", free_order: false, ...overrides };
}

function makeSessionRow(overrides: Partial<TastingSessionRow> = {}): TastingSessionRow {
  return {
    id: "sess-1",
    host_id: "user-1",
    title: "Test session",
    join_code: "ABCDEF",
    mode: "blind",
    format: "quick",
    free_order: false,
    status: "setup",
    revealed_up_to: 0,
    created_at: "2026-04-10T00:00:00Z",
    ...overrides,
  };
}

function makeWineInput(overrides: Partial<{ name: string; producer: string | null; vintage: number | null; wine_id: string | null }> = {}) {
  return { name: "Barolo", producer: "Conterno", vintage: 2019, wine_id: null, ...overrides };
}

function makeWineRow(overrides: Partial<SessionWineRow> = {}): SessionWineRow {
  return {
    id: "wine-1",
    session_id: "sess-1",
    position: 1,
    name: "Barolo",
    producer: "Conterno",
    country: null,
    region: null,
    grape: null,
    vintage: 2019,
    type: null,
    wine_id: null,
    created_at: "2026-04-10T00:00:00Z",
    ...overrides,
  };
}

// --- reorderSessionWines ---

describe("reorderSessionWines", () => {
  it("calls update with 1-indexed positions for each wine", async () => {
    const makeArgChain = () => {
      const c: Record<string, jest.Mock> = { update: jest.fn(), eq: jest.fn() };
      c.update.mockReturnValue(c);
      c.eq.mockReturnValueOnce(c).mockResolvedValue({ error: null });
      return c;
    };
    const chains = ["w1", "w2", "w3"].map(() => makeArgChain());
    let callIdx = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() => chains[callIdx++]);

    await reorderSessionWines("sess-1", ["w1", "w2", "w3"]);

    expect(chains[0].update).toHaveBeenCalledWith({ position: 1 });
    expect(chains[0].eq).toHaveBeenCalledWith("id", "w1");
    expect(chains[1].update).toHaveBeenCalledWith({ position: 2 });
    expect(chains[2].update).toHaveBeenCalledWith({ position: 3 });
  });

  it("filters by session_id on each update", async () => {
    const makeArgChain = () => {
      const c: Record<string, jest.Mock> = { update: jest.fn(), eq: jest.fn() };
      c.update.mockReturnValue(c);
      c.eq.mockReturnValueOnce(c).mockResolvedValue({ error: null });
      return c;
    };
    const chains = ["w1", "w2"].map(() => makeArgChain());
    let callIdx = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() => chains[callIdx++]);

    await reorderSessionWines("sess-1", ["w1", "w2"]);

    expect(chains[0].eq).toHaveBeenCalledWith("session_id", "sess-1");
    expect(chains[1].eq).toHaveBeenCalledWith("session_id", "sess-1");
  });

  it("returns ok(true) when all updates succeed", async () => {
    // each from() call gets its own chain; second eq() resolves as a promise
    const makeOkChain = () => {
      const c: Record<string, jest.Mock> = { update: jest.fn(), eq: jest.fn() };
      c.update.mockReturnValue(c);
      c.eq.mockReturnValueOnce(c).mockResolvedValue({ error: null });
      return c;
    };
    (mockSupabase.from as jest.Mock).mockImplementation(() => makeOkChain());

    const result = await reorderSessionWines("sess-1", ["w1", "w2"]);

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });

  it("returns fail when any update errors", async () => {
    const makeOkChain = () => {
      const c: Record<string, jest.Mock> = { update: jest.fn(), eq: jest.fn() };
      c.update.mockReturnValue(c);
      c.eq.mockReturnValueOnce(c).mockResolvedValue({ error: null });
      return c;
    };
    const makeErrChain = () => {
      const c: Record<string, jest.Mock> = { update: jest.fn(), eq: jest.fn() };
      c.update.mockReturnValue(c);
      c.eq.mockReturnValueOnce(c).mockResolvedValue({ error: { message: "DB error" } });
      return c;
    };

    let call = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() =>
      call++ === 0 ? makeOkChain() : makeErrChain(),
    );

    const result = await reorderSessionWines("sess-1", ["w1", "w2"]);

    expect(result.error).toBe("DB error");
    expect(result.data).toBeNull();
  });

  it("returns ok(true) for empty wineIds array", async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(makeChain());

    const result = await reorderSessionWines("sess-1", []);

    expect(result.data).toBe(true);
    expect(result.error).toBeNull();
  });
});

// --- batchAddWinesToSession ---

describe("batchAddWinesToSession", () => {
  it("builds rows with sequential positions from startPosition", async () => {
    const wines = [makeWineInput({ name: "A" }), makeWineInput({ name: "B" }), makeWineInput({ name: "C" })];
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: [], error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    await batchAddWinesToSession("sess-1", 3, wines);

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: "A", position: 3 }),
      expect.objectContaining({ name: "B", position: 4 }),
      expect.objectContaining({ name: "C", position: 5 }),
    ]);
  });

  it("includes session_id in every row", async () => {
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: [], error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    await batchAddWinesToSession("sess-42", 1, [makeWineInput()]);

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ session_id: "sess-42" }),
    ]);
  });

  it("returns ok with data on success", async () => {
    const rows = [makeWineRow()];
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: rows, error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await batchAddWinesToSession("sess-1", 1, [makeWineInput()]);

    expect(result.data).toEqual(rows);
    expect(result.error).toBeNull();
  });

  it("returns fail on insert error", async () => {
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: null, error: { message: "constraint violation" } });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await batchAddWinesToSession("sess-1", 1, [makeWineInput()]);

    expect(result.error).toBe("constraint violation");
    expect(result.data).toBeNull();
  });

  it("handles single wine with correct position", async () => {
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: [makeWineRow()], error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    await batchAddWinesToSession("sess-1", 7, [makeWineInput({ name: "Solo" })]);

    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Solo", position: 7 }),
    ]);
  });

  it("offsets positions correctly for multiple wines", async () => {
    const chain = makeChain();
    chain.select = jest.fn().mockResolvedValue({ data: [], error: null });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const wines = [makeWineInput({ name: "X" }), makeWineInput({ name: "Y" })];
    await batchAddWinesToSession("sess-1", 10, wines);

    const [inserted] = (chain.insert as jest.Mock).mock.calls[0];
    expect(inserted[0].position).toBe(10);
    expect(inserted[1].position).toBe(11);
  });
});

// --- createSession ---

describe("createSession", () => {
  const userId = "user-1";
  const input = makeSessionInput();

  it("returns session data and auto-joins host as participant on success", async () => {
    const sessionRow = makeSessionRow();
    const sessionChain = makeChain();
    sessionChain.single = jest.fn().mockResolvedValue({ data: sessionRow, error: null });
    sessionChain.select = jest.fn().mockReturnValue(sessionChain);

    const participantChain = makeChain();
    participantChain.insert = jest.fn().mockResolvedValue({ data: null, error: null });

    let call = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() => (call++ === 0 ? sessionChain : participantChain));

    const result = await createSession(userId, input);

    expect(result.data).toEqual(sessionRow);
    expect(result.error).toBeNull();
    expect(participantChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: sessionRow.id, user_id: userId }),
    );
  });

  it("retries on join code collision (error code 23505)", async () => {
    const collisionError = { code: "23505", message: "unique constraint" };
    const sessionRow = makeSessionRow();

    const collisionChain = makeChain();
    collisionChain.single = jest.fn().mockResolvedValue({ data: null, error: collisionError });
    collisionChain.select = jest.fn().mockReturnValue(collisionChain);

    const successChain = makeChain();
    successChain.single = jest.fn().mockResolvedValue({ data: sessionRow, error: null });
    successChain.select = jest.fn().mockReturnValue(successChain);

    const participantChain = makeChain();
    participantChain.insert = jest.fn().mockResolvedValue({ data: null, error: null });

    let sessionCall = 0;
    (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === "tasting_sessions") return sessionCall++ === 0 ? collisionChain : successChain;
      return participantChain;
    });

    const result = await createSession(userId, input);

    expect(result.data).toEqual(sessionRow);
    expect(collisionChain.single).toHaveBeenCalledTimes(1);
    expect(successChain.single).toHaveBeenCalledTimes(1);
  });

  it("returns fail on non-collision error", async () => {
    const chain = makeChain();
    chain.single = jest.fn().mockResolvedValue({ data: null, error: { code: "42P01", message: "table not found" } });
    chain.select = jest.fn().mockReturnValue(chain);
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createSession(userId, input);

    expect(result.error).toBe("table not found");
    expect(result.data).toBeNull();
    expect(chain.single).toHaveBeenCalledTimes(1);
  });

  it("returns fail after 3 failed collision attempts", async () => {
    const collisionError = { code: "23505", message: "unique constraint" };
    const chain = makeChain();
    chain.single = jest.fn().mockResolvedValue({ data: null, error: collisionError });
    chain.select = jest.fn().mockReturnValue(chain);
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await createSession(userId, input);

    expect(result.error).toBe("Försök igen.");
    expect(result.data).toBeNull();
    expect(chain.single).toHaveBeenCalledTimes(3);
  });
});
