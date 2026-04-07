import { lineQuality, parseWineLabel, normalizeOcrText } from "../label-ocr";

describe("lineQuality", () => {
  test("real text scores near 1", () => {
    expect(lineQuality("JOSETTA SAFFIRIO")).toBeGreaterThan(0.8);
  });
  test("noise scores near 0", () => {
    expect(lineQuality("- = | 7 #")).toBeLessThan(0.2);
  });
  test("empty string returns 0", () => {
    expect(lineQuality("")).toBe(0);
  });
  test("mixed content scores between", () => {
    expect(lineQuality("ALC. 13.5%")).toBeGreaterThan(0);
    expect(lineQuality("ALC. 13.5%")).toBeLessThan(0.6);
  });
});

describe("parseWineLabel", () => {
  test("extracts vintage year", () => {
    const blocks = [{ lines: [{ text: "Barolo 2018" }, { text: "Josetta Saffirio" }] }];
    const result = parseWineLabel(blocks);
    expect(result.vintage).toBe("2018");
  });
  test("picks latest year when multiple exist", () => {
    const blocks = [{ lines: [{ text: "Est. 1850" }, { text: "Vintage 2019" }] }];
    const result = parseWineLabel(blocks);
    expect(result.vintage).toBe("2019");
  });
  test("returns null vintage when no year found", () => {
    const blocks = [{ lines: [{ text: "Chateau Margaux" }] }];
    expect(parseWineLabel(blocks).vintage).toBeNull();
  });
  test("filters out noise lines", () => {
    const blocks = [{
      lines: [
        { text: "JOSETTA SAFFIRIO" },
        { text: "DENOMINAZIONE DI ORIGINE CONTROLLATA" },
        { text: "BAROLO" },
        { text: "ALC. 14.5% VOL" },
      ],
    }];
    const result = parseWineLabel(blocks);
    expect(result.name).not.toMatch(/DENOMINAZ/);
    expect(result.name).not.toMatch(/ALC/);
  });
  test("empty blocks return null name", () => {
    const result = parseWineLabel([]);
    expect(result.name).toBeNull();
    expect(result.producer).toBeNull();
  });
  test("builds searchQuery from name and producer", () => {
    const blocks = [{ lines: [{ text: "BAROLO RISERVA" }, { text: "Josetta Saffirio" }] }];
    const result = parseWineLabel(blocks);
    expect(result.searchQuery.length).toBeGreaterThan(0);
  });
});

describe("normalizeOcrText", () => {
  test("strips diacritics", () => {
    expect(normalizeOcrText("Côtes du Rhône")).toBe("Cotes du Rhone");
  });
  test("fixes pipe to l", () => {
    expect(normalizeOcrText("Baro|o")).toBe("Barolo");
  });
  test("collapses whitespace", () => {
    expect(normalizeOcrText("  Barolo   2018  ")).toBe("Barolo 2018");
  });
  test("removes non-alphanumeric noise", () => {
    expect(normalizeOcrText("WINE™ ®")).toBe("WINE");
  });
});
