import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { WineDraft } from "../types/cellar-drafts";
import { LabeledInput } from "./form-controls";
import type { ProductCatalogWineRow } from "../types/product-catalog";
import { colors } from "../styles/theme";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function QuickImportSection({ styles, draft, isDesktopWeb, lookupBusy, lookupMessage, selectedCatalogNameEntry, onBarcodeChange, onArticleNumberChange, onStartBarcodeScanner, onScanLabel, onOpenSystembolaget }: {
  styles: SharedStyles; draft: WineDraft; isDesktopWeb: boolean;
  lookupBusy: boolean; lookupMessage: string; selectedCatalogNameEntry: ProductCatalogWineRow | null;
  onBarcodeChange: (value: string) => void; onArticleNumberChange: (value: string) => void;
  onStartBarcodeScanner: () => void; onScanLabel: () => void; onOpenSystembolaget: (productId: string) => void;
}) {
  const isLockedByCatalog = (field: keyof ProductCatalogWineRow) => {
    if (!selectedCatalogNameEntry) return false;
    const value = selectedCatalogNameEntry[field];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== "";
  };

  return (
    <>
      <View style={styles.importSuggestionCard}>
        <Text style={styles.inputLabel}>Snabbimport</Text>
        {!draft.name.trim() ? (
          <EmptyNamePrompt styles={styles} isDesktopWeb={isDesktopWeb} onStartBarcodeScanner={onStartBarcodeScanner} onScanLabel={onScanLabel} />
        ) : (
          <HasNamePrompt styles={styles} isDesktopWeb={isDesktopWeb} onStartBarcodeScanner={onStartBarcodeScanner} onScanLabel={onScanLabel} />
        )}
        <LabeledInput label="Streckkod" value={draft.barcode} onChangeText={onBarcodeChange} editable={!isLockedByCatalog("barcode")} />
        <LabeledInput label="Systembolaget artikelnummer" value={draft.systembolagetProductId} onChangeText={onArticleNumberChange} placeholder="t.ex. 12345" editable={!isLockedByCatalog("systembolaget_product_id")} />
      </View>

      <LookupStatus styles={styles} lookupBusy={lookupBusy} lookupMessage={lookupMessage} />

      {draft.systembolagetProductId ? (
        <Pressable onPress={() => onOpenSystembolaget(draft.systembolagetProductId)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Öppna hos Systembolaget</Text>
        </Pressable>
      ) : null}

    </>
  );
}

function EmptyNamePrompt({ styles, isDesktopWeb, onStartBarcodeScanner, onScanLabel }: {
  styles: SharedStyles; isDesktopWeb: boolean; onStartBarcodeScanner: () => void; onScanLabel: () => void;
}) {
  if (isDesktopWeb) {
    return <Text style={styles.notesText}>Fyll i streckkod eller artikelnummer för att hämta vindata automatiskt.</Text>;
  }
  return (
    <>
      <Text style={styles.notesText}>Har du flaskan? Skanna för att fylla i automatiskt.</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Pressable onPress={onStartBarcodeScanner} style={[styles.primaryButton, { flex: 1 }]}>
          <Text style={styles.primaryButtonText}>Skanna streckkod</Text>
        </Pressable>
        <Pressable onPress={onScanLabel} style={[styles.primaryButton, { flex: 1 }]}>
          <Text style={styles.primaryButtonText}>Skanna etikett</Text>
        </Pressable>
      </View>
      <Text style={styles.notesText}>Eller fyll i streckkod / artikelnummer manuellt:</Text>
    </>
  );
}

function HasNamePrompt({ styles, isDesktopWeb, onStartBarcodeScanner, onScanLabel }: {
  styles: SharedStyles; isDesktopWeb: boolean; onStartBarcodeScanner: () => void; onScanLabel: () => void;
}) {
  return (
    <>
      <Text style={styles.notesText}>Har du en streckkod eller ett Systembolaget-artikelnummer? Fyll i det så försöker vi hämta resten automatiskt.</Text>
      {!isDesktopWeb && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={onStartBarcodeScanner} style={[styles.secondaryButton, { flex: 1 }]}>
            <Text style={styles.secondaryButtonText}>Skanna streckkod</Text>
          </Pressable>
          <Pressable onPress={onScanLabel} style={[styles.secondaryButton, { flex: 1 }]}>
            <Text style={styles.secondaryButtonText}>Skanna etikett</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

function LookupStatus({ styles, lookupBusy, lookupMessage }: {
  styles: SharedStyles; lookupBusy: boolean; lookupMessage: string;
}) {
  return (
    <>
      {lookupBusy ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 }}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.notesText}>{lookupMessage || "Söker efter produktdata..."}</Text>
        </View>
      ) : null}
      {!lookupBusy && lookupMessage ? <Text style={styles.notesText}>{lookupMessage}</Text> : null}
    </>
  );
}
