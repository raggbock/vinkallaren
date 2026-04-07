import { Pressable, Text, View } from "react-native";

import type { ProductCatalogEntry } from "../lib/product-catalog";
import type { ImportFieldSelection, ImportMode } from "../types/cellar-drafts";
import { ImportSelectionRow } from "./form-controls";
import type { styles as themeStyles } from "../styles/theme";

type SharedStyles = typeof themeStyles;

export function CatalogImportCard({ styles, catalogSuggestion, importMode, importSelection, onSetImportMode, onApplyCatalogSuggestion, onToggleImportField }: {
  styles: SharedStyles; catalogSuggestion: ProductCatalogEntry; importMode: ImportMode; importSelection: ImportFieldSelection;
  onSetImportMode: (mode: ImportMode) => void; onApplyCatalogSuggestion: (mode: ImportMode) => void; onToggleImportField: (field: keyof ImportFieldSelection) => void;
}) {
  return (
    <View style={styles.importSuggestionCard}>
      <Text style={styles.inputLabel}>Importförslag</Text>
      <Text style={styles.recommendationName}>{catalogSuggestion.name}</Text>
      <Text style={styles.linkText}>{catalogSuggestion.sourceLabel}</Text>
      <Text style={styles.notesText}>{[catalogSuggestion.producer, catalogSuggestion.country, catalogSuggestion.region].filter(Boolean).join(" • ")}</Text>
      <ImportModeButtons styles={styles} importMode={importMode} onSetImportMode={onSetImportMode} onApplyCatalogSuggestion={onApplyCatalogSuggestion} />
      {importMode === "custom" ? (
        <CustomImportFields styles={styles} importSelection={importSelection} onToggleImportField={onToggleImportField} onApplyCatalogSuggestion={onApplyCatalogSuggestion} />
      ) : null}
    </View>
  );
}

function ImportModeButtons({ styles, importMode, onSetImportMode, onApplyCatalogSuggestion }: {
  styles: SharedStyles; importMode: ImportMode;
  onSetImportMode: (mode: ImportMode) => void; onApplyCatalogSuggestion: (mode: ImportMode) => void;
}) {
  return (
    <View style={styles.importModeRow}>
      <Pressable onPress={() => { onSetImportMode("all"); onApplyCatalogSuggestion("all"); }} style={[styles.quickImportButton, importMode === "all" && styles.quickImportButtonActive]}>
        <Text style={[styles.quickImportText, importMode === "all" && styles.quickImportTextActive]}>Importera allt</Text>
      </Pressable>
      <Pressable onPress={() => { onSetImportMode("empty"); onApplyCatalogSuggestion("empty"); }} style={[styles.quickImportButton, importMode === "empty" && styles.quickImportButtonActive]}>
        <Text style={[styles.quickImportText, importMode === "empty" && styles.quickImportTextActive]}>Bara tomma fält</Text>
      </Pressable>
      <Pressable onPress={() => onSetImportMode("custom")} style={[styles.quickImportButton, importMode === "custom" && styles.quickImportButtonActive]}>
        <Text style={[styles.quickImportText, importMode === "custom" && styles.quickImportTextActive]}>Välj själv</Text>
      </Pressable>
    </View>
  );
}

function CustomImportFields({ styles, importSelection, onToggleImportField, onApplyCatalogSuggestion }: {
  styles: SharedStyles; importSelection: ImportFieldSelection;
  onToggleImportField: (field: keyof ImportFieldSelection) => void; onApplyCatalogSuggestion: (mode: ImportMode) => void;
}) {
  return (
    <>
      <ImportSelectionRow label="Namn" selected={importSelection.name} onToggle={() => onToggleImportField("name")} />
      <ImportSelectionRow label="Producent" selected={importSelection.producer} onToggle={() => onToggleImportField("producer")} />
      <ImportSelectionRow label="Land" selected={importSelection.country} onToggle={() => onToggleImportField("country")} />
      <ImportSelectionRow label="Region" selected={importSelection.region} onToggle={() => onToggleImportField("region")} />
      <ImportSelectionRow label="Årgång" selected={importSelection.vintage} onToggle={() => onToggleImportField("vintage")} />
      <ImportSelectionRow label="Druva" selected={importSelection.grape} onToggle={() => onToggleImportField("grape")} />
      <ImportSelectionRow label="Typ" selected={importSelection.type} onToggle={() => onToggleImportField("type")} />
      <ImportSelectionRow label="Matmatchning" selected={importSelection.foodPairings} onToggle={() => onToggleImportField("foodPairings")} />
      <ImportSelectionRow label="Artikelnummer" selected={importSelection.systembolagetProductId} onToggle={() => onToggleImportField("systembolagetProductId")} />
      <ImportSelectionRow label="Streckkod" selected={importSelection.barcode} onToggle={() => onToggleImportField("barcode")} />
      <Pressable onPress={() => onApplyCatalogSuggestion("custom")} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Fyll i från förslag</Text>
      </Pressable>
    </>
  );
}
