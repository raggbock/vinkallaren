jest.mock("../supabase", () => ({ supabase: {} }));

import { classifyWineConfidence } from "../wine-inference";

describe("classifyWineConfidence", () => {
  test("high confidence for known wine terms", () => {
    expect(classifyWineConfidence("Barolo 2018")).toBe("high");
    expect(classifyWineConfidence("Red Wine Reserve")).toBe("high");
    expect(classifyWineConfidence("Champagne Brut")).toBe("high");
  });

  test("medium confidence for wine-adjacent terms", () => {
    expect(classifyWineConfidence("Grand Cru Reserve", "alcoholic beverages")).toBe("medium");
    expect(classifyWineConfidence("Domaine Lafite 2015")).toBe("medium");
  });

  test("low confidence for non-wine products", () => {
    expect(classifyWineConfidence("Chocolate Bar", "snack")).toBe("low");
    expect(classifyWineConfidence("IPA Hazy", "beer")).toBe("low");
    expect(classifyWineConfidence("Orange Juice")).toBe("low");
  });

  test("handles empty categories", () => {
    expect(classifyWineConfidence("Random Product")).toBe("low");
  });
});
