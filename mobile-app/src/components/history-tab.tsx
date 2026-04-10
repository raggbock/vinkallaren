import { lazy, Suspense, useCallback, useState } from "react";
import { HistoryPanel } from "./cellar-sections";
import { updateHistoryEntry } from "../lib/cellar-actions";
import { showError } from "../lib/show-error";
import { useCellar } from "../contexts/CellarContext";
import { SuccessOverlay, useSuccessOverlay } from "./success-overlay";
import { styles } from "../styles/theme";
import type { WineHistoryRecord } from "../types/wine-history";
import type { TastingSessionRow } from "../types/tasting-session";
import type { useHistory } from "../hooks/useHistory";

const EditHistoryModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.EditHistoryModal })));

type HistoryData = ReturnType<typeof useHistory>;

type Props = {
  hidden: boolean;
  historyData: HistoryData;
  endedSessions: TastingSessionRow[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenProfile: () => void;
};

export function HistoryTab({ hidden, historyData, endedSessions, refreshing, onRefresh, onOpenProfile }: Props) {
  const { storageSpaceById } = useCellar();
  const [editingHistory, setEditingHistory] = useState<WineHistoryRecord | null>(null);
  const [editHistorySaving, setEditHistorySaving] = useState(false);
  const success = useSuccessOverlay();

  const handleSaveHistoryEdit = useCallback(async (fields: { rating: string; notes: string; date: string; quantity: string }) => {
    if (!editingHistory) return;
    setEditHistorySaving(true);
    const result = await updateHistoryEntry({
      id: editingHistory.id,
      rating: fields.rating ? Number(fields.rating) : null,
      tasting_notes: fields.notes.trim() || null,
      consumed_at: fields.date,
      quantity_consumed: Math.max(1, Number(fields.quantity) || 1),
    });
    setEditHistorySaving(false);
    if (result.error) { showError("Kunde inte spara ändringen", result.error); return; }
    historyData.setHistoryEntries((prev) => prev.map((e) => (e.id === editingHistory.id ? { ...e, ...result.data! } : e)));
    setEditingHistory(null);
    success.show("history_edited");
  }, [editingHistory, historyData, success]);

  if (hidden) return null;

  return (
    <>
      <HistoryPanel
        styles={styles}
        historyEntries={historyData.historyEntries}
        loadingHistory={historyData.loadingHistory}
        storageSpaceById={storageSpaceById}
        endedSessions={endedSessions}
        refreshing={refreshing}
        onRefresh={onRefresh}
        hasMore={historyData.hasMoreHistory}
        onLoadMore={historyData.fetchMoreHistory}
        onEditEntry={setEditingHistory}
        onOpenProfile={onOpenProfile}
      />
      <Suspense fallback={null}>
        <EditHistoryModal
          visible={editingHistory !== null}
          styles={styles}
          entry={editingHistory}
          saving={editHistorySaving}
          onClose={() => setEditingHistory(null)}
          onSave={handleSaveHistoryEdit}
        />
      </Suspense>
      <SuccessOverlay config={success.config} onDone={success.clear} />
    </>
  );
}
