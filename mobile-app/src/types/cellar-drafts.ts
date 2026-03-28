export type WineDraft = {
  name: string;
  producer: string;
  country: string;
  region: string;
  grape: string;
  vintage: string;
  quantity: string;
  type: string;
  drinkBy: string;
  location: string;
  storageSpaceId: string;
  storageRow: string;
  storageSlot: string;
  barcode: string;
  systembolagetProductId: string;
  tags: string;
  foodPairings: string;
  notes: string;
  imageUri: string;
};

export type StorageSpaceDraft = {
  name: string;
  spaceType: string;
  rowCount: string;
  slotsPerRow: string;
  notes: string;
};

export type CatalogEditorDraft = {
  id: string;
  barcode: string;
  systembolagetProductId: string;
  name: string;
  producer: string;
  country: string;
  region: string;
  grape: string;
  type: string;
  vintage: string;
  foodPairings: string;
  sourceLabel: string;
  sourceConfidence: string;
};

export type ImportFieldSelection = {
  name: boolean;
  producer: boolean;
  country: boolean;
  region: boolean;
  vintage: boolean;
  grape: boolean;
  type: boolean;
  foodPairings: boolean;
  systembolagetProductId: boolean;
  barcode: boolean;
};

export type ImportMode = "custom" | "all" | "empty";

export const defaultDraft: WineDraft = {
  name: "",
  producer: "",
  country: "",
  region: "",
  grape: "",
  vintage: "",
  quantity: "1",
  type: "Rött",
  drinkBy: "",
  location: "",
  storageSpaceId: "",
  storageRow: "1",
  storageSlot: "1",
  barcode: "",
  systembolagetProductId: "",
  tags: "",
  foodPairings: "",
  notes: "",
  imageUri: "",
};

export const defaultStorageSpaceDraft: StorageSpaceDraft = {
  name: "",
  spaceType: "kallare",
  rowCount: "6",
  slotsPerRow: "6",
  notes: "",
};

export const defaultImportSelection: ImportFieldSelection = {
  name: true,
  producer: true,
  country: true,
  region: true,
  vintage: true,
  grape: true,
  type: true,
  foodPairings: true,
  systembolagetProductId: true,
  barcode: true,
};
