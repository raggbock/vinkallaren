# Unified Wine Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-field "Snabbimport" section with a single unified search field at the top of the add-wine form, auto-filling all fields on selection.

**Architecture:** Move the existing `AutocompleteInput` + `searchWineNames` from `wine-core-fields.tsx` to the top of `add-wine-panel.tsx` as the primary entry point. On selection, auto-apply the full catalog entry. Hide article number + label scanning behind an expandable "Fler alternativ" section. Remove barcode entirely. Delete `catalog-import-card.tsx`. Also: remove misplaced BottleDoodle from logo area, and restyle the logo panel to fit the light theme.

**Tech Stack:** React Native / TypeScript / Expo

---

### Task 1: Remove BottleDoodle from logo area and restyle logo panel

**Files:**
- Modify: `mobile-app/src/components/add-wine-panel.tsx:27-33`
- Modify: `mobile-app/src/components/form-controls.tsx:481-496` (panelHero styles)

- [ ] **Step 1: Remove BottleDoodle from add-wine-panel header**

In `add-wine-panel.tsx`, replace the header block (lines 27-33):

```tsx
// Before:
<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
  <BottleDoodle size={40} />
  <View style={{ flex: 1 }}>
    <PanelHeader title="Lägg till vin" rightLabel="Profil" onRightPress={props.onOpenProfile} />
  </View>
</View>

// After:
<PanelHeader title="Lägg till vin" rightLabel="Profil" onRightPress={props.onOpenProfile} />
```

Also remove the `BottleDoodle` import if no longer used.

- [ ] **Step 2: Restyle logo panel for light theme**

In `form-controls.tsx`, update the `panelHero` style to use a CSS filter approach that lightens the dark logo panel. Change `panelHero` background and add an inverted/lighter treatment:

```typescript
panelHero: {
  backgroundColor: colors.bg,
  marginTop: -20,
  marginHorizontal: -20,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 12,
  alignItems: "center",
  gap: 10,
  borderBottomWidth: 1.5,
  borderBottomColor: colors.border,
},
```

Note: The logo image itself has dark background baked in, so the panel keeps `colors.bg` to let the image's own dark background show through naturally — the image already has rounded corners and transparency.

- [ ] **Step 3: Verify in browser and commit**

Run: Open http://localhost:8081, navigate to "Lägg till" tab.
Expected: No bottle doodle next to header. Logo panel blends with light theme.

```bash
git add mobile-app/src/components/add-wine-panel.tsx mobile-app/src/components/form-controls.tsx
git commit -m "fix: remove misplaced bottle doodle, restyle logo panel for light theme"
```

---

### Task 2: Add unified search field to add-wine-panel

**Files:**
- Modify: `mobile-app/src/components/add-wine-panel.tsx`

- [ ] **Step 1: Add search field at top of form**

In `add-wine-panel.tsx`, after the `PanelHeader` and `SuggestionRow` (Läge), add the unified search:

```tsx
<AutocompleteInput
  label="Sök vin"
  value=""
  onChangeText={() => {}}
  onOptionSelected={(name, producer) => {
    props.onNameSelected(name, producer);
  }}
  options={[]}
  searchAsync={props.searchWineNames}
  placeholder="Sök vin eller producent..."
  minimumQueryLength={4}
/>
```

Import `AutocompleteInput` from `"./form-controls"`.

This is a search-only field — its value is NOT stored in the draft. It's used purely to find and select a wine. The `onOptionSelected` callback triggers the existing `handleWineNameSelected` flow in `useCatalogWorkflow` which fetches catalog entries and applies them to the draft.

- [ ] **Step 2: Remove Snabbimport section and CatalogImportCard**

Remove these lines from `add-wine-panel.tsx`:
- `<SectionLabel label="Snabbimport" />` and the `<QuickImportSection>` block
- The `<CatalogImportCard>` conditional block
- The `<NoMatchFallback>` component and its usage

- [ ] **Step 3: Add "Fler alternativ" expandable section**

Replace the removed Snabbimport section with:

```tsx
<FlerAlternativ
  styles={styles}
  draft={draft}
  isDesktopWeb={isDesktopWeb}
  onArticleNumberChange={props.onArticleNumberChange}
  onScanLabel={props.onScanLabel}
  lookupBusy={props.lookupBusy}
  lookupMessage={props.lookupMessage}
/>
```

Add this component at the bottom of the file (before the `AddWinePanelProps` interface):

```tsx
function FlerAlternativ({ styles, draft, isDesktopWeb, onArticleNumberChange, onScanLabel, lookupBusy, lookupMessage }: {
  styles: SharedStyles; draft: WineDraft; isDesktopWeb: boolean;
  onArticleNumberChange: (value: string) => void; onScanLabel: () => void;
  lookupBusy: boolean; lookupMessage: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{open ? "▾" : "▸"}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Fler alternativ</Text>
      </Pressable>
      <Expandable expanded={open}>
        <View style={{ gap: 10 }}>
          <LabeledInput label="Systembolaget artikelnummer" value={draft.systembolagetProductId} onChangeText={onArticleNumberChange} placeholder="t.ex. 12345" />
          {!isDesktopWeb ? (
            <Pressable onPress={onScanLabel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Skanna etikett</Text>
            </Pressable>
          ) : null}
          {lookupBusy ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.notesText}>{lookupMessage || "Söker..."}</Text>
            </View>
          ) : lookupMessage ? <Text style={styles.notesText}>{lookupMessage}</Text> : null}
        </View>
      </Expandable>
    </>
  );
}
```

Import `useState` from `react`, `ActivityIndicator` from `react-native`, and `Expandable` from `./form-controls`.

- [ ] **Step 4: Clean up unused imports**

Remove unused imports from `add-wine-panel.tsx`:
- `QuickImportSection` import
- `CatalogImportCard` import
- `BottleDoodle` import (if removed in Task 1)

Remove unused props that are no longer passed through: `onBarcodeChange`, `onStartBarcodeScanner`, `importMode`, `onSetImportMode`, `onToggleImportField`, `importSelection`, `selectedCatalogNameEntry`.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/components/add-wine-panel.tsx
git commit -m "feat: replace Snabbimport with unified wine search field"
```

---

### Task 3: Simplify wine-core-fields (remove duplicate name search)

**Files:**
- Modify: `mobile-app/src/components/wine-core-fields.tsx`

- [ ] **Step 1: Replace AutocompleteInput with LabeledInput for name field**

The name search is now handled by the unified search above. Replace line 16:

```tsx
// Before:
<AutocompleteInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} onOptionSelected={onNameSelected} options={[]} searchAsync={searchWineNames} placeholder="Skriv minst 4 bokstäver" minimumQueryLength={4} />

// After:
<LabeledInput label="Namn" value={draft.name} onChangeText={(value) => onDraftChange({ name: value })} />
```

- [ ] **Step 2: Remove unused props**

Remove `searchWineNames` and `onNameSelected` from the component's props interface. Remove `AutocompleteInput` from imports. Keep `LabeledInput`.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/wine-core-fields.tsx
git commit -m "refactor: remove duplicate name search from wine-core-fields"
```

---

### Task 4: Clean up prop chain (App.tsx + AddWinePanelProps)

**Files:**
- Modify: `mobile-app/App.tsx` (prop passing around lines 370-395)
- Modify: `mobile-app/src/components/add-wine-panel.tsx` (AddWinePanelProps interface)

- [ ] **Step 1: Remove barcode-related props from AddWinePanelProps**

In `add-wine-panel.tsx`, remove from the `AddWinePanelProps` interface:
- `onBarcodeChange`
- `onStartBarcodeScanner`
- `importMode`
- `onSetImportMode`
- `onToggleImportField`
- `importSelection`
- `selectedCatalogNameEntry`
- `catalogSuggestion`
- `onApplyCatalogSuggestion`

Keep: `searchWineNames`, `onNameSelected`, `onArticleNumberChange`, `onScanLabel`, `lookupBusy`, `lookupMessage`.

- [ ] **Step 2: Remove corresponding props from App.tsx**

In `App.tsx`, remove the props that are no longer in `AddWinePanelProps` from the `<AddWinePanel>` JSX. Remove `onBarcodeChange`, `onStartBarcodeScanner`, `importMode`, `onSetImportMode`, `onToggleImportField`, `importSelection`, `selectedCatalogNameEntry`, `catalogSuggestion`, `onApplyCatalogSuggestion`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit` from `mobile-app/`
Expected: No new errors (pre-existing errors are OK)

- [ ] **Step 4: Commit**

```bash
git add mobile-app/App.tsx mobile-app/src/components/add-wine-panel.tsx
git commit -m "refactor: clean up removed import props from add-wine panel chain"
```

---

### Task 5: Delete catalog-import-card.tsx

**Files:**
- Delete: `mobile-app/src/components/catalog-import-card.tsx`
- Modify: Any files that import it (already removed in Task 2)

- [ ] **Step 1: Delete the file**

```bash
rm mobile-app/src/components/catalog-import-card.tsx
```

- [ ] **Step 2: Remove ImportSelectionRow if only used by catalog-import-card**

Check if `ImportSelectionRow` in `form-controls.tsx` is used elsewhere. If not, remove it.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete catalog-import-card, no longer needed"
```

---

### Task 6: Style the unified search for Haggan aesthetic

**Files:**
- Modify: `mobile-app/src/components/add-wine-panel.tsx` (search field styling)
- Modify: `mobile-app/src/components/autocomplete-input.tsx` (result list styling if needed)

- [ ] **Step 1: Style the search field with accent treatment**

Wrap the search `AutocompleteInput` in a styled container with a subtle accent border and search icon hint:

```tsx
<View style={{
  backgroundColor: colors.surface,
  borderRadius: 20,
  borderWidth: 1.5,
  borderColor: colors.accent,
  padding: 4,
  ...Platform.select({ web: { boxShadow: "1px 2px 0px rgba(200, 60, 45, 0.08)" }, default: {} }),
}}>
  <AutocompleteInput
    label=""
    value=""
    onChangeText={() => {}}
    onOptionSelected={(name, producer) => props.onNameSelected(name, producer)}
    options={[]}
    searchAsync={props.searchWineNames}
    placeholder="Sök vin eller producent..."
    minimumQueryLength={4}
  />
</View>
```

- [ ] **Step 2: Verify look in browser, adjust spacing**

Open http://localhost:8081, go to "Lägg till". The search field should be the first prominent element — a red-bordered input that invites interaction.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/components/add-wine-panel.tsx
git commit -m "style: accent-bordered search field matching Haggan aesthetic"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full flow test**

1. Open app → "Lägg till" tab
2. Type a wine name (4+ chars) in the search field
3. Verify results appear
4. Click a result → all fields should fill in
5. Verify "Fler alternativ" expands to show article number + scan button
6. Verify all previous sections (Om vinet, Förvaring, Övrigt, Bild) still work
7. Save a wine — verify it appears in cellar

- [ ] **Step 2: Take screenshots for comparison**

- [ ] **Step 3: Final commit if any tweaks needed**
