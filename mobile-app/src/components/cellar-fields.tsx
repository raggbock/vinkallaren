import { Text, View } from "react-native";

import { buildNumericOptions, FOOD_CATEGORIES, getWineStoragePlacementLabel, mergeTagText, parseTags } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import { DateInput, DoubleRow, GroupedSuggestionRow, LabeledInput, StorageSpaceForm, StorageSpaceSelector, SuggestionRow } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function CellarFields({ styles, draft, storageSpaces, selectedStorageSpace, selectedStorageSpaceId, selectedStorageRow, selectedStorageSlot, storageSpaceById, occupiedPositions, storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace, onDraftChange, onStorageSpaceChange, onStorageRowChange, onStorageSlotChange }: {
  styles: SharedStyles; draft: WineDraft; storageSpaces: StorageSpaceRow[]; selectedStorageSpace?: StorageSpaceRow | null;
  selectedStorageSpaceId: string; selectedStorageRow: string; selectedStorageSlot: string;
  storageSpaceById: Map<string, StorageSpaceRow>; occupiedPositions: { occupiedRows: Set<string>; occupiedSlots: Set<string> };
  storageSpaceDraft: StorageSpaceDraft; savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void; onSaveStorageSpace: () => void;
  onDraftChange: (patch: Partial<WineDraft>) => void; onStorageSpaceChange: (id: string) => void; onStorageRowChange: (v: string) => void; onStorageSlotChange: (v: string) => void;
}) {
  return (
    <>
      <DoubleRow>
        <LabeledInput label="Drick senast (år)" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" placeholder="t.ex. 2028" />
        <DateInput label="Inköpt" value={draft.acquiredAt} onChangeText={(value) => onDraftChange({ acquiredAt: value })} />
      </DoubleRow>
      <GroupedSuggestionRow title="Matförslag" groups={FOOD_CATEGORIES} selected={parseTags(draft.foodPairings)} onSelect={(pairing) => onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, pairing) })} />
      <LabeledInput label="Passar till" value={draft.foodPairings} onChangeText={(value) => onDraftChange({ foodPairings: value })} placeholder="lamm, ost, svamp, fisk" />
      <StorageSection
        styles={styles} storageSpaces={storageSpaces} selectedStorageSpace={selectedStorageSpace}
        selectedStorageSpaceId={selectedStorageSpaceId} selectedStorageRow={selectedStorageRow} selectedStorageSlot={selectedStorageSlot}
        storageSpaceById={storageSpaceById} occupiedPositions={occupiedPositions} storageSpaceDraft={storageSpaceDraft}
        savingStorageSpace={savingStorageSpace} onStorageSpaceDraftChange={onStorageSpaceDraftChange} onSaveStorageSpace={onSaveStorageSpace}
        onStorageSpaceChange={onStorageSpaceChange} onStorageRowChange={onStorageRowChange} onStorageSlotChange={onStorageSlotChange}
      />
      <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} placeholder="t.ex. längst bak, överst i kylen" />
      <LabeledInput label="Etiketter" value={draft.tags} onChangeText={(value) => onDraftChange({ tags: value })} placeholder="middag, present, lagring" />
      <LabeledInput label="Anteckningar" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} multiline />
    </>
  );
}

function StorageSection({ styles, storageSpaces, selectedStorageSpace, selectedStorageSpaceId, selectedStorageRow, selectedStorageSlot, storageSpaceById, occupiedPositions, storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace, onStorageSpaceChange, onStorageRowChange, onStorageSlotChange }: {
  styles: SharedStyles; storageSpaces: StorageSpaceRow[]; selectedStorageSpace?: StorageSpaceRow | null;
  selectedStorageSpaceId: string; selectedStorageRow: string; selectedStorageSlot: string;
  storageSpaceById: Map<string, StorageSpaceRow>; occupiedPositions: { occupiedRows: Set<string>; occupiedSlots: Set<string> };
  storageSpaceDraft: StorageSpaceDraft; savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void; onSaveStorageSpace: () => void;
  onStorageSpaceChange: (id: string) => void; onStorageRowChange: (v: string) => void; onStorageSlotChange: (v: string) => void;
}) {
  return (
    <View style={styles.foodSection}>
      <Text style={styles.inputLabel}>Förvaringsplats</Text>
      {storageSpaces.length > 0 ? (
        <>
          <StorageSpaceSelector title="" spaces={storageSpaces} selectedId={selectedStorageSpaceId} onSelect={onStorageSpaceChange} clearLabel="Ingen plats" />
          {selectedStorageSpace && selectedStorageSpace.row_count > 0 ? (
            <>
              <SuggestionRow title="Rad" options={buildNumericOptions(selectedStorageSpace.row_count)} selected={selectedStorageRow} onSelect={onStorageRowChange} disabledOptions={occupiedPositions.occupiedRows} />
              <SuggestionRow title="Plats" options={buildNumericOptions(selectedStorageSpace.slots_per_row)} selected={selectedStorageSlot} onSelect={onStorageSlotChange} disabledOptions={occupiedPositions.occupiedSlots} />
              <Text style={styles.notesText}>Vald placering: {getWineStoragePlacementLabel({ storage_space_id: selectedStorageSpaceId, storage_row: Number(selectedStorageRow), storage_slot: Number(selectedStorageSlot) }, storageSpaceById)}</Text>
            </>
          ) : null}
        </>
      ) : (
        <Text style={styles.notesText}>Skapa en förvaringsplats för att kunna välja rad och plats.</Text>
      )}
      <StorageSpaceForm draft={storageSpaceDraft} saving={savingStorageSpace} onDraftChange={onStorageSpaceDraftChange} onSave={onSaveStorageSpace} />
    </View>
  );
}
