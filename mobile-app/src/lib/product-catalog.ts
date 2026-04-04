import { supabase } from "./supabase";
import type { ProductCatalogEntry, ProductCatalogWineInsert, ProductCatalogWineRow, ProductLookupInput } from "../types/product-catalog";
import { findOpenFoodFactsMatch } from "./wine-inference";

export type { ProductCatalogEntry, ProductLookupInput };

const barcodeSeedCatalog: ProductCatalogEntry[] = [
  {
    systembolagetProductId: "7202301",
    barcode: "7310400123456",
    name: "Barolo Bricco San Pietro",
    producer: "Rocche dei Manzoni",
    country: "Italien",
    region: "Piemonte",
    grape: "Nebbiolo",
    type: "Rött",
    vintage: 2018,
    foodPairings: ["lamm", "nöt", "svamp", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "558801",
    barcode: "7310400223455",
    name: "Chablis Premier Cru",
    producer: "Louis Michel",
    country: "Frankrike",
    region: "Chablis",
    grape: "Chardonnay",
    type: "Vitt",
    vintage: 2022,
    foodPairings: ["fisk", "skaldjur", "getost", "sallad"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "7724501",
    barcode: "7310400323454",
    name: "Crémant de Bourgogne",
    producer: "Louis Bouillot",
    country: "Frankrike",
    region: "Bourgogne",
    grape: "Pinot Noir, Chardonnay",
    type: "Mousserande",
    vintage: 2021,
    foodPairings: ["aperitif", "skaldjur", "chips", "ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "1234501",
    barcode: "7310400423453",
    name: "Rioja Reserva",
    producer: "Marqués de Riscal",
    country: "Spanien",
    region: "Rioja",
    grape: "Tempranillo",
    type: "Rött",
    vintage: 2019,
    foodPairings: ["lamm", "grillat", "tapas", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "2345601",
    barcode: "7310400523452",
    name: "Sancerre Blanc",
    producer: "Henri Bourgeois",
    country: "Frankrike",
    region: "Loire",
    grape: "Sauvignon Blanc",
    type: "Vitt",
    vintage: 2023,
    foodPairings: ["fisk", "getost", "sallad", "skaldjur"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "3456701",
    barcode: "7310400623451",
    name: "Côtes du Rhône",
    producer: "E. Guigal",
    country: "Frankrike",
    region: "Rhône",
    grape: "Grenache, Syrah, Mourvèdre",
    type: "Rött",
    vintage: 2021,
    foodPairings: ["grillat", "nöt", "lamm", "svamp"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "4567801",
    barcode: "7310400723450",
    name: "Riesling Kabinett",
    producer: "Dr. Loosen",
    country: "Tyskland",
    region: "Mosel",
    grape: "Riesling",
    type: "Vitt",
    vintage: 2023,
    foodPairings: ["asiatiskt", "fisk", "skaldjur", "kryddigt"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "5678901",
    barcode: "7310400823449",
    name: "Chianti Classico",
    producer: "Castello di Ama",
    country: "Italien",
    region: "Toscana",
    grape: "Sangiovese",
    type: "Rött",
    vintage: 2020,
    foodPairings: ["pasta", "pizza", "lamm", "lagrad ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "6789001",
    barcode: "7310400923448",
    name: "Champagne Brut",
    producer: "Pol Roger",
    country: "Frankrike",
    region: "Champagne",
    grape: "Pinot Noir, Chardonnay, Pinot Meunier",
    type: "Mousserande",
    vintage: 2018,
    foodPairings: ["aperitif", "skaldjur", "chips", "ost"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "7890101",
    barcode: "7310401023447",
    name: "Tokaji Late Harvest",
    producer: "Royal Tokaji",
    country: "Ungern",
    region: "Tokaj",
    grape: "Furmint",
    type: "Dessert",
    vintage: 2022,
    foodPairings: ["dessert", "blåmögelost", "frukt"],
    sourceLabel: "Systembolaget referens",
  },
  {
    systembolagetProductId: "211001",
    barcode: "651357542936",
    name: "Motif Red Hills Cabernet Sauvignon",
    producer: "Precision Wine Company",
    country: "USA",
    region: "North Coast, Lake County",
    grape: "Cabernet Sauvignon",
    type: "Rött",
    vintage: 2023,
    foodPairings: ["lamm", "nöt", "vilt", "grillat"],
    sourceLabel: "Systembolaget referens",
  },
];

export async function findCatalogMatch(input: ProductLookupInput) {
  const sharedMatch = await findSharedCatalogMatch(input);

  if (sharedMatch) {
    return sharedMatch;
  }

  const localMatch = findLocalCatalogMatch(input);

  if (localMatch) {
    return localMatch;
  }

  return findRemoteCatalogMatch(input);
}

function findLocalCatalogMatch(input: ProductLookupInput) {
  const barcode = input.barcode?.trim();
  const systembolagetProductId = input.systembolagetProductId?.trim();

  return (
    barcodeSeedCatalog.find((entry) => {
      const barcodeMatch = barcode && entry.barcode && entry.barcode === barcode;
      const articleMatch =
        systembolagetProductId &&
        entry.systembolagetProductId &&
        entry.systembolagetProductId === systembolagetProductId;

      return Boolean(barcodeMatch || articleMatch);
    }) ?? null
  );
}

async function findSharedCatalogMatch(input: ProductLookupInput) {
  const barcode = input.barcode?.trim();
  const systembolagetProductId = input.systembolagetProductId?.trim();

  if (!barcode && !systembolagetProductId) {
    return null;
  }

  let query = supabase
    .from("product_catalog_wines")
    .select("*")
    .limit(1);

  if (barcode && systembolagetProductId) {
    query = query.or(`barcode.eq.${escapeFilterValue(barcode)},systembolaget_product_id.eq.${escapeFilterValue(systembolagetProductId)}`);
  } else if (barcode) {
    query = query.eq("barcode", barcode);
  } else if (systembolagetProductId) {
    query = query.eq("systembolaget_product_id", systembolagetProductId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapCatalogRowToEntry(data as ProductCatalogWineRow);
}

async function findRemoteCatalogMatch(input: ProductLookupInput) {
  const endpoint = process.env.EXPO_PUBLIC_PRODUCT_LOOKUP_URL;

  if (endpoint) {
    const remoteMatch = await findCustomRemoteCatalogMatch(endpoint, input);

    if (remoteMatch) {
      return remoteMatch;
    }
  }

  return findOpenFoodFactsMatch(input);
}

async function findCustomRemoteCatalogMatch(endpoint: string, input: ProductLookupInput) {
  const query = new URLSearchParams();

  if (input.barcode?.trim()) {
    query.set("barcode", input.barcode.trim());
  }

  if (input.systembolagetProductId?.trim()) {
    query.set("systembolagetProductId", input.systembolagetProductId.trim());
  }

  const response = await fetch(`${endpoint}?${query.toString()}`);

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as ProductCatalogEntry | null;
  return data;
}

export async function cacheCatalogEntry(entry: ProductCatalogEntry, userId?: string | null): Promise<boolean> {
  const payload = mapEntryToCatalogInsert(entry, userId);

  if (!payload.name?.trim()) {
    return false;
  }

  // Find existing entry by barcode, systembolaget_product_id, or name+producer+vintage
  let existingId: string | null = null;
  if (payload.barcode) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("barcode", payload.barcode).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId && payload.systembolaget_product_id) {
    const { data: found } = await supabase.from("product_catalog_wines").select("id").eq("systembolaget_product_id", payload.systembolaget_product_id).maybeSingle();
    existingId = found?.id ?? null;
  }
  if (!existingId) {
    existingId = await findExistingManualCatalogEntryId(payload);
  }

  if (existingId) {
    const result = await supabase.from("product_catalog_wines").update(payload).eq("id", existingId);
    if (result.error) console.warn("Could not cache product catalog entry", result.error.message);
    return false;
  } else {
    const result = await supabase.from("product_catalog_wines").insert(payload);
    if (result.error) console.warn("Could not cache product catalog entry", result.error.message);
    return !result.error;
  }
}

function mapCatalogRowToEntry(row: ProductCatalogWineRow): ProductCatalogEntry {
  return {
    barcode: row.barcode || undefined,
    systembolagetProductId: row.systembolaget_product_id || undefined,
    name: row.name,
    producer: row.producer || undefined,
    country: row.country || undefined,
    region: row.region || undefined,
    grape: row.grape || undefined,
    type: row.type || undefined,
    vintage: row.vintage || undefined,
    foodPairings: row.food_pairings,
    sourceLabel: row.source_label || "Delad katalog",
    sourceConfidence: (row.source_confidence as ProductCatalogEntry["sourceConfidence"]) || "high",
  };
}

function mapEntryToCatalogInsert(entry: ProductCatalogEntry, userId?: string | null): ProductCatalogWineInsert {
  return {
    barcode: entry.barcode?.trim() || null,
    systembolaget_product_id: entry.systembolagetProductId?.trim() || null,
    name: entry.name.trim(),
    producer: entry.producer?.trim() || null,
    country: entry.country?.trim() || null,
    region: entry.region?.trim() || null,
    grape: entry.grape?.trim() || null,
    type: entry.type?.trim() || null,
    vintage: entry.vintage ?? null,
    food_pairings: entry.foodPairings ?? [],
    source_label: entry.sourceLabel,
    source_confidence: entry.sourceConfidence ?? "high",
    created_by: userId ?? null,
  };
}

async function findExistingManualCatalogEntryId(payload: ProductCatalogWineInsert) {
  let query = supabase.from("product_catalog_wines").select("id").eq("name", payload.name).limit(1);

  query = applyNullableEqualityFilter(query, "producer", payload.producer ?? null);
  query = applyNullableEqualityFilter(query, "country", payload.country ?? null);
  query = applyNullableEqualityFilter(query, "region", payload.region ?? null);
  query = applyNullableEqualityFilter(query, "grape", payload.grape ?? null);
  query = applyNullableEqualityFilter(query, "type", payload.type ?? null);
  query = applyNullableEqualityFilter(query, "vintage", payload.vintage ?? null);

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id as string;
}

function applyNullableEqualityFilter<TQuery extends { eq: (column: string, value: any) => TQuery; is: (column: string, value: null) => TQuery }>(
  query: TQuery,
  column: string,
  value: string | number | null
) {
  if (value === null) {
    return query.is(column, null);
  }

  return query.eq(column, value);
}

function escapeFilterValue(value: string) {
  return value.replace(/,/g, "\\,");
}

export async function saveOcrTextForCatalogEntry(catalogId: string, ocrText: string) {
  await supabase.rpc("set_image_ocr_text", { wine_id: catalogId, ocr_text: ocrText });
}
