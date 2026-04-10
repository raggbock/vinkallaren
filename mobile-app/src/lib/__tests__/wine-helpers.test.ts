jest.mock("../supabase", () => ({ supabase: {} }));
jest.mock("expo-image-manipulator", () => ({}));

import {
  toWineDraft,
  buildWineInsertFromDraft,
  scoreCatalogCompleteness,
  getMissingCatalogFields,
  canBeSavedAsCatalogEntry,
  mergeDraftWithCatalogSuggestion,
  applyCatalogLocksToDraft,
  buildCatalogBackfillPayload,
} from "../wine-helpers";
import type { WineRecord } from "../../types/wine";
import type { ProductCatalogWineRow } from "../../types/product-catalog";
import type { WineDraft } from "../../types/cellar-drafts";
import type { ProductCatalogEntry } from "../../lib/product-catalog";

const baseRecord: WineRecord = {
  id: "1",
  user_id: "u1",
  name: "Barolo",
  producer: "Rocche",
  country: "Italien",
  region: "Piemonte",
  grape: "Nebbiolo",
  vintage: 2018,
  quantity: 3,
  type: "Rött",
  barcode: "123456",
  systembolaget_product_id: "7202301",
  storage_space_id: "s1",
  storage_row: 2,
  storage_slot: 4,
  tags: ["favorit", "present"],
  food_pairings: ["lamm", "nöt"],
  pairing_source: "manual",
  notes: "Utmärkt",
  cellar_location: "Källare",
  image_path: null,
  image_url: "https://example.com/image.jpg",
  acquired_at: "2023-01-15",
  drink_by_year: 2030,
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
};

const baseDraft: WineDraft = {
  name: "Barolo",
  producer: "Rocche",
  country: "Italien",
  region: "Piemonte",
  grape: "Nebbiolo",
  vintage: "2018",
  quantity: "3",
  type: "Rött",
  drinkBy: "2030",
  acquiredAt: "2023-01-15",
  location: "Källare",
  storageSpaceId: "s1",
  storageRow: "2",
  storageSlot: "4",
  barcode: "123456",
  systembolagetProductId: "7202301",
  tags: "favorit, present",
  foodPairings: "lamm, nöt",
  notes: "Utmärkt",
  imageUri: "",
};

const baseCatalogRow: ProductCatalogWineRow = {
  id: "c1",
  barcode: "123456",
  systembolaget_product_id: "7202301",
  name: "Barolo",
  producer: "Rocche",
  country: "Italien",
  region: "Piemonte",
  grape: "Nebbiolo",
  type: "Rött",
  vintage: 2018,
  food_pairings: ["lamm", "nöt"],
  image_url: null,
  source_label: "Systembolaget",
  source_confidence: "high",
  created_by: "u1",
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2023-01-01T00:00:00Z",
};

// ---- toWineDraft ----

describe("toWineDraft", () => {
  test("converts record fields to strings", () => {
    const draft = toWineDraft(baseRecord);
    expect(draft.name).toBe("Barolo");
    expect(draft.producer).toBe("Rocche");
    expect(draft.vintage).toBe("2018");
    expect(draft.quantity).toBe("3");
    expect(draft.drinkBy).toBe("2030");
    expect(draft.storageRow).toBe("2");
    expect(draft.storageSlot).toBe("4");
    expect(draft.tags).toBe("favorit, present");
    expect(draft.foodPairings).toBe("lamm, nöt");
    expect(draft.imageUri).toBe("https://example.com/image.jpg");
  });

  test("handles null fields with empty strings or defaults", () => {
    const minimal: WineRecord = {
      ...baseRecord,
      producer: null,
      country: null,
      region: null,
      grape: null,
      vintage: null,
      drink_by_year: null,
      acquired_at: null,
      cellar_location: null,
      storage_space_id: null,
      storage_row: null,
      storage_slot: null,
      barcode: null,
      systembolaget_product_id: null,
      notes: null,
      image_url: null,
      tags: [],
      food_pairings: [],
    };
    const draft = toWineDraft(minimal);
    expect(draft.producer).toBe("");
    expect(draft.country).toBe("");
    expect(draft.vintage).toBe("");
    expect(draft.drinkBy).toBe("");
    expect(draft.tags).toBe("");
    expect(draft.foodPairings).toBe("");
    expect(draft.imageUri).toBe("");
    // storage_row/slot null → default "1"
    expect(draft.storageRow).toBe("1");
    expect(draft.storageSlot).toBe("1");
  });
});

// ---- buildWineInsertFromDraft ----

describe("buildWineInsertFromDraft", () => {
  test("trims name and converts vintage to number", () => {
    const result = buildWineInsertFromDraft(baseDraft, "s1", "2", "4", null);
    expect(result.name).toBe("Barolo");
    expect(result.vintage).toBe(2018);
    expect(result.quantity).toBe(3);
    expect(result.storage_space_id).toBe("s1");
    expect(result.storage_row).toBe(2);
    expect(result.storage_slot).toBe(4);
  });

  test("converts empty strings to null", () => {
    const emptyDraft: WineDraft = {
      ...baseDraft,
      producer: "",
      country: "",
      vintage: "",
      barcode: "",
      notes: "",
    };
    const result = buildWineInsertFromDraft(emptyDraft, "", "1", "1", null);
    expect(result.producer).toBeNull();
    expect(result.country).toBeNull();
    expect(result.vintage).toBeNull();
    expect(result.barcode).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.storage_space_id).toBeNull();
    expect(result.storage_row).toBeNull();
    expect(result.storage_slot).toBeNull();
  });

  test("parses tags from comma-separated string", () => {
    const result = buildWineInsertFromDraft(baseDraft, "s1", "1", "1", null);
    expect(result.tags).toEqual(["favorit", "present"]);
    expect(result.food_pairings).toEqual(["lamm", "nöt"]);
  });

  test("sets pairing_source to manual", () => {
    const result = buildWineInsertFromDraft(baseDraft, "s1", "1", "1", null);
    expect(result.pairing_source).toBe("manual");
  });
});

// ---- scoreCatalogCompleteness ----

describe("scoreCatalogCompleteness", () => {
  test("full entry scores 10", () => {
    expect(scoreCatalogCompleteness(baseCatalogRow)).toBe(10);
  });

  test("minimal entry with only name scores 1", () => {
    const minimal: ProductCatalogWineRow = {
      ...baseCatalogRow,
      barcode: null,
      systembolaget_product_id: null,
      producer: null,
      country: null,
      region: null,
      grape: null,
      type: null,
      vintage: null,
      food_pairings: [],
    };
    expect(scoreCatalogCompleteness(minimal)).toBe(1);
  });

  test("partial entry scores correctly", () => {
    const partial: ProductCatalogWineRow = {
      ...baseCatalogRow,
      barcode: null,
      systembolaget_product_id: null,
      vintage: null,
      food_pairings: [],
    };
    // name, producer, country, region, grape, type = 6
    expect(scoreCatalogCompleteness(partial)).toBe(6);
  });
});

// ---- getMissingCatalogFields ----

describe("getMissingCatalogFields", () => {
  test("returns empty array when all fields present", () => {
    const source = { producer: "Rocche", country: "Italien", region: "Piemonte", grape: "Nebbiolo", type: "Rött" };
    expect(getMissingCatalogFields(source)).toEqual([]);
  });

  test("returns Swedish label names for missing fields", () => {
    const source = { producer: "", country: "", region: "", grape: "", type: "" };
    const missing = getMissingCatalogFields(source);
    expect(missing).toContain("producent");
    expect(missing).toContain("land");
    expect(missing).toContain("region");
    expect(missing).toContain("druva");
    expect(missing).toContain("vintyp");
  });

  test("returns only missing fields", () => {
    const source = { producer: "Rocche", country: "", region: "Piemonte", grape: "", type: "Rött" };
    const missing = getMissingCatalogFields(source);
    expect(missing).toEqual(["land", "druva"]);
  });
});

// ---- canBeSavedAsCatalogEntry ----

describe("canBeSavedAsCatalogEntry", () => {
  const complete = {
    user_id: "u1",
    name: "Barolo",
    producer: "Rocche",
    country: "Italien",
    region: "Piemonte",
    grape: "Nebbiolo",
    type: "Rött",
    quantity: 1,
  };

  test("returns true when all required fields present", () => {
    expect(canBeSavedAsCatalogEntry(complete)).toBe(true);
  });

  test("returns false when producer is missing", () => {
    expect(canBeSavedAsCatalogEntry({ ...complete, producer: undefined })).toBe(false);
  });

  test("returns false when country is missing", () => {
    expect(canBeSavedAsCatalogEntry({ ...complete, country: undefined })).toBe(false);
  });

  test("returns false when name is empty", () => {
    expect(canBeSavedAsCatalogEntry({ ...complete, name: "  " })).toBe(false);
  });
});

// ---- mergeDraftWithCatalogSuggestion ----

describe("mergeDraftWithCatalogSuggestion", () => {
  const suggestion: ProductCatalogEntry = {
    name: "Chablis",
    producer: "Louis Michel",
    country: "Frankrike",
    region: "Chablis",
    grape: "Chardonnay",
    type: "Vitt",
    vintage: 2022,
    foodPairings: ["fisk", "skaldjur"],
    barcode: "7310400223455",
    systembolagetProductId: "558801",
  };

  const emptySelection = {
    name: false,
    producer: false,
    country: false,
    region: false,
    vintage: false,
    grape: false,
    type: false,
    foodPairings: false,
    systembolagetProductId: false,
    barcode: false,
  };

  test("mode 'all' overwrites all current fields", () => {
    const result = mergeDraftWithCatalogSuggestion(baseDraft, suggestion, "all", emptySelection);
    expect(result.name).toBe("Chablis");
    expect(result.producer).toBe("Louis Michel");
    expect(result.country).toBe("Frankrike");
    expect(result.grape).toBe("Chardonnay");
    expect(result.vintage).toBe("2022");
    expect(result.foodPairings).toBe("fisk, skaldjur");
  });

  test("mode 'empty' only fills blank fields", () => {
    const partialDraft: WineDraft = {
      ...baseDraft,
      producer: "",
      country: "",
      grape: "",
    };
    const result = mergeDraftWithCatalogSuggestion(partialDraft, suggestion, "empty", emptySelection);
    // blanks get filled
    expect(result.producer).toBe("Louis Michel");
    expect(result.country).toBe("Frankrike");
    expect(result.grape).toBe("Chardonnay");
    // non-blank stays
    expect(result.name).toBe("Barolo");
    expect(result.region).toBe("Piemonte");
  });

  test("mode 'custom' applies only selected fields", () => {
    const selection = { ...emptySelection, producer: true, grape: true };
    const result = mergeDraftWithCatalogSuggestion(baseDraft, suggestion, "custom", selection);
    expect(result.producer).toBe("Louis Michel");
    expect(result.grape).toBe("Chardonnay");
    // not selected
    expect(result.name).toBe("Barolo");
    expect(result.country).toBe("Italien");
  });
});

// ---- applyCatalogLocksToDraft ----

describe("applyCatalogLocksToDraft", () => {
  test("without catalog entry, applies patch as-is", () => {
    const result = applyCatalogLocksToDraft(baseDraft, { notes: "ny notering" } as Partial<WineDraft>, null);
    expect(result.notes).toBe("ny notering");
    expect(result.name).toBe("Barolo");
  });

  test("with catalog entry, locks catalog fields regardless of patch", () => {
    const patch: Partial<WineDraft> = { producer: "Annan producent", country: "Spanien" };
    const result = applyCatalogLocksToDraft(baseDraft, patch, baseCatalogRow);
    // catalog locks producer and country back to catalog values
    expect(result.producer).toBe("Rocche");
    expect(result.country).toBe("Italien");
  });

  test("with catalog entry, does not override name when not in patch", () => {
    const patch: Partial<WineDraft> = { notes: "test" };
    const result = applyCatalogLocksToDraft(baseDraft, patch, baseCatalogRow);
    expect(result.name).toBe("Barolo");
  });

  test("with catalog entry, locks vintage as string", () => {
    const result = applyCatalogLocksToDraft(baseDraft, {}, baseCatalogRow);
    expect(result.vintage).toBe("2018");
  });
});

// ---- canBeSavedAsCatalogEntry (WineRecord path) ----

describe("canBeSavedAsCatalogEntry – edge cases", () => {
  test("returns true for a complete WineRecord", () => {
    expect(canBeSavedAsCatalogEntry(baseRecord)).toBe(true);
  });

  test("returns false when name is whitespace-only", () => {
    expect(canBeSavedAsCatalogEntry({ ...baseRecord, name: "   " })).toBe(false);
  });

  test("returns false when region is null", () => {
    expect(canBeSavedAsCatalogEntry({ ...baseRecord, region: null })).toBe(false);
  });

  test("returns false when grape is empty string", () => {
    expect(canBeSavedAsCatalogEntry({ ...baseRecord, grape: "" })).toBe(false);
  });

  test("returns false when type is whitespace-only", () => {
    expect(canBeSavedAsCatalogEntry({ ...baseRecord, type: "  " })).toBe(false);
  });

  test("returns true even without barcode or systembolaget_product_id", () => {
    expect(canBeSavedAsCatalogEntry({ ...baseRecord, barcode: null, systembolaget_product_id: null })).toBe(true);
  });
});

// ---- buildCatalogBackfillPayload ----

describe("buildCatalogBackfillPayload", () => {
  test("maps all wine fields correctly", () => {
    const [item] = buildCatalogBackfillPayload([baseRecord], "u1");
    expect(item.name).toBe("Barolo");
    expect(item.producer).toBe("Rocche");
    expect(item.country).toBe("Italien");
    expect(item.region).toBe("Piemonte");
    expect(item.grape).toBe("Nebbiolo");
    expect(item.type).toBe("Rött");
    expect(item.vintage).toBe(2018);
  });

  test("trims barcode and systembolaget_product_id", () => {
    const wine: WineRecord = { ...baseRecord, barcode: "  7311234  ", systembolaget_product_id: "  558801  " };
    const [item] = buildCatalogBackfillPayload([wine], "u1");
    expect(item.barcode).toBe("7311234");
    expect(item.systembolaget_product_id).toBe("558801");
  });

  test("converts null/undefined fields to null", () => {
    const wine: WineRecord = { ...baseRecord, producer: null, country: null, region: null, grape: null, vintage: null };
    const [item] = buildCatalogBackfillPayload([wine], "u1");
    expect(item.producer).toBeNull();
    expect(item.country).toBeNull();
    expect(item.region).toBeNull();
    expect(item.grape).toBeNull();
    expect(item.vintage).toBeNull();
  });

  test("converts empty barcode to null", () => {
    const wine: WineRecord = { ...baseRecord, barcode: "", systembolaget_product_id: "" };
    const [item] = buildCatalogBackfillPayload([wine], "u1");
    expect(item.barcode).toBeNull();
    expect(item.systembolaget_product_id).toBeNull();
  });

  test("sets source_label and source_confidence", () => {
    const [item] = buildCatalogBackfillPayload([baseRecord], "u1");
    expect(item.source_label).toBe("MinVinkällaren");
    expect(item.source_confidence).toBe("high");
  });

  test("sets created_by to provided userId", () => {
    const [item] = buildCatalogBackfillPayload([baseRecord], "user-abc");
    expect(item.created_by).toBe("user-abc");
  });

  test("preserves food_pairings array", () => {
    const [item] = buildCatalogBackfillPayload([baseRecord], "u1");
    expect(item.food_pairings).toEqual(["lamm", "nöt"]);
  });

  test("defaults food_pairings to empty array when missing", () => {
    const wine: WineRecord = { ...baseRecord, food_pairings: [] };
    const [item] = buildCatalogBackfillPayload([wine], "u1");
    expect(item.food_pairings).toEqual([]);
  });

  test("handles 500 wines and returns correct array length", () => {
    const wines = Array.from({ length: 500 }, (_, i) => ({ ...baseRecord, id: String(i) }));
    const result = buildCatalogBackfillPayload(wines, "u1");
    expect(result).toHaveLength(500);
  });

  test("returns empty array for empty input", () => {
    expect(buildCatalogBackfillPayload([], "u1")).toEqual([]);
  });
});
