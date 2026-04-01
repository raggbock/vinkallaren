import { useEffect, useRef, useState } from "react";
import type { StorageSpaceRow } from "../types/storage-space";
import type { WineRecord } from "../types/wine";

export type OccupiedPositions = {
  occupiedRows: Set<string>;
  occupiedSlots: Set<string>;
};

export function useStorageSelection(storageSpaces: StorageSpaceRow[], wines: WineRecord[]) {
  const [selectedStorageSpaceId, setSelectedStorageSpaceId] = useState("");
  const [selectedStorageRow, setSelectedStorageRow] = useState("1");
  const [selectedStorageSlot, setSelectedStorageSlot] = useState("1");

  const storageAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!storageAutoSelectedRef.current && storageSpaces.length > 0 && !selectedStorageSpaceId) {
      setSelectedStorageSpaceId(storageSpaces[0].id);
      setSelectedStorageRow("1");
      setSelectedStorageSlot("1");
      storageAutoSelectedRef.current = true;
    }
  }, [storageSpaces]);

  useEffect(() => {
    if (!selectedStorageSpaceId) return;
    const space = storageSpaces.find((s) => s.id === selectedStorageSpaceId);
    if (!space) return;
    if (space.row_count === 0) { setSelectedStorageRow("0"); setSelectedStorageSlot("0"); return; }
    const row = Number(selectedStorageRow);
    const slot = Number(selectedStorageSlot);
    if (!Number.isFinite(row) || row < 1 || row > space.row_count) setSelectedStorageRow("1");
    if (!Number.isFinite(slot) || slot < 1 || slot > space.slots_per_row) setSelectedStorageSlot("1");
  }, [selectedStorageRow, selectedStorageSlot, selectedStorageSpaceId, storageSpaces]);

  const selectedStorageSpace = storageSpaces.find((s) => s.id === selectedStorageSpaceId) ?? null;

  function findFirstAvailable(spaceId: string, excludeWineId?: string): { row: string; slot: string } {
    const space = storageSpaces.find((s) => s.id === spaceId);
    if (!space || space.row_count === 0) return { row: "0", slot: "0" };
    const occupied = new Set<string>();
    for (const w of wines) {
      if (w.storage_space_id !== spaceId || w.id === excludeWineId) continue;
      if (w.storage_row != null && w.storage_slot != null) occupied.add(`${w.storage_row}-${w.storage_slot}`);
    }
    for (let r = 1; r <= space.row_count; r++) {
      for (let s = 1; s <= space.slots_per_row; s++) {
        if (!occupied.has(`${r}-${s}`)) return { row: String(r), slot: String(s) };
      }
    }
    return { row: "1", slot: "1" };
  }

  function changeStorageSpace(spaceId: string) {
    setSelectedStorageSpaceId(spaceId);
    const pos = findFirstAvailable(spaceId);
    setSelectedStorageRow(pos.row);
    setSelectedStorageSlot(pos.slot);
  }

  function changeStorageRow(value: string) {
    setSelectedStorageRow(value);
    setSelectedStorageSlot("1");
  }

  function getOccupiedPositions(spaceId: string, selectedRow: string, excludeWineId?: string): OccupiedPositions {
    const occupiedRows = new Set<string>();
    const occupiedSlots = new Set<string>();
    if (!spaceId) return { occupiedRows, occupiedSlots };
    const space = storageSpaces.find((s) => s.id === spaceId);
    if (!space) return { occupiedRows, occupiedSlots };

    const rowSlotCounts = new Map<number, number>();
    for (const w of wines) {
      if (w.storage_space_id !== spaceId || w.id === excludeWineId) continue;
      if (w.storage_row != null) {
        rowSlotCounts.set(w.storage_row, (rowSlotCounts.get(w.storage_row) || 0) + 1);
      }
      if (w.storage_row === Number(selectedRow) && w.storage_slot != null) {
        occupiedSlots.add(String(w.storage_slot));
      }
    }
    for (const [row, count] of rowSlotCounts) {
      if (count >= space.slots_per_row) occupiedRows.add(String(row));
    }
    return { occupiedRows, occupiedSlots };
  }

  return {
    selectedStorageSpaceId, setSelectedStorageSpaceId,
    selectedStorageRow, setSelectedStorageRow,
    selectedStorageSlot, setSelectedStorageSlot,
    selectedStorageSpace,
    changeStorageSpace,
    changeStorageRow,
    getOccupiedPositions,
  };
}
