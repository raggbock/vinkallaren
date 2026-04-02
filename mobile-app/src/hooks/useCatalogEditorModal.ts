import { useCallback, useState } from "react";
import { showError } from "../lib/show-error";
import type { CatalogEditorDraft } from "../types/cellar-drafts";
import { saveCatalogEditorEntry, deleteCatalogEntryById } from "../lib/cellar-actions";

type Deps = {
  fetchCatalogEntries: () => Promise<void>;
};

export function useCatalogEditorModal(deps: Deps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<CatalogEditorDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const open = useCallback((d: CatalogEditorDraft) => {
    setDraft(d);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setDraft(null);
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    const result = await saveCatalogEditorEntry(draft);
    if (result.error) { showError("Kunde inte spara ändringen", result.error); setSaving(false); return; }
    setVisible(false);
    setDraft(null);
    await deps.fetchCatalogEntries();
    setSaving(false);
  }, [draft, deps.fetchCatalogEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    setSaving(true);
    const result = await deleteCatalogEntryById(id);
    if (result.error) { showError("Kunde inte ta bort produkt", result.error); setSaving(false); return; }
    if (draft?.id === id) { setVisible(false); setDraft(null); }
    await deps.fetchCatalogEntries();
    setSaving(false);
  }, [draft?.id, deps.fetchCatalogEntries]);

  const onChange = useCallback((patch: Partial<CatalogEditorDraft>) => {
    setDraft((c) => (c ? { ...c, ...patch } : c));
  }, []);

  const modalProps = {
    visible,
    draft,
    saving,
    onClose: close,
    onSave: save,
    onChange,
  };

  return { actions: { open, deleteEntry }, modalProps };
}
