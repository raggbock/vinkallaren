jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

import { buildJoinLink, buildShareMessage } from "../join-link";

describe("buildJoinLink", () => {
  test("builds correct URL", () => {
    expect(buildJoinLink("ABC123")).toBe("https://minvinkallare.se/join/ABC123");
  });
});

describe("buildShareMessage", () => {
  test("includes title and link", () => {
    const msg = buildShareMessage("Tisdagsprovning", "ABC123");
    expect(msg).toContain("Tisdagsprovning");
    expect(msg).toContain("https://minvinkallare.se/join/ABC123");
  });
});
