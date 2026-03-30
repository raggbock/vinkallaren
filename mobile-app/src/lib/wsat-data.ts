// --- Types ---

export type WsatTastingData = {
  protocol: "wset_l2";
  appearance: {
    intensity: "pale" | "medium" | "deep" | null;
    colour: string | null;
  };
  nose: {
    intensity: "light" | "medium" | "pronounced" | null;
    aromas: string[];
    aromaNote: string | null;
  };
  palate: {
    sweetness: "dry" | "off-dry" | "medium" | "sweet" | null;
    acidity: "low" | "medium" | "high" | null;
    tannin: "low" | "medium" | "high" | null;
    alcohol: "low" | "medium" | "high" | null;
    body: "light" | "medium" | "full" | null;
    flavourIntensity: "light" | "medium" | "pronounced" | null;
    flavours: string[];
    flavourNote: string | null;
    finish: "short" | "medium" | "long" | null;
  };
  conclusions: {
    quality: "poor" | "acceptable" | "good" | "very good" | "outstanding" | null;
  };
};

export function emptyWsatData(): WsatTastingData {
  return {
    protocol: "wset_l2",
    appearance: { intensity: null, colour: null },
    nose: { intensity: null, aromas: [], aromaNote: null },
    palate: {
      sweetness: null,
      acidity: null,
      tannin: null,
      alcohol: null,
      body: null,
      flavourIntensity: null,
      flavours: [],
      flavourNote: null,
      finish: null,
    },
    conclusions: { quality: null },
  };
}

// --- Colour options by wine type ---

export const APPEARANCE_INTENSITY = ["pale", "medium", "deep"] as const;

export const COLOUR_OPTIONS: Record<string, string[]> = {
  white: ["lemon", "gold", "amber"],
  rose: ["pink", "pink-orange", "orange"],
  red: ["purple", "ruby", "garnet", "tawny"],
};

export function getColourOptions(wineType: string): string[] {
  const t = wineType.toLowerCase();
  if (t.includes("rött") || t === "rött") return COLOUR_OPTIONS.red;
  if (t.includes("rosé") || t === "rosé") return COLOUR_OPTIONS.rose;
  return COLOUR_OPTIONS.white;
}

// --- Nose / Palate intensity ---

export const NOSE_INTENSITY = ["light", "medium", "pronounced"] as const;
export const PALATE_SWEETNESS = ["dry", "off-dry", "medium", "sweet"] as const;
export const PALATE_ACIDITY = ["low", "medium", "high"] as const;
export const PALATE_TANNIN = ["low", "medium", "high"] as const;
export const PALATE_ALCOHOL = ["low", "medium", "high"] as const;
export const PALATE_BODY = ["light", "medium", "full"] as const;
export const PALATE_FLAVOUR_INTENSITY = ["light", "medium", "pronounced"] as const;
export const PALATE_FINISH = ["short", "medium", "long"] as const;
export const QUALITY_OPTIONS = ["poor", "acceptable", "good", "very good", "outstanding"] as const;

// --- WSET Level 2 Aroma/Flavour Lexicon ---

export type AromaGroup = { category: string; tags: string[] };
export type AromaSection = { title: string; groups: AromaGroup[] };

export const AROMA_LEXICON: AromaSection[] = [
  {
    title: "Primary",
    groups: [
      { category: "Floral", tags: ["blossom", "rose", "violet"] },
      { category: "Green fruit", tags: ["apple", "pear", "gooseberry", "grape"] },
      { category: "Citrus fruit", tags: ["grapefruit", "lemon", "lime", "orange"] },
      { category: "Stone fruit", tags: ["peach", "apricot", "nectarine"] },
      { category: "Tropical fruit", tags: ["banana", "lychee", "mango", "melon", "passion fruit", "pineapple"] },
      { category: "Red fruit", tags: ["redcurrant", "cranberry", "raspberry", "strawberry", "red cherry", "red plum"] },
      { category: "Black fruit", tags: ["blackcurrant", "blackberry", "blueberry", "black cherry", "black plum"] },
      { category: "Herbaceous", tags: ["green bell pepper", "grass", "tomato leaf", "asparagus"] },
      { category: "Herbal", tags: ["eucalyptus", "mint", "fennel", "dill", "dried herbs"] },
      { category: "Spice", tags: ["black/white pepper", "liquorice"] },
      { category: "Fruit ripeness", tags: ["unripe fruit", "ripe fruit", "dried fruit", "cooked fruit"] },
      { category: "Other", tags: ["wet stones", "candy"] },
    ],
  },
  {
    title: "Secondary",
    groups: [
      { category: "Yeast", tags: ["biscuit", "pastry", "bread", "toasted bread", "bread dough", "cheese", "yogurt"] },
      { category: "Malolactic", tags: ["butter", "cream", "cheese"] },
      { category: "Oak", tags: ["vanilla", "cloves", "coconut", "cedar", "charred wood", "smoke", "chocolate", "coffee"] },
    ],
  },
  {
    title: "Tertiary",
    groups: [
      { category: "Red wine ageing", tags: ["dried fruit", "leather", "earth", "mushroom", "meat", "tobacco", "wet leaves", "forest floor", "caramel"] },
      { category: "White wine ageing", tags: ["dried fruit", "orange marmalade", "petrol", "cinnamon", "ginger", "nutmeg", "almond", "hazelnut", "honey", "caramel"] },
      { category: "Oxidised", tags: ["almond", "hazelnut", "walnut", "chocolate", "coffee", "caramel"] },
    ],
  },
];

// --- Swedish labels ---

export const SWEDISH_LABELS: Record<string, string> = {
  pale: "Blek",
  medium: "Medium",
  deep: "Djup",
  lemon: "Citron",
  gold: "Guld",
  amber: "Bärnsten",
  pink: "Rosa",
  "pink-orange": "Rosa-orange",
  orange: "Orange",
  purple: "Lila",
  ruby: "Rubin",
  garnet: "Granat",
  tawny: "Tawny",
  light: "Lätt",
  pronounced: "Uttalad",
  dry: "Torrt",
  "off-dry": "Halvtorrt",
  sweet: "Sött",
  low: "Låg",
  high: "Hög",
  full: "Fyllig",
  short: "Kort",
  long: "Lång",
  poor: "Fattig",
  acceptable: "Acceptabel",
  good: "Bra",
  "very good": "Mycket bra",
  outstanding: "Enastående",
};

export function swedishLabel(value: string): string {
  return SWEDISH_LABELS[value] ?? value;
}

// --- Summary builder ---

export function buildWsatSummary(data: WsatTastingData): string {
  const parts: string[] = [];

  const app = [data.appearance.intensity, data.appearance.colour].filter((v): v is string => v != null);
  if (app.length > 0) parts.push(app.map(swedishLabel).join(", "));

  const noseItems = [
    data.nose.intensity ? swedishLabel(data.nose.intensity) : null,
    ...data.nose.aromas.slice(0, 3),
  ].filter(Boolean);
  if (noseItems.length > 0) parts.push(noseItems.join(", "));

  const palateItems = [
    data.palate.sweetness ? swedishLabel(data.palate.sweetness) : null,
    data.palate.acidity ? `syra: ${swedishLabel(data.palate.acidity)}` : null,
    data.palate.body ? `kropp: ${swedishLabel(data.palate.body)}` : null,
  ].filter(Boolean);
  if (palateItems.length > 0) parts.push(palateItems.join(", "));

  if (data.conclusions.quality) parts.push(swedishLabel(data.conclusions.quality));

  return parts.join(" | ") || "Ingen data";
}

// --- Tannin visibility ---

export function showTannin(wineType: string): boolean {
  return wineType.toLowerCase().includes("rött") || wineType.toLowerCase() === "rött";
}
