import { hammingDistance, hashSimilarity, computeDHashFromPixels } from "../image-hash";

describe("hammingDistance", () => {
  test("identical hashes return 0", () => {
    expect(hammingDistance("abcdef0123456789", "abcdef0123456789")).toBe(0);
  });
  test("completely different hashes return 64", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });
  test("single hex digit difference", () => {
    expect(hammingDistance("0000000000000000", "1000000000000000")).toBe(1);
  });
  test("different length hashes return 64", () => {
    expect(hammingDistance("abcd", "abcdef")).toBe(64);
  });
});

describe("hashSimilarity", () => {
  test("identical hashes return 1", () => {
    expect(hashSimilarity("abcdef0123456789", "abcdef0123456789")).toBe(1);
  });
  test("opposite hashes return 0", () => {
    expect(hashSimilarity("0000000000000000", "ffffffffffffffff")).toBe(0);
  });
});

describe("computeDHashFromPixels", () => {
  test("uniform pixels produce all-zero hash", () => {
    const pixels = new Array(100 * 100).fill(128);
    const hash = computeDHashFromPixels(pixels, 100, 100);
    expect(hash).toBe("0000000000000000");
  });
  test("produces 16-char hex string", () => {
    const pixels = Array.from({ length: 100 * 100 }, (_, i) => i % 256);
    const hash = computeDHashFromPixels(pixels, 100, 100);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
  test("different images produce different hashes", () => {
    const a = Array.from({ length: 100 * 100 }, (_, i) => i % 256);
    const b = Array.from({ length: 100 * 100 }, (_, i) => (255 - i) % 256);
    expect(computeDHashFromPixels(a, 100, 100)).not.toBe(computeDHashFromPixels(b, 100, 100));
  });
});
