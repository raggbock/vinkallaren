import { useCallback, useState } from "react";
import { showError } from "../lib/show-error";
import { hydrateWineHistoryRecords } from "../lib/wine-helpers";
import type { WineDraft } from "../types/cellar-drafts";
import type { WsetTastingData } from "../lib/wset-data";
import type { WineHistoryRecord } from "../types/wine-history";
import { saveTastingEntry } from "../lib/cellar-actions";

type Deps = {
  userId: string;
  draft: WineDraft;
  resetDraft: () => void;
  setHistoryEntries: React.Dispatch<React.SetStateAction<WineHistoryRecord[]>>;
  showSuccess: (key: string) => void;
};

export function useAddWineTasting(deps: Deps) {
  const [tastingMode, setTastingMode] = useState(false);
  const [rating, setRating] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [wsetData, setWsetData] = useState<WsetTastingData | null>(null);
  const [wsetVisible, setWsetVisible] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    const result = await saveTastingEntry({ userId: deps.userId, draft: deps.draft, tastingRating: rating, tastingDate: date, wsetData });
    if (result.error) { showError("Kunde inte spara", result.error); setSaving(false); return; }
    deps.resetDraft();
    setRating("");
    setWsetData(null);
    setDate(new Date().toISOString().slice(0, 10));
    const [hydrated] = await hydrateWineHistoryRecords([result.data!]);
    deps.setHistoryEntries(prev => [hydrated, ...prev]);
    deps.showSuccess("tasting_saved");
    setSaving(false);
  }, [deps, rating, date, wsetData]);

  const panelProps = {
    tastingMode,
    onTastingModeChange: setTastingMode,
    tastingRating: rating,
    onTastingRatingChange: setRating,
    tastingDate: date,
    onTastingDateChange: setDate,
    onSaveTasting: save,
    savingTasting: saving,
    wsetData,
    onOpenWset: useCallback(() => setWsetVisible(true), []),
  };

  const wsetProps = {
    visible: wsetVisible,
    initialData: wsetData,
    onSave: useCallback((d: WsetTastingData) => { setWsetData(d); setWsetVisible(false); }, []),
    onClose: useCallback(() => setWsetVisible(false), []),
  };

  return { panelProps, wsetProps };
}
