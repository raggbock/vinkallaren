import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { HistoryPanel } from "./cellar-sections";
import { updateHistoryEntry } from "../lib/cellar-actions";
import { showError } from "../lib/show-error";
import { useCellar } from "../contexts/CellarContext";
import { SuccessOverlay, useSuccessOverlay } from "./success-overlay";
import { styles } from "../styles/theme";
import type { WineHistoryRecord } from "../types/wine-history";
import type { TastingSessionRow } from "../types/tasting-session";

const EditHistoryModal = lazy(() => import("./cellar-workflows").then(m => ({ default: m.EditHistoryModal })));

type Props = {
  hidden: boolean;
  endedSessions: TastingSessionRow[];
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onOpenProfile: () => void;
};

export function HistoryTab({ hidden, endedSessions, refreshing, onRefresh, onOpenProfile }: Props) {
  const ctx = useCellar();
  useEffect(() => { void ctx.fetchHistoryEntries(); }, [ctx.fetchHistoryEntries]);
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
    ctx.setHistoryEntries((prev) => prev.map((e) => (e.id === editingHistory.id ? { ...e, ...result.data! } : e)));
    setEditingHistory(null);
    success.show("history_edited");
  }, [editingHistory, ctx, success]);

  if (hidden) return null;

  return (
    <>
      <HistoryPanel
        styles={styles}
        historyEntries={ctx.historyEntries}
        loadingHistory={ctx.historyLoading}
        storageSpaceById={ctx.storageSpaceById}
        endedSessions={endedSessions}
        refreshing={refreshing}
        onRefresh={onRefresh}
        hasMore={ctx.historyHasMore}
        onLoadMore={ctx.fetchMoreHistory}
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
