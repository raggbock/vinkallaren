import { Text, View } from "react-native";

import { buildNumericOptions, getWineStoragePlacementLabel } from "../lib/cellar-helpers";
import { useStorageSelection } from "../hooks/useStorageSelection";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import { StorageSpaceForm, StorageSpaceSelector, SuggestionRow } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export interface StorageSpaceManagerProps {
  styles: SharedStyles;
  storageSpaces: StorageSpaceRow[];
  wines: WineRecord[];
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  onPositionChange: (spaceId: string, row: string, slot: string) => void;
}

export function StorageSpaceManager({
  styles,
  storageSpaces,
  wines,
  storageSpaceDraft,
  savingStorageSpace,
  onStorageSpaceDraftChange,
  onSaveStorageSpace,
  onPositionChange,
}: StorageSpaceManagerProps) {
  const storage = useStorageSelection(storageSpaces, wines);
  const storageSpaceById = new Map(storageSpaces.map((s) => [s.id, s]));
  const occupiedPositions = storage.getOccupiedPositions(
    storage.selectedStorageSpaceId,
    storage.selectedStorageRow,
  );

  function handleStorageSpaceChange(id: string) {
    storage.changeStorageSpace(id);
    const pos = id ? findFirstPos(id) : { row: "0", slot: "0" };
    onPositionChange(id, pos.row, pos.slot);
  }

  function findFirstPos(spaceId: string) {
    // After changeStorageSpace sets state, we compute the position the same way
    const space = storageSpaces.find((s) => s.id === spaceId);
    if (!space || space.row_count === 0) return { row: "0", slot: "0" };
    const occupied = new Set<string>();
    for (const w of wines) {
      if (w.storage_space_id !== spaceId) continue;
      if (w.storage_row != null && w.storage_slot != null) {
        occupied.add(`${w.storage_row}-${w.storage_slot}`);
      }
    }
    for (let r = 1; r <= space.row_count; r++) {
      for (let s = 1; s <= space.slots_per_row; s++) {
        if (!occupied.has(`${r}-${s}`)) return { row: String(r), slot: String(s) };
      }
    }
    return { row: "1", slot: "1" };
  }

  function handleRowChange(value: string) {
    storage.changeStorageRow(value);
    onPositionChange(storage.selectedStorageSpaceId, value, "1");
  }

  function handleSlotChange(value: string) {
    storage.setSelectedStorageSlot(value);
    onPositionChange(storage.selectedStorageSpaceId, storage.selectedStorageRow, value);
  }

  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>Förvaringsplats</Text>
      {storageSpaces.length > 0 ? (
        <>
          <StorageSpaceSelector
            title=""
            spaces={storageSpaces}
            selectedId={storage.selectedStorageSpaceId}
            onSelect={handleStorageSpaceChange}
            clearLabel="Ingen plats"
          />
          {storage.selectedStorageSpace && storage.selectedStorageSpace.row_count > 0 ? (
            <>
              <SuggestionRow
                title="Rad"
                options={buildNumericOptions(storage.selectedStorageSpace.row_count)}
                selected={storage.selectedStorageRow}
                onSelect={handleRowChange}
                disabledOptions={occupiedPositions.occupiedRows}
              />
              <SuggestionRow
                title="Plats"
                options={buildNumericOptions(storage.selectedStorageSpace.slots_per_row)}
                selected={storage.selectedStorageSlot}
                onSelect={handleSlotChange}
                disabledOptions={occupiedPositions.occupiedSlots}
              />
              <Text style={styles.notesText}>
                Vald placering:{" "}
                {getWineStoragePlacementLabel(
                  {
                    storage_space_id: storage.selectedStorageSpaceId,
                    storage_row: Number(storage.selectedStorageRow),
                    storage_slot: Number(storage.selectedStorageSlot),
                  },
                  storageSpaceById,
                )}
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.notesText}>
          Skapa en förvaringsplats för att kunna välja rad och plats.
        </Text>
      )}
      <StorageSpaceForm
        draft={storageSpaceDraft}
        saving={savingStorageSpace}
        onDraftChange={onStorageSpaceDraftChange}
        onSave={onSaveStorageSpace}
      />
    </View>
  );
}
