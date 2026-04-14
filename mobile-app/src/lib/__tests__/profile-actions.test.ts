import { supabase } from "../supabase";

jest.mock("../supabase", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import {
  generateAvatarColor,
  getAvatarLetter,
  lookupByCellarCode,
  updateVisibility,
} from "../profile-actions";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ["select", "update", "eq", "single"];
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  Object.assign(chain, overrides);
  return chain;
}

// --- generateAvatarColor ---

describe("generateAvatarColor", () => {
  test("returns HSL string", () => {
    expect(generateAvatarColor("user-123")).toMatch(/^hsl\(\d+, 45%, 35%\)$/);
  });
  test("deterministic", () => {
    expect(generateAvatarColor("user-123")).toBe(generateAvatarColor("user-123"));
  });
  test("different IDs produce different colors", () => {
    expect(generateAvatarColor("user-a")).not.toBe(generateAvatarColor("user-b"));
  });
});

// --- getAvatarLetter ---

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

// --- lookupByCellarCode ---

describe("lookupByCellarCode", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns null for non-existent code", async () => {
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: null, error: { message: "No rows found" } }),
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await lookupByCellarCode("ZZZZZZ");

    expect(result).toBeNull();
  });

  test("uppercases and trims input before querying", async () => {
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: null, error: { message: "No rows found" } }),
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    await lookupByCellarCode("  abc123  ");

    expect(chain.eq).toHaveBeenCalledWith("cellar_code", "ABC123");
  });

  test("returns profile row on success", async () => {
    const profile = { id: "user-1", cellar_code: "XYZ999", is_public: true };
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: profile, error: null }),
    });
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    const result = await lookupByCellarCode("xyz999");

    expect(result).toEqual(profile);
  });
});

// --- updateVisibility ---

describe("updateVisibility", () => {
  beforeEach(() => jest.clearAllMocks());

  test("turning off is_public also sets show_wines and show_taste_profile to false", async () => {
    const updatedProfile = {
      id: "user-1",
      is_public: false,
      show_wines: false,
      show_taste_profile: false,
    };
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: updatedProfile, error: null }),
    });
    chain.select = jest.fn().mockReturnValue(chain);
    (mockSupabase.from as jest.Mock).mockReturnValue(chain);

    await updateVisibility("user-1", { is_public: false });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: false,
        show_wines: false,
        show_taste_profile: false,
      }),
    );
  });

  test("turning on is_public with no existing cellar_code generates one", async () => {
    const existingProfile = { cellar_code: null };
    const generatedCode = "NEWCODE";
    const updatedProfile = { id: "user-1", is_public: true, cellar_code: generatedCode };

    // First from() call: fetch current profile to check cellar_code
    const fetchChain = makeChain({
      single: jest.fn().mockResolvedValue({ data: existingProfile, error: null }),
    });

    // Second from() call: update profile
    const updateChain = makeChain({
      single: jest.fn().mockResolvedValue({ data: updatedProfile, error: null }),
    });
    updateChain.select = jest.fn().mockReturnValue(updateChain);

    let call = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() =>
      call++ === 0 ? fetchChain : updateChain,
    );
    (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: generatedCode, error: null });

    await updateVisibility("user-1", { is_public: true });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("generate_cellar_code");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ cellar_code: generatedCode }),
    );
  });

  test("turning on is_public with existing cellar_code does not regenerate", async () => {
    const existingProfile = { cellar_code: "EXISTING" };
    const updatedProfile = { id: "user-1", is_public: true, cellar_code: "EXISTING" };

    const fetchChain = makeChain({
      single: jest.fn().mockResolvedValue({ data: existingProfile, error: null }),
    });

    const updateChain = makeChain({
      single: jest.fn().mockResolvedValue({ data: updatedProfile, error: null }),
    });
    updateChain.select = jest.fn().mockReturnValue(updateChain);

    let call = 0;
    (mockSupabase.from as jest.Mock).mockImplementation(() =>
      call++ === 0 ? fetchChain : updateChain,
    );

    await updateVisibility("user-1", { is_public: true });

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_public: true }),
    );
    expect(updateChain.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ cellar_code: expect.anything() }),
    );
  });
});
