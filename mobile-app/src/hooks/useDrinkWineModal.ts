import { useCallback, useMemo, useState } from "react";
import { showError } from "../lib/show-error";
import { hydrateWineHistoryRecords } from "../lib/wine-helpers";
import type { WineRecord } from "../types/wine";
import type { WineHistoryRecord } from "../types/wine-history";
import type { WsetTastingData } from "../lib/wset-data";
import { saveDrinkEntry } from "../lib/cellar-actions";

type Deps = {
  userId: string;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  showSuccess: (key: string) => void;
  pickImageFromLibrary: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
  onCellarMutated: (opts?: { spaceIds?: Array<string | null> }) => Promise<void>;
};

export function useDrinkWineModal(deps: Deps) {
  const [visible, setVisible] = useState(false);
  const [wine, setWine] = useState<WineRecord | null>(null);
  const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [consumedDate, setConsumedDate] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [wsetData, setWsetData] = useState<WsetTastingData | null>(null);
  const [wsetVisible, setWsetVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = useCallback((w: WineRecord) => {
    setWine(w);
    setRating("");
    setNotes("");
    setConsumedDate(new Date().toISOString().slice(0, 10));
    setImageUri("");
    setWsetData(null);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    if (saving) return;
    setVisible(false);
    setWine(null);
  }, [saving]);

  const save = useCallback(async () => {
    if (!wine) return;
    setSaving(true);
    const result = await saveDrinkEntry({ userId: deps.userId, wine, rating, notes, consumedDate, imageUri, wsetData, setWines: deps.setWines });
    if (result.error) { showError("Kunde inte spara historiken", result.error); setSaving(false); return; }
    const [hydrated] = await hydrateWineHistoryRecords([result.data!]);
    deps.setHistoryEntries(prev => [hydrated, ...prev]);
    await deps.onCellarMutated({ spaceIds: [wine.storage_space_id ?? null] });
    setVisible(false);
    setWine(null);
    deps.showSuccess("wine_drunk");
    setSaving(false);
  }, [wine, rating, notes, consumedDate, imageUri, wsetData, deps]);

  const chooseImage = useCallback(async () => {
    const uri = await deps.pickImageFromLibrary();
    if (uri) setImageUri(uri);
  }, [deps.pickImageFromLibrary]);

  const takePhoto = useCallback(async () => {
    const uri = await deps.takePhoto();
    if (uri) setImageUri(uri);
  }, [deps.takePhoto]);

  const onOpenWset = useCallback(() => setWsetVisible(true), []);
  const onWsetSave = useCallback((d: WsetTastingData) => { setWsetData(d); setWsetVisible(false); }, []);
  const onWsetClose = useCallback(() => setWsetVisible(false), []);

  const modalProps = useMemo(() => ({
    visible, wine, rating, notes, consumedDate, imageUri, saving, wsetData,
    onOpenWset, onClose: close, onRatingChange: setRating, onNotesChange: setNotes,
    onConsumedDateChange: setConsumedDate, onChooseImage: chooseImage, onTakePhoto: takePhoto, onConfirm: save,
  }), [visible, wine, rating, notes, consumedDate, imageUri, saving, wsetData, onOpenWset, close, chooseImage, takePhoto, save]);

  const wsetProps = useMemo(() => ({
    visible: wsetVisible, wineType: wine?.type || "", initialData: wsetData,
    onSave: onWsetSave, onClose: onWsetClose,
  }), [wsetVisible, wine?.type, wsetData, onWsetSave, onWsetClose]);

  return { actions: { open }, modalProps, wsetProps };
}
