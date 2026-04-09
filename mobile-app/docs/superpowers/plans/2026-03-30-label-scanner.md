# Wine Label Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add on-device wine label OCR to the barcode scanner so users can photograph a label and fuzzy-match it against the catalog.

**Architecture:** A "Fotografera etiketten" button in `BarcodeScannerModal` triggers a photo capture → on-device OCR via `@react-native-ml-kit/text-recognition` → parsed text queried against Supabase via `pg_trgm` similarity → results shown in a picker modal → selected wine fills the form.

**Tech Stack:** React Native 0.83, Expo 55, `@react-native-ml-kit/text-recognition`, `expo-image-picker`, Supabase (PostgreSQL with `pg_trgm`)

---

### Task 1: Supabase migration — pg_trgm + RPC function

**Files:**
- Create: `supabase/migrations/20260330130000_add_trgm_catalog_search.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Enable trigram extension for fuzzy text matching
create extension if not exists pg_trgm;

-- Trigram index on wine name for fast similarity search
create index if not exists idx_catalog_wines_name_trgm
  on product_catalog_wines using gin (name gin_trgm_ops);

-- RPC function: fuzzy-match catalog wines by text
create or replace function match_catalog_by_text(query text, max_results int default 5)
returns table(id uuid, name text, producer text, vintage int, similarity real)
as $$
  select id, name, producer, vintage,
         similarity(name, query) as similarity
  from product_catalog_wines
  where similarity(name, query) > 0.2
  order by similarity desc
  limit max_results;
$$ language sql stable;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase MCP tool.
Expected: Extension enabled, index created, function created.

- [ ] **Step 3: Verify the RPC function works**

Run this SQL in Supabase SQL editor or via MCP:
```sql
select * from match_catalog_by_text('Chateau Mouton', 5);
```
Expected: Returns rows with name, producer, vintage, similarity score — or empty if no wines match (that's fine, the function exists and runs).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260330130000_add_trgm_catalog_search.sql
git commit -m "feat: add pg_trgm extension and fuzzy catalog search RPC"
```

---

### Task 2: Install `@react-native-ml-kit/text-recognition`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npx expo install @react-native-ml-kit/text-recognition
```

Expected: Package added to `package.json` dependencies. This is a native module — it requires an Expo dev client build (not Expo Go).

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @react-native-ml-kit/text-recognition for on-device OCR"
```

---

### Task 3: Label OCR library — `label-ocr.ts`

**Files:**
- Create: `src/lib/label-ocr.ts`

- [ ] **Step 1: Create the label OCR module**

This module wraps ML Kit text recognition and parses wine label text into structured candidates.

```typescript
import TextRecognition, { type TextBlock } from "@react-native-ml-kit/text-recognition";

export type LabelParseResult = {
  rawText: string;
  name: string | null;
  producer: string | null;
  vintage: string | null;
  searchQuery: string;
};

/**
 * Run on-device OCR on a photo URI.
 * Returns the raw TextBlock array from ML Kit.
 */
export async function recognizeLabel(imageUri: string): Promise<TextBlock[]> {
  const result = await TextRecognition.recognize(imageUri);
  return result.blocks;
}

/**
 * Parse OCR text blocks into wine label candidates.
 *
 * Strategy:
 * 1. Vintage: 4-digit year in range 1700–2030, pick latest if multiple.
 * 2. Wine name: longest text line (labels put the name largest; ML Kit returns blocks roughly by size).
 * 3. Producer: second longest line if sufficiently different from name.
 * 4. Search query: name + producer combined for trigram matching.
 */
export function parseWineLabel(blocks: TextBlock[]): LabelParseResult {
  const lines: string[] = [];
  for (const block of blocks) {
    for (const line of block.lines) {
      const trimmed = line.text.trim();
      if (trimmed.length > 0) lines.push(trimmed);
    }
  }

  const rawText = lines.join("\n");

  // --- Vintage ---
  const vintageRegex = /\b(1[7-9]\d{2}|20[0-2]\d|2030)\b/g;
  const years: number[] = [];
  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = vintageRegex.exec(line)) !== null) {
      years.push(parseInt(match[1], 10));
    }
  }
  const vintage = years.length > 0 ? String(Math.max(...years)) : null;

  // --- Filter lines: remove pure-year lines and very short lines ---
  const candidateLines = lines
    .filter((l) => !/^\d{4}$/.test(l.trim()))
    .filter((l) => l.length >= 3)
    .sort((a, b) => b.length - a.length);

  const name = candidateLines[0] ?? null;
  const producer =
    candidateLines[1] && candidateLines[1] !== name
      ? candidateLines[1]
      : null;

  const searchQuery = [name, producer].filter(Boolean).join(" ");

  return { rawText, name, producer, vintage, searchQuery };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/label-ocr.ts
git commit -m "feat: add label OCR module with ML Kit text recognition and wine label parser"
```

---

### Task 4: Catalog text match function in `useCellarData`

**Files:**
- Modify: `src/hooks/useCellarData.ts`

- [ ] **Step 1: Add the `matchCatalogByText` function**

After the existing `fetchCatalogEntriesByName` function (around line 131), add:

```typescript
  type CatalogTextMatch = {
    id: string;
    name: string;
    producer: string | null;
    vintage: number | null;
    similarity: number;
  };

  async function matchCatalogByText(query: string, maxResults = 5): Promise<CatalogTextMatch[]> {
    if (query.trim().length < 3) return [];
    const { data, error } = await supabase.rpc("match_catalog_by_text", {
      query: query.trim(),
      max_results: maxResults,
    });
    if (error) return [];
    return (data ?? []) as CatalogTextMatch[];
  }
```

- [ ] **Step 2: Export `matchCatalogByText` from the hook return value**

Find the return statement of the `useCellarData` hook and add `matchCatalogByText` to the returned object. Also export the `CatalogTextMatch` type from the file level.

The type should be moved outside the hook function, to file level:

```typescript
export type CatalogTextMatch = {
  id: string;
  name: string;
  producer: string | null;
  vintage: number | null;
  similarity: number;
};
```

And inside the hook, the function becomes:

```typescript
  async function matchCatalogByText(query: string, maxResults = 5): Promise<CatalogTextMatch[]> {
    if (query.trim().length < 3) return [];
    const { data, error } = await supabase.rpc("match_catalog_by_text", {
      query: query.trim(),
      max_results: maxResults,
    });
    if (error) return [];
    return (data ?? []) as CatalogTextMatch[];
  }
```

Add `matchCatalogByText` to the hook's return object alongside the other functions.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCellarData.ts
git commit -m "feat: add matchCatalogByText RPC wrapper in useCellarData"
```

---

### Task 5: Label match picker modal — `label-match-picker.tsx`

**Files:**
- Create: `src/components/label-match-picker.tsx`

- [ ] **Step 1: Create the picker modal component**

```typescript
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CatalogTextMatch } from "../hooks/useCellarData";

export function LabelMatchPickerModal({
  visible,
  matches,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  matches: CatalogTextMatch[];
  onSelect: (match: CatalogTextMatch) => void;
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" transparent>
      <View style={pickerStyles.overlay}>
        <SafeAreaView style={pickerStyles.sheet}>
          <Text style={pickerStyles.title}>Möjliga matchningar</Text>
          <Text style={pickerStyles.subtitle}>
            Resultatet baseras på etikettfoto och kan vara felaktigt. Kontrollera att vinet stämmer.
          </Text>

          <ScrollView style={pickerStyles.list}>
            {matches.map((match) => (
              <Pressable
                key={match.id}
                style={pickerStyles.matchRow}
                onPress={() => onSelect(match)}
              >
                <View style={pickerStyles.matchInfo}>
                  <Text style={pickerStyles.matchName}>{match.name}</Text>
                  <Text style={pickerStyles.matchMeta}>
                    {[match.producer, match.vintage].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={pickerStyles.matchScore}>
                  {Math.round(match.similarity * 100)}%
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={pickerStyles.dismissButton} onPress={onDismiss}>
            <Text style={pickerStyles.dismissText}>Ingen av dessa</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#2b1714",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: "60%",
  },
  title: {
    color: "#fff6ee",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#c9a87c",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  list: {
    marginBottom: 12,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3d2220",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  matchInfo: {
    flex: 1,
    marginRight: 12,
  },
  matchName: {
    color: "#fff6ee",
    fontSize: 15,
    fontWeight: "600",
  },
  matchMeta: {
    color: "#c9a87c",
    fontSize: 13,
    marginTop: 2,
  },
  matchScore: {
    color: "#f4c38c",
    fontSize: 14,
    fontWeight: "700",
  },
  dismissButton: {
    backgroundColor: "#3d2220",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  dismissText: {
    color: "#c9a87c",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/label-match-picker.tsx
git commit -m "feat: add LabelMatchPickerModal for wine label scan results"
```

---

### Task 6: Add "Fotografera etiketten" button to BarcodeScannerModal

**Files:**
- Modify: `src/components/cellar-workflows.tsx:18-57`

- [ ] **Step 1: Add `onLabelPhoto` prop to BarcodeScannerModal**

Update the component signature and add a button below the scanner hint text.

Change `BarcodeScannerModal` (lines 18-57) to:

```typescript
export function BarcodeScannerModal({
  visible,
  styles,
  onClose,
  onBarcodeScanned,
  onLabelPhoto,
}: {
  visible: boolean;
  styles: SharedStyles;
  onClose: () => void;
  onBarcodeScanned: (event: { data: string }) => void;
  onLabelPhoto: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.scannerScreen}>
        <View style={styles.scannerHeader}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>Streckkodsskanning</Text>
            <Text style={styles.scannerTitle}>Rikta kameran mot etiketten</Text>
          </View>
          <Pressable onPress={onClose}>
            <Text style={styles.linkText}>Stäng</Text>
          </Pressable>
        </View>

        <View style={styles.scannerFrame}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"],
            }}
            onBarcodeScanned={onBarcodeScanned}
          />
        </View>

        <Text style={styles.scannerHint}>Om koden redan finns i din källare fyller appen i relevanta fält automatiskt.</Text>

        <Pressable onPress={onLabelPhoto} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Fotografera etiketten</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}
```

The key change: added `onLabelPhoto` prop and a `<Pressable>` button after the hint text using the existing `styles.secondaryButton` and `styles.secondaryButtonText` style classes.

- [ ] **Step 2: Commit**

```bash
git add src/components/cellar-workflows.tsx
git commit -m "feat: add 'Fotografera etiketten' button to barcode scanner modal"
```

---

### Task 7: Wire up label scanning flow in App.tsx

**Files:**
- Modify: `App.tsx`

This is the integration task. It adds state, the photo→OCR→match handler, and renders the picker modal.

- [ ] **Step 1: Add imports**

At the top of `App.tsx`, add these imports:

```typescript
import { recognizeLabel, parseWineLabel } from "./src/lib/label-ocr";
import { LabelMatchPickerModal } from "./src/components/label-match-picker";
import type { CatalogTextMatch } from "./src/hooks/useCellarData";
```

Also add `useImagePicker` if not already imported (check — it may already be imported for wine photos):

```typescript
import { useImagePicker } from "./src/hooks/useImagePicker";
```

- [ ] **Step 2: Add state variables**

In the component body, near the other scanner state (around line 91 where `scannerVisible` is defined), add:

```typescript
  const [labelMatches, setLabelMatches] = useState<CatalogTextMatch[]>([]);
  const [labelPickerVisible, setLabelPickerVisible] = useState(false);
  const [labelOcrText, setLabelOcrText] = useState<string | null>(null);
```

- [ ] **Step 3: Add the label photo handler**

After the existing `handleBarcodeScanned` function (around line 322), add:

```typescript
  // --- Label scanning ---

  async function handleLabelPhoto() {
    setScannerVisible(false);
    const uri = await images.takePhoto();
    if (!uri) {
      setScannerVisible(true);
      return;
    }

    setLookupBusy(true);
    setLookupMessage("Läser etiketten...");
    try {
      const blocks = await recognizeLabel(uri);
      if (blocks.length === 0) {
        Alert.alert("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
        setLookupBusy(false);
        setLookupMessage("");
        return;
      }

      const parsed = parseWineLabel(blocks);
      if (!parsed.searchQuery) {
        Alert.alert("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
        setLookupBusy(false);
        setLookupMessage("");
        return;
      }

      setLabelOcrText(parsed.name);

      // Pre-fill vintage if found
      if (parsed.vintage) {
        setDraft((current) => ({ ...current, vintage: current.vintage || parsed.vintage! }));
      }

      const matches = await data.matchCatalogByText(parsed.searchQuery);

      if (matches.length > 0) {
        setLabelMatches(matches);
        setLabelPickerVisible(true);
      } else {
        // No matches — prefill name field with OCR text
        if (parsed.name) {
          setDraft((current) => ({ ...current, name: current.name || parsed.name! }));
        }
        if (parsed.producer) {
          setDraft((current) => ({ ...current, producer: current.producer || parsed.producer! }));
        }
        Alert.alert(
          "Inga matchningar hittades",
          "Texten från etiketten har fyllts i — korrigera vid behov."
        );
      }
    } catch {
      Alert.alert("Kunde inte läsa etiketten", "Försök igen med bättre belysning.");
    } finally {
      setLookupBusy(false);
      setLookupMessage("");
    }
  }

  async function handleLabelMatchSelected(match: CatalogTextMatch) {
    setLabelPickerVisible(false);
    setLabelMatches([]);

    // Fetch full catalog entry by name to get all fields
    const entries = await data.fetchCatalogEntriesByName(match.name);
    if (entries.length > 0) {
      const best = entries.reduce((a, b) =>
        scoreCatalogCompleteness(b) > scoreCatalogCompleteness(a) ? b : a
      );
      setSelectedCatalogNameEntry(best);
      setDraft((current) => ({
        ...current,
        name: best.name,
        producer: best.producer ?? current.producer,
        country: best.country ?? current.country,
        region: best.region ?? current.region,
        grape: best.grape ?? current.grape,
        type: best.type ?? current.type,
        vintage: best.vintage?.toString() ?? current.vintage,
        foodPairings: best.food_pairings?.join(", ") || current.foodPairings,
        barcode: best.barcode ?? current.barcode,
        systembolagetProductId: best.systembolaget_product_id ?? current.systembolagetProductId,
      }));
    } else {
      // Fallback: just fill name + producer from the match
      setDraft((current) => ({
        ...current,
        name: match.name,
        producer: match.producer ?? current.producer,
        vintage: match.vintage?.toString() ?? current.vintage,
      }));
    }
  }

  function handleLabelMatchDismissed() {
    setLabelPickerVisible(false);
    setLabelMatches([]);
    // Prefill with OCR text as fallback
    if (labelOcrText) {
      setDraft((current) => ({ ...current, name: current.name || labelOcrText! }));
    }
  }
```

Note: `images` refers to the `useImagePicker()` hook. Check if it's already called in the component — if so, reuse it. If not, add `const images = useImagePicker();` in the component body.

- [ ] **Step 4: Pass `onLabelPhoto` to BarcodeScannerModal**

Find the `<BarcodeScannerModal>` JSX (around line 758) and add the prop:

```typescript
      <BarcodeScannerModal
        visible={scannerVisible}
        styles={styles}
        onClose={() => setScannerVisible(false)}
        onBarcodeScanned={handleBarcodeScanned}
        onLabelPhoto={handleLabelPhoto}
      />
```

- [ ] **Step 5: Render LabelMatchPickerModal**

Add after the other modals (around line 766):

```typescript
      <LabelMatchPickerModal
        visible={labelPickerVisible}
        matches={labelMatches}
        onSelect={handleLabelMatchSelected}
        onDismiss={handleLabelMatchDismissed}
      />
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add App.tsx
git commit -m "feat: wire up label scanning flow — photo, OCR, match, picker"
```

---

### Self-Review

**Spec coverage:**
- [x] On-device OCR via ML Kit — Task 3
- [x] pg_trgm extension + RPC — Task 1
- [x] "Fotografera etiketten" button in scanner — Task 6
- [x] Photo capture via expo-image-picker — Task 7 (uses existing `useImagePicker.takePhoto()`)
- [x] Parse wine label (name/producer/vintage) — Task 3
- [x] Fuzzy match via RPC — Task 4
- [x] Picker modal with matches — Task 5
- [x] No-match fallback (prefill name) — Task 7
- [x] OCR failure message — Task 7
- [x] User warning about accuracy — Task 5 (subtitle text)
- [x] Save via existing flow (no changes needed) — confirmed, no task required

**Placeholder scan:** No TBDs, TODOs, or vague steps found.

**Type consistency:**
- `LabelParseResult` defined in Task 3, used in Task 7 ✓
- `CatalogTextMatch` defined in Task 4, used in Tasks 5 and 7 ✓
- `recognizeLabel` / `parseWineLabel` defined in Task 3, imported in Task 7 ✓
- `matchCatalogByText` defined in Task 4, called as `data.matchCatalogByText` in Task 7 ✓
- `LabelMatchPickerModal` defined in Task 5, imported in Task 7 ✓
