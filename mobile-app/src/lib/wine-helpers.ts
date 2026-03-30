import { supabase } from "./supabase";
import { cacheCatalogEntry, type ProductCatalogEntry } from "./product-catalog";
import { emptyToNull, normalizeLookupValue, parseTags, resolveImportedValue, toNumberOrNull } from "./cellar-helpers";
import type { CatalogEditorDraft, ImportFieldSelection, ImportMode, WineDraft } from "../types/cellar-drafts";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { ReferenceOptionRow } from "../types/reference-data";
import type { WineHistoryRecord, WineHistoryRow } from "../types/wine-history";
import type { WineInsert, WineRecord, WineRow } from "../types/wine";

export function toCatalogEditorDraft(entry: ProductCatalogWineRow): CatalogEditorDraft {
  return {
    id: entry.id,
    barcode: entry.barcode ?? "",
    systembolagetProductId: entry.systembolaget_product_id ?? "",
    name: entry.name,
    producer: entry.producer ?? "",
    country: entry.country ?? "",
    region: entry.region ?? "",
    grape: entry.grape ?? "",
    type: entry.type ?? "",
    vintage: entry.vintage ? String(entry.vintage) : "",
    foodPairings: entry.food_pairings.join(", "),
    sourceLabel: entry.source_label ?? "",
    sourceConfidence: entry.source_confidence ?? "high",
  };
}

export function toWineDraft(wine: WineRecord): WineDraft {
  return {
    name: wine.name,
    producer: wine.producer ?? "",
    country: wine.country ?? "",
    region: wine.region ?? "",
    grape: wine.grape ?? "",
    vintage: wine.vintage ? String(wine.vintage) : "",
    quantity: String(wine.quantity),
    type: wine.type || "Rött",
    drinkBy: wine.drink_by_year ? String(wine.drink_by_year) : "",
    acquiredAt: wine.acquired_at ?? "",
    location: wine.cellar_location ?? "",
    storageSpaceId: wine.storage_space_id ?? "",
    storageRow: wine.storage_row ? String(wine.storage_row) : "1",
    storageSlot: wine.storage_slot ? String(wine.storage_slot) : "1",
    barcode: wine.barcode ?? "",
    systembolagetProductId: wine.systembolaget_product_id ?? "",
    tags: wine.tags.join(", "),
    foodPairings: wine.food_pairings.join(", "),
    notes: wine.notes ?? "",
    imageUri: wine.image_url ?? "",
  };
}

export function buildWineInsertFromDraft(
  draft: WineDraft,
  storageSpaceId: string,
  storageRow: string,
  storageSlot: string,
  imagePath: string | null
): Omit<WineInsert, "user_id"> {
  return {
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    vintage: toNumberOrNull(draft.vintage),
    quantity: Math.max(1, Number(draft.quantity) || 1),
    type: draft.type.trim() || "Rött",
    drink_by_year: toNumberOrNull(draft.drinkBy),
    acquired_at: emptyToNull(draft.acquiredAt),
    cellar_location: emptyToNull(draft.location),
    storage_space_id: emptyToNull(storageSpaceId),
    storage_row: storageSpaceId ? toNumberOrNull(storageRow) : null,
    storage_slot: storageSpaceId ? toNumberOrNull(storageSlot) : null,
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    tags: parseTags(draft.tags),
    food_pairings: parseTags(draft.foodPairings),
    pairing_source: "manual",
    notes: emptyToNull(draft.notes),
    image_path: imagePath,
  };
}

export function applyCatalogLocksToDraft(
  current: WineDraft,
  patch: Partial<WineDraft>,
  selectedCatalogEntry: ProductCatalogWineRow | null
) {
  if (!selectedCatalogEntry) {
    return { ...current, ...patch };
  }

  const nextDraft = { ...current, ...patch };

  if (selectedCatalogEntry.name && !("name" in patch)) {
    nextDraft.name = selectedCatalogEntry.name;
  }

  if (selectedCatalogEntry.producer) {
    nextDraft.producer = selectedCatalogEntry.producer;
  }

  if (selectedCatalogEntry.country) {
    nextDraft.country = selectedCatalogEntry.country;
  }

  if (selectedCatalogEntry.region) {
    nextDraft.region = selectedCatalogEntry.region;
  }

  if (selectedCatalogEntry.grape) {
    nextDraft.grape = selectedCatalogEntry.grape;
  }

  if (selectedCatalogEntry.vintage) {
    nextDraft.vintage = String(selectedCatalogEntry.vintage);
  }

  if (selectedCatalogEntry.type) {
    nextDraft.type = selectedCatalogEntry.type;
  }

  if (selectedCatalogEntry.barcode) {
    nextDraft.barcode = selectedCatalogEntry.barcode;
  }

  if (selectedCatalogEntry.systembolaget_product_id) {
    nextDraft.systembolagetProductId = selectedCatalogEntry.systembolaget_product_id;
  }

  if (selectedCatalogEntry.food_pairings.length > 0) {
    nextDraft.foodPairings = selectedCatalogEntry.food_pairings.join(", ");
  }

  return nextDraft;
}

export function scoreCatalogCompleteness(entry: ProductCatalogWineRow) {
  return [
    entry.name,
    entry.producer,
    entry.country,
    entry.region,
    entry.grape,
    entry.type,
    entry.vintage,
    entry.barcode,
    entry.systembolaget_product_id,
    entry.food_pairings.length > 0 ? "pairings" : null,
  ].filter(Boolean).length;
}

export function applyNullableCatalogFilter<
  TQuery extends { eq: (column: string, value: any) => TQuery; is: (column: string, value: null) => TQuery }
>(query: TQuery, column: string, value: string | number | null) {
  if (value === null) {
    return query.is(column, null);
  }

  return query.eq(column, value);
}

export function getMissingCatalogFields(source: Pick<WineDraft, "producer" | "country" | "region" | "grape" | "type">) {
  const missing: string[] = [];

  if (!source.producer.trim()) {
    missing.push("producent");
  }

  if (!source.country.trim()) {
    missing.push("land");
  }

  if (!source.region.trim()) {
    missing.push("region");
  }

  if (!source.grape.trim()) {
    missing.push("druva");
  }

  if (!source.type.trim()) {
    missing.push("vintyp");
  }

  return missing;
}

export function canBeSavedAsCatalogEntry(payload: WineInsert) {
  return Boolean(
    payload.name.trim() &&
      payload.producer?.trim() &&
      payload.country?.trim() &&
      payload.region?.trim() &&
      payload.grape?.trim() &&
      payload.type?.trim()
  );
}

export function mergeDraftWithCatalogSuggestion(
  current: WineDraft,
  suggestion: ProductCatalogEntry,
  mode: ImportMode,
  selection: ImportFieldSelection
) {
  const shouldApply = (field: keyof ImportFieldSelection, currentValue: string) => {
    if (mode === "all") {
      return true;
    }

    if (mode === "empty") {
      return !currentValue.trim();
    }

    return selection[field];
  };

  return {
    ...current,
    name: resolveImportedValue(current.name, suggestion.name, shouldApply("name", current.name)),
    producer: resolveImportedValue(current.producer, suggestion.producer || "", shouldApply("producer", current.producer)),
    country: resolveImportedValue(current.country, suggestion.country || "", shouldApply("country", current.country)),
    region: resolveImportedValue(current.region, suggestion.region || "", shouldApply("region", current.region)),
    vintage: resolveImportedValue(
      current.vintage,
      suggestion.vintage ? String(suggestion.vintage) : "",
      shouldApply("vintage", current.vintage)
    ),
    grape: resolveImportedValue(current.grape, suggestion.grape || "", shouldApply("grape", current.grape)),
    type: resolveImportedValue(current.type, suggestion.type || "Rött", shouldApply("type", current.type)),
    foodPairings: resolveImportedValue(
      current.foodPairings,
      (suggestion.foodPairings ?? []).join(", "),
      shouldApply("foodPairings", current.foodPairings)
    ),
    systembolagetProductId: resolveImportedValue(
      current.systembolagetProductId,
      suggestion.systembolagetProductId || "",
      shouldApply("systembolagetProductId", current.systembolagetProductId)
    ),
    barcode: resolveImportedValue(current.barcode, suggestion.barcode || "", shouldApply("barcode", current.barcode)),
  };
}

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  argentina: "Argentina",
  australia: "Australien",
  austria: "Österrike",
  chile: "Chile",
  england: "England",
  france: "Frankrike",
  frankrike: "Frankrike",
  germany: "Tyskland",
  greece: "Grekland",
  hungary: "Ungern",
  italy: "Italien",
  italien: "Italien",
  "new zealand": "Nya Zeeland",
  portugal: "Portugal",
  "south africa": "Sydafrika",
  spain: "Spanien",
  sweden: "Sverige",
  usa: "USA",
  "united states": "USA",
};

export function mergeReferenceRows(rows: ReferenceOptionRow[]) {
  const merged = new Map<string, ReferenceOptionRow>();

  for (const row of rows) {
    const displayName =
      row.category === "country" ? COUNTRY_NAME_OVERRIDES[normalizeLookupValue(row.name)] ?? row.name : row.name;
    const key = normalizeLookupValue(displayName);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...row,
        name: displayName,
        aliases: [...new Set([row.name, ...(row.aliases ?? [])].filter(Boolean))],
      });
      continue;
    }

    merged.set(key, {
      ...existing,
      aliases: [...new Set([existing.name, row.name, ...(existing.aliases ?? []), ...(row.aliases ?? [])].filter(Boolean))],
      sort_order: Math.min(existing.sort_order, row.sort_order),
      parent_name: existing.parent_name ?? row.parent_name,
    });
  }

  return [...merged.values()].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.name.localeCompare(right.name, "sv");
  });
}

export function toWineNameReferenceRows(
  seeds: Array<{ name: string; producer?: string | null; country?: string | null; region?: string | null }>,
  idPrefix: string
): ReferenceOptionRow[] {
  return seeds
    .filter((seed) => Boolean(seed.name?.trim()))
    .map((seed, index) => ({
    id: `${idPrefix}-${index}`,
    name: seed.name,
    category: "wine_name" as const,
    aliases: [seed.producer, seed.country, seed.region].filter((value): value is string => Boolean(value)),
    parent_name: seed.producer ?? null,
    sort_order: index,
    created_at: "",
    updated_at: "",
  }));
}

export async function hydrateWineRecords(rows: WineRow[]): Promise<WineRecord[]> {
  const paths = rows.map((row) => row.image_path).filter((value): value is string => Boolean(value));
  const signedUrlMap = new Map<string, string>();

  if (paths.length > 0) {
    const { data } = await supabase.storage.from("wine-images").createSignedUrls(paths, 60 * 60);

    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    image_url: row.image_path ? signedUrlMap.get(row.image_path) ?? null : null,
  }));
}

export async function hydrateWineHistoryRecords(rows: WineHistoryRow[]): Promise<WineHistoryRecord[]> {
  const paths = rows.map((row) => row.image_path).filter((value): value is string => Boolean(value));
  const signedUrlMap = new Map<string, string>();

  if (paths.length > 0) {
    const { data } = await supabase.storage.from("wine-images").createSignedUrls(paths, 60 * 60);

    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedUrlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  return rows.map((row) => ({
    ...row,
    image_url: row.image_path ? signedUrlMap.get(row.image_path) ?? null : null,
  }));
}

export async function uploadWineImage(userId: string, uri: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = blob.type.split("/")[1] || "jpg";
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from("wine-images").upload(filePath, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function cacheWineDraftAsCatalogEntry(payload: WineInsert, userId: string) {
  const barcode = payload.barcode?.trim();
  const systembolagetProductId = payload.systembolaget_product_id?.trim();

  if (!payload.name.trim()) {
    return;
  }

  if (!canBeSavedAsCatalogEntry(payload)) {
    return;
  }

  await cacheCatalogEntry(
    {
      barcode,
      systembolagetProductId,
      name: payload.name,
      producer: payload.producer ?? undefined,
      country: payload.country ?? undefined,
      region: payload.region ?? undefined,
      grape: payload.grape ?? undefined,
      type: payload.type ?? undefined,
      vintage: payload.vintage ?? undefined,
      foodPairings: payload.food_pairings ?? [],
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}

export async function cacheWineRecordAsCatalogEntry(wine: WineRecord, userId: string) {
  await cacheCatalogEntry(
    {
      barcode: wine.barcode?.trim() || undefined,
      systembolagetProductId: wine.systembolaget_product_id?.trim() || undefined,
      name: wine.name,
      producer: wine.producer ?? undefined,
      country: wine.country ?? undefined,
      region: wine.region ?? undefined,
      grape: wine.grape ?? undefined,
      type: wine.type ?? undefined,
      vintage: wine.vintage ?? undefined,
      foodPairings: wine.food_pairings ?? [],
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}

export async function syncCatalogEntryForEditedWine(previousWine: WineRecord, nextWine: WineRow, userId: string) {
  if (!canBeSavedAsCatalogEntry(nextWine)) {
    return;
  }

  const nextPayload = {
    name: nextWine.name.trim(),
    producer: nextWine.producer ?? null,
    country: nextWine.country ?? null,
    region: nextWine.region ?? null,
    grape: nextWine.grape ?? null,
    type: nextWine.type ?? null,
    vintage: nextWine.vintage ?? null,
    food_pairings: nextWine.food_pairings ?? [],
    source_label: "MinVinkällare",
    source_confidence: "high",
    barcode: nextWine.barcode?.trim() || null,
    systembolaget_product_id: nextWine.systembolaget_product_id?.trim() || null,
    created_by: userId,
  };

  const previousBarcode = previousWine.barcode?.trim();
  const previousArticleNumber = previousWine.systembolaget_product_id?.trim();

  let lookup = supabase.from("product_catalog_wines").select("id").limit(1);

  if (previousBarcode) {
    lookup = lookup.eq("barcode", previousBarcode);
  } else if (previousArticleNumber) {
    lookup = lookup.eq("systembolaget_product_id", previousArticleNumber);
  } else {
    lookup = lookup.eq("name", previousWine.name);
    lookup = applyNullableCatalogFilter(lookup, "producer", previousWine.producer ?? null);
    lookup = applyNullableCatalogFilter(lookup, "country", previousWine.country ?? null);
    lookup = applyNullableCatalogFilter(lookup, "region", previousWine.region ?? null);
    lookup = applyNullableCatalogFilter(lookup, "grape", previousWine.grape ?? null);
    lookup = applyNullableCatalogFilter(lookup, "type", previousWine.type ?? null);
    lookup = applyNullableCatalogFilter(lookup, "vintage", previousWine.vintage ?? null);
  }

  const { data, error } = await lookup.maybeSingle();

  if (!error && data?.id) {
    const { error: updateError } = await supabase.from("product_catalog_wines").update(nextPayload).eq("id", data.id);

    if (!updateError) {
      return;
    }
  }

  await cacheCatalogEntry(
    {
      barcode: nextPayload.barcode || undefined,
      systembolagetProductId: nextPayload.systembolaget_product_id || undefined,
      name: nextPayload.name,
      producer: nextPayload.producer || undefined,
      country: nextPayload.country || undefined,
      region: nextPayload.region || undefined,
      grape: nextPayload.grape || undefined,
      type: nextPayload.type || undefined,
      vintage: nextPayload.vintage || undefined,
      foodPairings: nextPayload.food_pairings,
      sourceLabel: "MinVinkällare",
      sourceConfidence: "high",
    },
    userId
  );
}
