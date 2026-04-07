import { Pressable, Text } from "react-native";

import { buildWsetSummary, type WsetTastingData } from "../lib/wset-data";
import type { WineDraft } from "../types/cellar-drafts";
import { DateInput, LabeledInput, SuggestionRow } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function TastingFields({ styles, draft, tastingDate, tastingRating, wsetData, onDraftChange, onTastingDateChange, onTastingRatingChange, onOpenWset }: {
  styles: SharedStyles; draft: WineDraft; tastingDate: string; tastingRating: string; wsetData: WsetTastingData | null;
  onDraftChange: (patch: Partial<WineDraft>) => void; onTastingDateChange: (v: string) => void; onTastingRatingChange: (v: string) => void; onOpenWset: () => void;
}) {
  return (
    <>
      <DateInput label="Provningsdatum" value={tastingDate} onChangeText={onTastingDateChange} />
      {wsetData ? (
        <Pressable onPress={onOpenWset} style={styles.importSuggestionCard}>
          <Text style={styles.inputLabel}>WSET Tasting</Text>
          <Text style={styles.notesText}>{buildWsetSummary(wsetData)}</Text>
          <Text style={styles.linkText}>Edit</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onOpenWset} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>WSET Tasting</Text>
        </Pressable>
      )}
      <SuggestionRow title="Betyg" options={["1", "2", "3", "4", "5"]} selected={tastingRating} onSelect={onTastingRatingChange} />
      <LabeledInput label="Smaknotering" value={draft.notes} onChangeText={(value) => onDraftChange({ notes: value })} placeholder="t.ex. mörk frukt, bra syra, gärna igen" multiline />
    </>
  );
}
