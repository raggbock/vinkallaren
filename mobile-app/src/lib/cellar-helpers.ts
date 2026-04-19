import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord, WineRow } from "../types/wine";

export function buildNumericOptions(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => String(index + 1));
}

export function buildStorageSpaceBottleCounts(wines: WineRecord[]) {
  const counts = new Map<string, number>();

  for (const wine of wines) {
    if (!wine.storage_space_id) {
      continue;
    }

    counts.set(wine.storage_space_id, (counts.get(wine.storage_space_id) || 0) + wine.quantity);
  }

  return counts;
}

export function getWineStoragePlacementLabel(
  wine: Pick<WineRow, "storage_space_id" | "storage_row" | "storage_slot">,
  storageSpaceById: Map<string, StorageSpaceRow>
) {
  if (!wine.storage_space_id) {
    return "";
  }

  const space = storageSpaceById.get(wine.storage_space_id);
  const positionFree = space && space.row_count === 0;
  const row = !positionFree && wine.storage_row ? `Rad ${wine.storage_row}` : "";
  const slot = !positionFree && wine.storage_slot ? `Plats ${wine.storage_slot}` : "";
  const parts = [space?.name || "Förvaringsplats", row, slot].filter(Boolean);

  return parts.join(" • ");
}

export function buildStats(wines: WineRecord[]) {
  const totalBottles = wines.reduce((sum, wine) => sum + wine.quantity, 0);
  const drinkSoon = wines
    .filter((wine) => wine.drink_by_year && wine.drink_by_year <= new Date().getFullYear() + 1)
    .reduce((sum, wine) => sum + wine.quantity, 0);

  const byCountry = new Map<string, number>();
  const byType = new Map<string, number>();
  const byPairing = new Map<string, number>();
  const vintages = wines.map((wine) => wine.vintage).filter((value): value is number => Boolean(value));

  for (const wine of wines) {
    if (wine.country) {
      byCountry.set(wine.country, (byCountry.get(wine.country) || 0) + wine.quantity);
    }

    byType.set(wine.type, (byType.get(wine.type) || 0) + wine.quantity);

    for (const pairing of wine.food_pairings) {
      byPairing.set(pairing, (byPairing.get(pairing) || 0) + wine.quantity);
    }
  }

  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];
  const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  const topPairing = [...byPairing.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalBottles,
    totalLabels: wines.length,
    drinkSoon,
    topCountry: topCountry ? `${topCountry[0]} (${topCountry[1]})` : "Ingen data",
    topType: topType ? `${topType[0]} (${topType[1]})` : "Ingen data",
    topPairing: topPairing ? `${topPairing[0]} (${topPairing[1]})` : "Ingen data",
    averageVintage:
      vintages.length > 0
        ? String(Math.round(vintages.reduce((sum, value) => sum + value, 0) / vintages.length))
        : "-",
  };
}

export function buildHistoryStats(entries: Array<{ quantity_consumed: number; country?: string | null; type?: string | null; rating?: number | null; vintage?: number | null }>) {
  const totalDrunk = entries.reduce((sum, e) => sum + e.quantity_consumed, 0);
  const totalTastings = entries.length;

  const byCountry = new Map<string, number>();
  const byType = new Map<string, number>();
  const ratings: number[] = [];

  for (const entry of entries) {
    if (entry.country) byCountry.set(entry.country, (byCountry.get(entry.country) || 0) + entry.quantity_consumed);
    if (entry.type) byType.set(entry.type, (byType.get(entry.type) || 0) + entry.quantity_consumed);
    if (entry.rating != null) ratings.push(entry.rating);
  }

  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];
  const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalDrunk,
    totalTastings,
    topCountry: topCountry ? `${topCountry[0]} (${topCountry[1]})` : "Ingen data",
    topType: topType ? `${topType[0]} (${topType[1]})` : "Ingen data",
    averageRating: ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "-",
  };
}

export function buildPairingOptions(wines: WineRecord[]) {
  const pairings = new Set<string>(["Alla"]);

  for (const wine of wines) {
    for (const pairing of wine.food_pairings) {
      pairings.add(pairing);
    }
  }

  return [...pairings];
}

export function buildSystembolagetProductUrl(productId: string) {
  const normalized = productId.trim();
  return `https://www.systembolaget.se/${encodeURIComponent(normalized)}/`;
}

export const FOOD_CATEGORIES: Array<{ label: string; items: string[] }> = [
  { label: "Kött", items: ["lamm", "nöt", "fläsk", "vilt", "kyckling", "grillat"] },
  { label: "Fisk & skaldjur", items: ["fisk", "skaldjur", "lax", "tonfisk"] },
  { label: "Ost", items: ["ost", "lagrad ost", "getost", "blåmögelost"] },
  { label: "Grönt & övrigt", items: ["sallad", "svamp", "pasta", "pizza", "soppa", "risotto"] },
  { label: "Asiatiskt", items: ["sushi", "thaimat", "indiskt", "kinesiskt", "koreanskt", "ramen"] },
  { label: "Tilltugg", items: ["aperitif", "snacks", "chips", "charkuterier"] },
  { label: "Sött", items: ["dessert", "choklad", "frukt"] },
];

export function buildValueOptions(wines: WineRecord[], selector: (wine: WineRecord) => string | null) {
  const values = new Set<string>(["Alla"]);

  for (const wine of wines) {
    const value = selector(wine);

    if (value) {
      values.add(value);
    }
  }

  return [...values];
}

export function buildVintageOptions(wines: WineRecord[]) {
  const values = new Set<string>(["Alla"]);

  for (const wine of wines) {
    if (wine.vintage) {
      values.add(String(wine.vintage));
    }
  }

  return [...values].sort((a, b) => {
    if (a === "Alla") {
      return -1;
    }

    if (b === "Alla") {
      return 1;
    }

    return Number(b) - Number(a);
  });
}

export function getSuggestedPairings(wineType: string) {
  const normalized = wineType.trim().toLowerCase();

  if (normalized.includes("vitt")) {
    return ["fisk", "skaldjur", "kyckling", "sallad", "getost", "ost", "pasta", "risotto", "sushi", "thaimat", "soppa", "aperitif"];
  }

  if (normalized.includes("mousserande")) {
    return ["aperitif", "skaldjur", "fisk", "ost", "chips", "snacks", "sushi", "charkuterier", "frukt", "dessert"];
  }

  if (normalized.includes("ros")) {
    return ["grillat", "sallad", "kyckling", "fisk", "snacks", "pizza", "pasta", "thaimat", "charkuterier", "getost", "aperitif"];
  }

  if (normalized.includes("dessert") || normalized.includes("sött")) {
    return ["dessert", "blåmögelost", "frukt", "choklad", "ost", "foie gras", "nötter"];
  }

  // Rött (default)
  return ["lamm", "nöt", "vilt", "grillat", "svamp", "lagrad ost", "pasta", "pizza", "charkuterier", "fläsk"];
}

export function parseTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function toNumberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mergeTagText(currentValue: string, nextValue: string) {
  const parts = parseTags(currentValue);

  if (parts.includes(nextValue)) {
    return parts.filter((p) => p !== nextValue).join(", ");
  }

  return [...parts, nextValue].join(", ");
}

export function resolveImportedValue(currentValue: string, importedValue: string, modeOrSelection: boolean) {
  if (!modeOrSelection) {
    return currentValue;
  }

  return importedValue || currentValue;
}

export function normalizeLookupValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'");
}
