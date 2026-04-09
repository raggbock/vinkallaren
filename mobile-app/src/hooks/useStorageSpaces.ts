import { useEffect, useState } from "react";
import { showError } from "../lib/show-error";
import { supabase } from "../lib/supabase";
import { emptyToNull } from "../lib/cellar-helpers";
import { defaultStorageSpaceDraft, type StorageSpaceDraft } from "../types/cellar-drafts";
import type { StorageSpaceInsert, StorageSpaceRow } from "../types/storage-space";

export function useStorageSpaces(userId: string) {
  const [storageSpaces, setStorageSpaces] = useState<StorageSpaceRow[]>([]);
  const [loadingStorageSpaces, setLoadingStorageSpaces] = useState(true);
  const [storageSpaceDraft, setStorageSpaceDraft] = useState<StorageSpaceDraft>(defaultStorageSpaceDraft);
  const [savingStorageSpace, setSavingStorageSpace] = useState(false);

  async function fetchStorageSpaces() {
    setLoadingStorageSpaces(true);
    const { data, error } = await supabase.from("storage_spaces").select("*").order("created_at", { ascending: true });
    if (error) { showError("Kunde inte hämta förvaringsplatser", error.message); setLoadingStorageSpaces(false); return; }
    setStorageSpaces((data ?? []) as StorageSpaceRow[]);
    setLoadingStorageSpaces(false);
  }

  useEffect(() => { void fetchStorageSpaces(); }, []);

  async function saveStorageSpace(): Promise<string | null> {
    if (!storageSpaceDraft.name.trim()) {
      showError("Namn saknas", "Skriv in namnet på förvaringsplatsen.");
      return null;
    }
    const rowCount = Number(storageSpaceDraft.rowCount);
    const slotsPerRow = Number(storageSpaceDraft.slotsPerRow);
    if (!Number.isFinite(rowCount) || rowCount < 0 || !Number.isFinite(slotsPerRow) || slotsPerRow < 0) {
      showError("Ogiltiga mått", "Ange antal rader och platser per rad.");
      return null;
    }
    setSavingStorageSpace(true);
    try {
      const payload: StorageSpaceInsert = {
        user_id: userId, name: storageSpaceDraft.name.trim(),
        space_type: storageSpaceDraft.spaceType.trim() || "kallare",
        row_count: rowCount, slots_per_row: slotsPerRow,
        notes: emptyToNull(storageSpaceDraft.notes),
      };
      const { data, error } = await supabase.from("storage_spaces").insert(payload).select("*").single();
      if (error) throw error;
      setStorageSpaceDraft(defaultStorageSpaceDraft);
      await fetchStorageSpaces();
      return data?.id ?? null;
    } catch (error) {
      showError("Kunde inte spara platsen", error instanceof Error ? error.message : "Försök igen.");
      return null;
    } finally {
      setSavingStorageSpace(false);
    }
  }

  async function updateStorageSpace(id: string, patch: { name?: string; space_type?: string; row_count?: number; slots_per_row?: number; notes?: string | null }) {
    const { error } = await supabase.from("storage_spaces").update(patch).eq("id", id);
    if (error) { showError("Kunde inte uppdatera platsen", error.message); return; }
    await fetchStorageSpaces();
  }

  async function deleteStorageSpace(id: string): Promise<boolean> {
    const { error } = await supabase.from("storage_spaces").delete().eq("id", id);
    if (error) { showError("Kunde inte ta bort platsen", error.message); return false; }
    await fetchStorageSpaces();
    return true;
  }

  return {
    storageSpaces, loadingStorageSpaces,
    storageSpaceDraft, setStorageSpaceDraft, savingStorageSpace,
    fetchStorageSpaces, saveStorageSpace, updateStorageSpace, deleteStorageSpace,
  };
}
