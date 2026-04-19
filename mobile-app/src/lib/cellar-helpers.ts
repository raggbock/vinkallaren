import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRow } from "../types/wine";

export function buildNumericOptions(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => String(index + 1));
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
