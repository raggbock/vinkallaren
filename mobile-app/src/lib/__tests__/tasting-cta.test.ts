import { resolveResultsCta } from "../tasting-cta";

describe("resolveResultsCta", () => {
  test("host sees no CTA (already converted)", () => {
    expect(resolveResultsCta({ isAnonymous: false, isHost: true })).toBeNull();
    expect(resolveResultsCta({ isAnonymous: true, isHost: true })).toBeNull();
  });

  test("anonymous participant is prompted to create an account", () => {
    expect(resolveResultsCta({ isAnonymous: true, isHost: false })).toBe("create-account");
  });

  test("logged-in participant is prompted to host their own", () => {
    expect(resolveResultsCta({ isAnonymous: false, isHost: false })).toBe("start-own");
  });
});
