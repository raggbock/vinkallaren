import { FOOD_CATEGORIES, mergeTagText, parseTags } from "../lib/cellar-helpers";
import type { StorageSpaceRow } from "../types/storage-space";
import type { StorageSpaceDraft, WineDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";
import { DateInput, DoubleRow, GroupedSuggestionRow, LabeledInput } from "./form-controls";
import { AddDishInline } from "./add-dish-inline";
import { StorageSpaceManager } from "./storage-space-manager";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function CellarFields({ styles, draft, storageSpaces, wines, storageSpaceDraft, savingStorageSpace, onStorageSpaceDraftChange, onSaveStorageSpace, onDraftChange, onPositionChange, userDishGroups, userCategories, onAddUserDish }: {
  styles: SharedStyles;
  draft: WineDraft;
  storageSpaces: StorageSpaceRow[];
  wines: WineRecord[];
  storageSpaceDraft: StorageSpaceDraft;
  savingStorageSpace: boolean;
  onStorageSpaceDraftChange: (patch: Partial<StorageSpaceDraft>) => void;
  onSaveStorageSpace: () => void;
  onDraftChange: (patch: Partial<WineDraft>) => void;
  onPositionChange: (spaceId: string, row: string, slot: string) => void;
  userDishGroups: Array<{ label: string; items: string[] }>;
  userCategories: string[];
  onAddUserDish: (name: string, category: string | null) => void;
}) {
  return (
    <>
      <DoubleRow>
        <LabeledInput label="Drick senast (år)" value={draft.drinkBy} onChangeText={(value) => onDraftChange({ drinkBy: value })} keyboardType="number-pad" placeholder="t.ex. 2028" />
        <DateInput label="Inköpt" value={draft.acquiredAt} onChangeText={(value) => onDraftChange({ acquiredAt: value })} />
      </DoubleRow>
      <GroupedSuggestionRow title="Matförslag" groups={[...FOOD_CATEGORIES, ...userDishGroups]} selected={parseTags(draft.foodPairings)} onSelect={(pairing) => onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, pairing) })} />
      <AddDishInline userCategories={userCategories} onAdd={(name, category) => { onAddUserDish(name, category); onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, name) }); }} />
      <LabeledInput label="Passar till" value={draft.foodPairings} onChangeText={(value) => onDraftChange({ foodPairings: value })} placeholder="lamm, ost, svamp, fisk" />
      <StorageSpaceManager
        styles={styles}
        storageSpaces={storageSpaces}
        wines={wines}
        storageSpaceDraft={storageSpaceDraft}
        savingStorageSpace={savingStorageSpace}
        onStorageSpaceDraftChange={onStorageSpaceDraftChange}
        onSaveStorageSpace={onSaveStorageSpace}
        onPositionChange={onPositionChange}
      />
      <LabeledInput label="Fri platsnotering" value={draft.location} onChangeText={(value) => onDraftChange({ location: value })} placeholder="t.ex. längst bak, överst i kylen" />
    </>
  );
}
