jest.mock("../supabase", () => ({ supabase: {} }));

import { generateAvatarColor, getAvatarLetter } from "../profile-actions";

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
