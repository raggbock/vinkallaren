import { useCallback, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import type { WineRecord } from "../types/wine";
import type { WineDraft } from "../types/cellar-drafts";
import type { StorageSpaceRow } from "../types/storage-space";
import { hydrateWineRecords, toWineDraft } from "../lib/wine-helpers";
import { saveWineEditEntry } from "../lib/cellar-actions";

type Deps = {
  userId: string;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  fetchCatalogEntries: () => Promise<void>;
  showSuccess: (key: string) => void;
  storageSpaces: StorageSpaceRow[];
  saveStorageSpace: () => Promise<string | null>;
  getOccupiedPositions: (spaceId: string, row: string, excludeWineId?: string) => { occupiedRows: Set<string>; occupiedSlots: Set<string> };
  pickImageFromLibrary: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
  onCellarMutated: (opts?: { spaceIds?: Array<string | null> }) => Promise<void>;
};

export function useEditWineModal(deps: Deps) {
  const [visible, setVisible] = useState(false);
  const [editingWine, setEditingWine] = useState<WineRecord | null>(null);
  const [draft, setDraft] = useState<WineDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const open = useCallback(async (wine: WineRecord) => {
    let fresh = wine;
    if (wine.image_path && !wine.image_url) {
      const [hydrated] = await hydrateWineRecords([wine as any]);
      fresh = hydrated;
    }
    setEditingWine(fresh);
    setDraft(toWineDraft(fresh));
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    if (saving) return;
    setVisible(false);
    setEditingWine(null);
    setDraft(null);
  }, [saving]);

  const save = useCallback(async () => {
    if (!editingWine || !draft) return;
    setSaving(true);
    const result = await saveWineEditEntry({ userId: deps.userId, editingWine, editWineDraft: draft, setWines: deps.setWines });
    if (result.error) { showError("Kunde inte spara ändringen", result.error); setSaving(false); return; }
    await deps.fetchCatalogEntries();
    const affectedSpaces: Array<string | null> = [
      editingWine.storage_space_id ?? null,
      draft.storageSpaceId || null,
    ];
    await deps.onCellarMutated({ spaceIds: affectedSpaces });
    setVisible(false);
    setEditingWine(null);
    setDraft(null);
    deps.showSuccess("edit_saved");
    setSaving(false);
  }, [editingWine, draft, deps]);

  const patchDraft = useCallback((patch: Partial<WineDraft>) => {
    setDraft((c) => (c ? { ...c, ...patch } : c));
  }, []);

  const selectedStorageSpace = deps.storageSpaces.find((s) => s.id === (draft?.storageSpaceId || "")) ?? null;
  const occupiedPositions = deps.getOccupiedPositions(draft?.storageSpaceId || "", draft?.storageRow || "1", editingWine?.id);

  const onStorageSpaceChange = useCallback((spaceId: string) => setDraft((c) => c ? { ...c, storageSpaceId: spaceId, storageRow: "1", storageSlot: "1" } : c), []);
  const onStorageRowChange = useCallback((value: string) => setDraft((c) => (c ? { ...c, storageRow: value, storageSlot: "1" } : c)), []);
  const onStorageSlotChange = useCallback((value: string) => setDraft((c) => (c ? { ...c, storageSlot: value } : c)), []);
  const onChooseImage = useCallback(async () => { const uri = await deps.pickImageFromLibrary(); if (uri) setDraft((c) => c ? { ...c, imageUri: uri } : c); }, [deps.pickImageFromLibrary]);
  const onTakePhoto = useCallback(async () => { const uri = await deps.takePhoto(); if (uri) setDraft((c) => c ? { ...c, imageUri: uri } : c); }, [deps.takePhoto]);
  const onRemoveImage = useCallback(() => setDraft((c) => c ? { ...c, imageUri: "" } : c), []);
  const onSaveStorageSpace = useCallback(async () => {
    const newId = await deps.saveStorageSpace();
    if (newId) setDraft((c) => c ? { ...c, storageSpaceId: newId, storageRow: "1", storageSlot: "1" } : c);
  }, [deps.saveStorageSpace]);

  const modalProps = useMemo(() => ({
    visible, draft, saving, selectedStorageSpace, occupiedPositions,
    onClose: close, onDraftChange: patchDraft, onStorageSpaceChange, onStorageRowChange,
    onStorageSlotChange, onChooseImage, onTakePhoto, onRemoveImage, onSaveStorageSpace, onSave: save,
  }), [visible, draft, saving, selectedStorageSpace, occupiedPositions, close, patchDraft,
    onStorageSpaceChange, onStorageRowChange, onStorageSlotChange, onChooseImage, onTakePhoto,
    onRemoveImage, onSaveStorageSpace, save]);

  return { actions: { open }, modalProps };
}
