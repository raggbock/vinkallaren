import { Linking } from "react-native";

import { supabase } from "./supabase";
import { ok, fail, type Result } from "../types/result";
import { buildSystembolagetProductUrl, emptyToNull, parseTags, toNumberOrNull } from "./cellar-helpers";
import {
  buildWineInsertFromDraft,
  cacheWineDraftAsCatalogEntry,
  getMissingCatalogFields,
  hydrateWineRecords,
  syncCatalogEntryForEditedWine,
  uploadWineImage,
} from "./wine-helpers";
import type { CatalogEditorDraft, WineDraft } from "../types/cellar-drafts";
import type { WineHistoryInsert, WineHistoryRow } from "../types/wine-history";
import type { WineInsert, WineRecord, WineRow } from "../types/wine";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import type { WsetTastingData } from "./wset-data";

type SaveWineArgs = {
  userId: string;
  draft: WineDraft;
  storageSpaceId: string;
  storageRow: string;
  storageSlot: string;
  selectedCatalogNameEntry: ProductCatalogWineRow | null;
};

export async function saveNewWine(args: SaveWineArgs): Promise<Result<WineRow>> {
  const { userId, draft, storageSpaceId, storageRow, storageSlot, selectedCatalogNameEntry } = args;
  if (!draft.name.trim()) return fail("Namn saknas: Skriv in vilket vin du vill lägga till.");
  const missingFields = getMissingCatalogFields(draft);
  if (!selectedCatalogNameEntry && missingFields.length > 0) return fail(`Komplettera vinet: Fyll i: ${missingFields.join(", ")}.`);
  let imagePath: string | null = null;
  if (draft.imageUri) imagePath = await uploadWineImage(userId, draft.imageUri);
  const payload: WineInsert = {
    user_id: userId,
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
  const { data, error } = await supabase.from("wines").insert(payload).select().single();
  if (error) return fail(error.message);
  if (!data) return fail("Ingen data returnerades");
  void cacheWineDraftAsCatalogEntry(payload, userId);
  return ok(data as WineRow);
}

type SaveTastingArgs = {
  userId: string;
  draft: WineDraft;
  tastingRating: string;
  tastingDate: string;
  wsetData: WsetTastingData | null;
};

export async function saveTastingEntry(args: SaveTastingArgs): Promise<Result<WineHistoryRow>> {
  const { userId, draft, tastingRating, tastingDate, wsetData } = args;
  if (!draft.name.trim()) return fail("Namn saknas: Skriv in vilket vin du provade.");
  let imagePath: string | null = null;
  if (draft.imageUri) imagePath = await uploadWineImage(userId, draft.imageUri);
  const payload: WineHistoryInsert = {
    user_id: userId,
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    vintage: toNumberOrNull(draft.vintage),
    type: draft.type.trim() || "Rött",
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    image_path: imagePath,
    quantity_consumed: 1,
    rating: tastingRating ? Number(tastingRating) : null,
    tasting_notes: emptyToNull(draft.notes),
    consumed_at: tastingDate || null,
    tasting_data: wsetData ?? null,
  };
  const { data, error } = await supabase.from("wine_history").insert(payload).select().single();
  if (error) return fail(error.message);
  if (!data) return fail("Ingen data returnerades");
  return ok(data as WineHistoryRow);
}

type SaveDrinkArgs = {
  userId: string;
  wine: WineRecord;
  rating: string;
  notes: string;
  consumedDate: string;
  imageUri: string;
  wsetData?: Record<string, unknown> | null;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
};

export async function saveDrinkEntry(args: SaveDrinkArgs): Promise<Result<WineHistoryRow>> {
  const { userId, wine, rating, notes, consumedDate, imageUri, wsetData, setWines } = args;
  let imagePath = wine.image_path;
  if (imageUri) imagePath = await uploadWineImage(userId, imageUri);
  const payload: WineHistoryInsert = {
    user_id: userId, wine_id: wine.id,
    name: wine.name, producer: wine.producer, country: wine.country,
    region: wine.region, grape: wine.grape, vintage: wine.vintage,
    type: wine.type, barcode: wine.barcode,
    systembolaget_product_id: wine.systembolaget_product_id,
    storage_space_id: wine.storage_space_id, storage_row: wine.storage_row,
    storage_slot: wine.storage_slot, cellar_location: wine.cellar_location,
    image_path: imagePath, quantity_consumed: 1,
    rating: rating ? Number(rating) : null,
    tasting_notes: emptyToNull(notes),
    tasting_data: wsetData ?? null,
    consumed_at: consumedDate || null,
  };
  const { data: historyData, error: historyError } = await supabase.from("wine_history").insert(payload).select().single();
  if (historyError) return fail(historyError.message);
  if (!historyData) return fail("Ingen data returnerades");
  if (wine.quantity <= 1) {
    const { error } = await supabase.from("wines").delete().eq("id", wine.id);
    if (error) return fail(error.message);
    setWines((current) => current.filter((w) => w.id !== wine.id));
  } else {
    const { data, error } = await supabase.from("wines").update({ quantity: wine.quantity - 1 }).eq("id", wine.id).select("*").single();
    if (error) return fail(error.message);
    const [hydrated] = await hydrateWineRecords([data as WineRow]);
    setWines((current) => current.map((w) => (w.id === wine.id ? hydrated : w)));
  }
  return ok(historyData as WineHistoryRow);
}

type SaveWineEditArgs = {
  userId: string;
  editingWine: WineRecord;
  editWineDraft: WineDraft;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
};

export async function saveWineEditEntry(args: SaveWineEditArgs): Promise<Result<true>> {
  const { userId, editingWine, editWineDraft, setWines } = args;
  if (!editWineDraft.name.trim()) return fail("Namn saknas: Skriv in vilket vin du vill spara.");
  const missingFields = getMissingCatalogFields(editWineDraft);
  if (missingFields.length > 0) return fail(`Komplettera vinet: Fyll i: ${missingFields.join(", ")}.`);
  let imagePath = editingWine.image_path;
  if (editWineDraft.imageUri && editWineDraft.imageUri !== editingWine.image_url) {
    imagePath = await uploadWineImage(userId, editWineDraft.imageUri);
    if (editingWine.image_path) {
      await supabase.storage.from("wine-images").remove([editingWine.image_path]).catch(() => {});
    }
  } else if (!editWineDraft.imageUri && editingWine.image_path) {
    await supabase.storage.from("wine-images").remove([editingWine.image_path]).catch(() => {});
    imagePath = null;
  }
  const payload = buildWineInsertFromDraft(editWineDraft, editWineDraft.storageSpaceId, editWineDraft.storageRow, editWineDraft.storageSlot, imagePath);
  const { data, error } = await supabase.from("wines").update(payload).eq("id", editingWine.id).select("*").single();
  if (error) return fail(error.message);
  const updatedWine = data as WineRow | null;
  if (updatedWine) {
    await syncCatalogEntryForEditedWine(editingWine, updatedWine, userId);
    const [hydrated] = await hydrateWineRecords([updatedWine]);
    setWines((current) => current.map((w) => (w.id === editingWine.id ? hydrated : w)));
  }
  return ok(true as const);
}

export async function saveCatalogEditorEntry(draft: CatalogEditorDraft): Promise<Result<true>> {
  if (!draft.name.trim()) return fail("Namn saknas: Skriv in ett namn innan du sparar katalogposten.");
  const { error } = await supabase.from("product_catalog_wines").update({
    barcode: emptyToNull(draft.barcode),
    systembolaget_product_id: emptyToNull(draft.systembolagetProductId),
    name: draft.name.trim(),
    producer: emptyToNull(draft.producer),
    country: emptyToNull(draft.country),
    region: emptyToNull(draft.region),
    grape: emptyToNull(draft.grape),
    type: emptyToNull(draft.type),
    vintage: toNumberOrNull(draft.vintage),
    food_pairings: parseTags(draft.foodPairings),
    source_label: emptyToNull(draft.sourceLabel),
    source_confidence: emptyToNull(draft.sourceConfidence) || "high",
  }).eq("id", draft.id);
  if (error) return fail(error.message);
  return ok(true as const);
}

export async function deleteCatalogEntryById(id: string): Promise<Result<true>> {
  const { error } = await supabase.from("product_catalog_wines").delete().eq("id", id);
  if (error) return fail(error.message);
  return ok(true as const);
}

type UpdateHistoryArgs = {
  id: string;
  rating: number | null;
  tasting_notes: string | null;
  consumed_at: string;
  quantity_consumed: number;
};

export async function updateHistoryEntry(args: UpdateHistoryArgs): Promise<Result<WineHistoryRow>> {
  const { id, ...payload } = args;
  const { data, error } = await supabase.from("wine_history").update(payload).eq("id", id).select().single();
  if (error) return fail(error.message);
  if (!data) return fail("Ingen data returnerades");
  return ok(data as WineHistoryRow);
}

export async function openSystembolaget(productId: string): Promise<Result<true>> {
  const url = buildSystembolagetProductUrl(productId);
  const supported = await Linking.canOpenURL(url);
  if (!supported) return fail("Det gick inte att öppna Systembolaget just nu.");
  await Linking.openURL(url);
  return ok(true as const);
}

