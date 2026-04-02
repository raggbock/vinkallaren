import { useCallback, useState } from "react";
import { showError } from "../lib/show-error";
import type { WineRecord } from "../types/wine";
import type { WsatTastingData } from "../lib/wsat-data";
import { saveDrinkEntry } from "../lib/cellar-actions";

type Deps = {
  userId: string;
  fetchHistoryEntries: () => Promise<void>;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  showSuccess: (key: string) => void;
  pickImageFromLibrary: () => Promise<string | null>;
  takePhoto: () => Promise<string | null>;
};

export function useDrinkWineModal(deps: Deps) {
  const [visible, setVisible] = useState(false);
  const [wine, setWine] = useState<WineRecord | null>(null);
  const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [consumedDate, setConsumedDate] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [wsatData, setWsatData] = useState<WsatTastingData | null>(null);
  const [wsatVisible, setWsatVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = useCallback((w: WineRecord) => {
    setWine(w);
    setRating("");
    setNotes("");
    setConsumedDate(new Date().toISOString().slice(0, 10));
    setImageUri("");
    setWsatData(null);
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
    const result = await saveDrinkEntry({ userId: deps.userId, wine, rating, notes, consumedDate, imageUri, wsatData, setWines: deps.setWines });
    if (result.error) { showError("Kunde inte spara historiken", result.error); setSaving(false); return; }
    await deps.fetchHistoryEntries();
    setVisible(false);
    setWine(null);
    deps.showSuccess("wine_drunk");
    setSaving(false);
  }, [wine, rating, notes, consumedDate, imageUri, wsatData, deps]);

  const chooseImage = useCallback(async () => {
    const uri = await deps.pickImageFromLibrary();
    if (uri) setImageUri(uri);
  }, [deps.pickImageFromLibrary]);

  const takePhoto = useCallback(async () => {
    const uri = await deps.takePhoto();
    if (uri) setImageUri(uri);
  }, [deps.takePhoto]);

  const modalProps = {
    visible,
    wine,
    rating,
    notes,
    consumedDate,
    imageUri,
    saving,
    wsatData,
    onOpenWsat: useCallback(() => setWsatVisible(true), []),
    onClose: close,
    onRatingChange: setRating,
    onNotesChange: setNotes,
    onConsumedDateChange: setConsumedDate,
    onChooseImage: chooseImage,
    onTakePhoto: takePhoto,
    onConfirm: save,
  };

  const wsatProps = {
    visible: wsatVisible,
    wineType: wine?.type || "",
    initialData: wsatData,
    onSave: useCallback((d: WsatTastingData) => { setWsatData(d); setWsatVisible(false); }, []),
    onClose: useCallback(() => setWsatVisible(false), []),
  };

  return { actions: { open }, modalProps, wsatProps };
}
