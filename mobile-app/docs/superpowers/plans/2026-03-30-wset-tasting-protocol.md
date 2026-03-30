# WSET Level 2 Tasting Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured WSET Level 2 wine tasting wizard modal alongside the existing quick tasting mode.

**Architecture:** New `tasting_data jsonb` column on `wine_history`. New modal component with 4-step wizard (Appearance → Nose → Palate → Conclusions). WSET lexicon data and types in a dedicated data file. Integration via new props on AddWinePanel.

**Tech Stack:** React Native, TypeScript, Supabase (PostgreSQL), Expo

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/lib/wsat-data.ts` | WSET lexicon, types, defaults, summary builder | Create |
| `src/components/wsat-tasting-modal.tsx` | 4-step wizard modal | Create |
| `src/types/wine-history.ts` | Add `tasting_data` field | Modify |
| `src/components/cellar-workflows.tsx` | Add WSET button/summary in AddWinePanel | Modify |
| `App.tsx` | Add state, wire modal, update saveTasting | Modify |
| `supabase/migrations/20260330120000_add_tasting_data_column.sql` | DB migration | Create |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260330120000_add_tasting_data_column.sql`

- [ ] **Step 1: Create migration file**

```sql
alter table public.wine_history add column if not exists tasting_data jsonb default null;
```

- [ ] **Step 2: Apply migration**

Use the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` with project_id `gonspypbhqvfvpgwsdtu`, name `add_tasting_data_column`, and the SQL above.

- [ ] **Step 3: Verify column exists**

Run via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wine_history' AND column_name = 'tasting_data'
```
Expected: `tasting_data | jsonb | YES`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260330120000_add_tasting_data_column.sql
git commit -m "feat: add tasting_data jsonb column to wine_history"
```

---

### Task 2: WSET data library

**Files:**
- Create: `src/lib/wsat-data.ts`
- Modify: `src/types/wine-history.ts`

- [ ] **Step 1: Update wine-history types**

Add `tasting_data` to all three types in `src/types/wine-history.ts`:

In `WineHistoryRow`, add after `tasting_notes: string | null;`:
```typescript
  tasting_data: Record<string, unknown> | null;
```

In `WineHistoryRecord`, no change needed (it extends `WineHistoryRow`).

In `WineHistoryInsert`, add after `tasting_notes?: string | null;`:
```typescript
  tasting_data?: Record<string, unknown> | null;
```

- [ ] **Step 2: Create `src/lib/wsat-data.ts`**

```typescript
// --- Types ---

export type WsatTastingData = {
  protocol: "wset_l2";
  appearance: {
    intensity: "pale" | "medium" | "deep" | null;
    colour: string | null;
  };
  nose: {
    intensity: "light" | "medium" | "pronounced" | null;
    aromas: string[];
    aromaNote: string | null;
  };
  palate: {
    sweetness: "dry" | "off-dry" | "medium" | "sweet" | null;
    acidity: "low" | "medium" | "high" | null;
    tannin: "low" | "medium" | "high" | null;
    alcohol: "low" | "medium" | "high" | null;
    body: "light" | "medium" | "full" | null;
    flavourIntensity: "light" | "medium" | "pronounced" | null;
    flavours: string[];
    flavourNote: string | null;
    finish: "short" | "medium" | "long" | null;
  };
  conclusions: {
    quality: "poor" | "acceptable" | "good" | "very good" | "outstanding" | null;
  };
};

export function emptyWsatData(): WsatTastingData {
  return {
    protocol: "wset_l2",
    appearance: { intensity: null, colour: null },
    nose: { intensity: null, aromas: [], aromaNote: null },
    palate: {
      sweetness: null,
      acidity: null,
      tannin: null,
      alcohol: null,
      body: null,
      flavourIntensity: null,
      flavours: [],
      flavourNote: null,
      finish: null,
    },
    conclusions: { quality: null },
  };
}

// --- Colour options by wine type ---

export const APPEARANCE_INTENSITY = ["pale", "medium", "deep"] as const;

export const COLOUR_OPTIONS: Record<string, string[]> = {
  white: ["lemon", "gold", "amber"],
  rose: ["pink", "pink-orange", "orange"],
  red: ["purple", "ruby", "garnet", "tawny"],
};

export function getColourOptions(wineType: string): string[] {
  const t = wineType.toLowerCase();
  if (t.includes("rött") || t === "rött") return COLOUR_OPTIONS.red;
  if (t.includes("rosé") || t === "rosé") return COLOUR_OPTIONS.rose;
  return COLOUR_OPTIONS.white;
}

// --- Nose / Palate intensity ---

export const NOSE_INTENSITY = ["light", "medium", "pronounced"] as const;
export const PALATE_SWEETNESS = ["dry", "off-dry", "medium", "sweet"] as const;
export const PALATE_ACIDITY = ["low", "medium", "high"] as const;
export const PALATE_TANNIN = ["low", "medium", "high"] as const;
export const PALATE_ALCOHOL = ["low", "medium", "high"] as const;
export const PALATE_BODY = ["light", "medium", "full"] as const;
export const PALATE_FLAVOUR_INTENSITY = ["light", "medium", "pronounced"] as const;
export const PALATE_FINISH = ["short", "medium", "long"] as const;
export const QUALITY_OPTIONS = ["poor", "acceptable", "good", "very good", "outstanding"] as const;

// --- WSET Level 2 Aroma/Flavour Lexicon ---

export type AromaGroup = { category: string; tags: string[] };
export type AromaSection = { title: string; groups: AromaGroup[] };

export const AROMA_LEXICON: AromaSection[] = [
  {
    title: "Primary",
    groups: [
      { category: "Floral", tags: ["blossom", "rose", "violet"] },
      { category: "Green fruit", tags: ["apple", "pear", "gooseberry", "grape"] },
      { category: "Citrus fruit", tags: ["grapefruit", "lemon", "lime", "orange"] },
      { category: "Stone fruit", tags: ["peach", "apricot", "nectarine"] },
      { category: "Tropical fruit", tags: ["banana", "lychee", "mango", "melon", "passion fruit", "pineapple"] },
      { category: "Red fruit", tags: ["redcurrant", "cranberry", "raspberry", "strawberry", "red cherry", "red plum"] },
      { category: "Black fruit", tags: ["blackcurrant", "blackberry", "blueberry", "black cherry", "black plum"] },
      { category: "Herbaceous", tags: ["green bell pepper", "grass", "tomato leaf", "asparagus"] },
      { category: "Herbal", tags: ["eucalyptus", "mint", "fennel", "dill", "dried herbs"] },
      { category: "Spice", tags: ["black/white pepper", "liquorice"] },
      { category: "Fruit ripeness", tags: ["unripe fruit", "ripe fruit", "dried fruit", "cooked fruit"] },
      { category: "Other", tags: ["wet stones", "candy"] },
    ],
  },
  {
    title: "Secondary",
    groups: [
      { category: "Yeast", tags: ["biscuit", "pastry", "bread", "toasted bread", "bread dough", "cheese", "yogurt"] },
      { category: "Malolactic", tags: ["butter", "cream", "cheese"] },
      { category: "Oak", tags: ["vanilla", "cloves", "coconut", "cedar", "charred wood", "smoke", "chocolate", "coffee"] },
    ],
  },
  {
    title: "Tertiary",
    groups: [
      { category: "Red wine ageing", tags: ["dried fruit", "leather", "earth", "mushroom", "meat", "tobacco", "wet leaves", "forest floor", "caramel"] },
      { category: "White wine ageing", tags: ["dried fruit", "orange marmalade", "petrol", "cinnamon", "ginger", "nutmeg", "almond", "hazelnut", "honey", "caramel"] },
      { category: "Oxidised", tags: ["almond", "hazelnut", "walnut", "chocolate", "coffee", "caramel"] },
    ],
  },
];

// --- Swedish labels ---

export const SWEDISH_LABELS: Record<string, string> = {
  // Appearance
  pale: "Blek",
  medium: "Medium",
  deep: "Djup",
  lemon: "Citron",
  gold: "Guld",
  amber: "Bärnsten",
  pink: "Rosa",
  "pink-orange": "Rosa-orange",
  orange: "Orange",
  purple: "Lila",
  ruby: "Rubin",
  garnet: "Granat",
  tawny: "Tawny",
  // Nose/Palate intensity
  light: "Lätt",
  pronounced: "Uttalad",
  // Sweetness
  dry: "Torrt",
  "off-dry": "Halvtorrt",
  sweet: "Sött",
  // Acidity / tannin / alcohol
  low: "Låg",
  high: "Hög",
  // Body
  full: "Fyllig",
  // Finish
  short: "Kort",
  long: "Lång",
  // Quality
  poor: "Fattig",
  acceptable: "Acceptabel",
  good: "Bra",
  "very good": "Mycket bra",
  outstanding: "Enastående",
};

export function swedishLabel(value: string): string {
  return SWEDISH_LABELS[value] ?? value;
}

// --- Summary builder ---

export function buildWsatSummary(data: WsatTastingData): string {
  const parts: string[] = [];

  // Appearance
  const app = [data.appearance.intensity, data.appearance.colour].filter(Boolean);
  if (app.length > 0) parts.push(app.map(swedishLabel).join(", "));

  // Nose
  const noseItems = [
    data.nose.intensity ? swedishLabel(data.nose.intensity) : null,
    ...data.nose.aromas.slice(0, 3),
  ].filter(Boolean);
  if (noseItems.length > 0) parts.push(noseItems.join(", "));

  // Palate
  const palateItems = [
    data.palate.sweetness ? swedishLabel(data.palate.sweetness) : null,
    data.palate.acidity ? `syra: ${swedishLabel(data.palate.acidity)}` : null,
    data.palate.body ? `kropp: ${swedishLabel(data.palate.body)}` : null,
  ].filter(Boolean);
  if (palateItems.length > 0) parts.push(palateItems.join(", "));

  // Quality
  if (data.conclusions.quality) parts.push(swedishLabel(data.conclusions.quality));

  return parts.join(" | ") || "Ingen data";
}

// --- Tannin visibility ---

export function showTannin(wineType: string): boolean {
  return wineType.toLowerCase().includes("rött") || wineType.toLowerCase() === "rött";
}
```

- [ ] **Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/wsat-data.ts src/types/wine-history.ts
git commit -m "feat: add WSET L2 tasting types, lexicon data, and summary builder"
```

---

### Task 3: Wizard modal component

**Files:**
- Create: `src/components/wsat-tasting-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import {
  AROMA_LEXICON,
  APPEARANCE_INTENSITY,
  NOSE_INTENSITY,
  PALATE_SWEETNESS,
  PALATE_ACIDITY,
  PALATE_TANNIN,
  PALATE_ALCOHOL,
  PALATE_BODY,
  PALATE_FLAVOUR_INTENSITY,
  PALATE_FINISH,
  QUALITY_OPTIONS,
  emptyWsatData,
  getColourOptions,
  showTannin,
  swedishLabel,
  type AromaSection,
  type WsatTastingData,
} from "../lib/wsat-data";

const STEP_TITLES = ["Utseende", "Doft", "Smak", "Slutsats"];

export function WsatTastingModal({
  visible,
  wineType,
  initialData,
  onSave,
  onClose,
}: {
  visible: boolean;
  wineType: string;
  initialData: WsatTastingData | null;
  onSave: (data: WsatTastingData) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WsatTastingData>(initialData ?? emptyWsatData());

  function handleOpen() {
    if (initialData) setData(initialData);
    else setData(emptyWsatData());
    setStep(0);
  }

  function handleSave() {
    onSave(data);
    onClose();
  }

  function toggleTag(list: string[], tag: string): string[] {
    return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onShow={handleOpen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>WSET Level 2</Text>
            <Text style={styles.title}>{STEP_TITLES[step]}</Text>
          </View>
          <Text style={styles.stepIndicator}>{step + 1} / {STEP_TITLES.length}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Stäng</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <>
              <OptionRow
                label="Intensitet"
                options={[...APPEARANCE_INTENSITY]}
                selected={data.appearance.intensity}
                onSelect={(v) => setData({ ...data, appearance: { ...data.appearance, intensity: v as WsatTastingData["appearance"]["intensity"] } })}
              />
              <OptionRow
                label="Färg"
                options={getColourOptions(wineType)}
                selected={data.appearance.colour}
                onSelect={(v) => setData({ ...data, appearance: { ...data.appearance, colour: v } })}
              />
            </>
          ) : step === 1 ? (
            <>
              <OptionRow
                label="Intensitet"
                options={[...NOSE_INTENSITY]}
                selected={data.nose.intensity}
                onSelect={(v) => setData({ ...data, nose: { ...data.nose, intensity: v as WsatTastingData["nose"]["intensity"] } })}
              />
              <Text style={styles.sectionLabel}>Aromer</Text>
              <TagSelector
                sections={AROMA_LEXICON}
                selected={data.nose.aromas}
                onToggle={(tag) => setData({ ...data, nose: { ...data.nose, aromas: toggleTag(data.nose.aromas, tag) } })}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Övriga doftnoteringar..."
                placeholderTextColor="#8f8178"
                value={data.nose.aromaNote ?? ""}
                onChangeText={(v) => setData({ ...data, nose: { ...data.nose, aromaNote: v || null } })}
                multiline
              />
            </>
          ) : step === 2 ? (
            <>
              <OptionRow label="Sötma" options={[...PALATE_SWEETNESS]} selected={data.palate.sweetness} onSelect={(v) => setData({ ...data, palate: { ...data.palate, sweetness: v as any } })} />
              <OptionRow label="Syra" options={[...PALATE_ACIDITY]} selected={data.palate.acidity} onSelect={(v) => setData({ ...data, palate: { ...data.palate, acidity: v as any } })} />
              {showTannin(wineType) ? (
                <OptionRow label="Tannin" options={[...PALATE_TANNIN]} selected={data.palate.tannin} onSelect={(v) => setData({ ...data, palate: { ...data.palate, tannin: v as any } })} />
              ) : null}
              <OptionRow label="Alkohol" options={[...PALATE_ALCOHOL]} selected={data.palate.alcohol} onSelect={(v) => setData({ ...data, palate: { ...data.palate, alcohol: v as any } })} />
              <OptionRow label="Kropp" options={[...PALATE_BODY]} selected={data.palate.body} onSelect={(v) => setData({ ...data, palate: { ...data.palate, body: v as any } })} />
              <OptionRow label="Smakintensitet" options={[...PALATE_FLAVOUR_INTENSITY]} selected={data.palate.flavourIntensity} onSelect={(v) => setData({ ...data, palate: { ...data.palate, flavourIntensity: v as any } })} />
              <Text style={styles.sectionLabel}>Smaker</Text>
              <TagSelector
                sections={AROMA_LEXICON}
                selected={data.palate.flavours}
                onToggle={(tag) => setData({ ...data, palate: { ...data.palate, flavours: toggleTag(data.palate.flavours, tag) } })}
              />
              <TextInput
                style={styles.textInput}
                placeholder="Övriga smaknoteringar..."
                placeholderTextColor="#8f8178"
                value={data.palate.flavourNote ?? ""}
                onChangeText={(v) => setData({ ...data, palate: { ...data.palate, flavourNote: v || null } })}
                multiline
              />
              <OptionRow label="Avslut" options={[...PALATE_FINISH]} selected={data.palate.finish} onSelect={(v) => setData({ ...data, palate: { ...data.palate, finish: v as any } })} />
            </>
          ) : (
            <OptionRow label="Kvalitet" options={[...QUALITY_OPTIONS]} selected={data.conclusions.quality} onSelect={(v) => setData({ ...data, conclusions: { quality: v as any } })} />
          )}
        </ScrollView>

        <View style={styles.nav}>
          {step > 0 ? (
            <Pressable style={styles.navButtonSecondary} onPress={() => setStep(step - 1)}>
              <Text style={styles.navButtonSecondaryText}>Tillbaka</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          {step < STEP_TITLES.length - 1 ? (
            <Pressable style={styles.navButtonPrimary} onPress={() => setStep(step + 1)}>
              <Text style={styles.navButtonPrimaryText}>Nästa</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.navButtonPrimary} onPress={handleSave}>
              <Text style={styles.navButtonPrimaryText}>Spara</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// --- Sub-components ---

function OptionRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionChips}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.chip, selected === opt && styles.chipSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.chipText, selected === opt && styles.chipTextSelected]}>
              {swedishLabel(opt)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TagSelector({
  sections,
  selected,
  onToggle,
}: {
  sections: AromaSection[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.tagSelector}>
      {sections.map((section) => (
        <View key={section.title}>
          <Text style={styles.tagSectionTitle}>{section.title}</Text>
          {section.groups.map((group) => (
            <View key={group.category} style={styles.tagGroup}>
              <Text style={styles.tagGroupLabel}>{group.category}</Text>
              <View style={styles.tagRow}>
                {group.tags.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[styles.tag, selected.includes(tag) && styles.tagSelected]}
                    onPress={() => onToggle(tag)}
                  >
                    <Text style={[styles.tagText, selected.includes(tag) && styles.tagTextSelected]}>
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#2b1714",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 18,
    paddingBottom: 8,
    gap: 12,
  },
  eyebrow: {
    color: "#f4c38c",
    letterSpacing: 2,
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    color: "#fff6ee",
    fontSize: 28,
    fontWeight: "700",
  },
  stepIndicator: {
    color: "#c9a87c",
    fontSize: 14,
    marginTop: 6,
  },
  closeText: {
    color: "#f4c38c",
    fontSize: 15,
    marginTop: 6,
  },
  content: {
    padding: 18,
    paddingTop: 8,
    gap: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    color: "#f4c38c",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  optionRow: {
    gap: 8,
  },
  optionLabel: {
    color: "#fff6ee",
    fontSize: 15,
    fontWeight: "600",
  },
  optionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#3d2220",
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  chipSelected: {
    backgroundColor: "#f4c38c",
    borderColor: "#f4c38c",
  },
  chipText: {
    color: "#c9a87c",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#2b1714",
    fontWeight: "600",
  },
  tagSelector: {
    gap: 12,
  },
  tagSectionTitle: {
    color: "#c9a87c",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
    marginTop: 8,
  },
  tagGroup: {
    gap: 4,
    marginBottom: 6,
  },
  tagGroupLabel: {
    color: "#8f8178",
    fontSize: 12,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#3d2220",
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  tagSelected: {
    backgroundColor: "#6f1d1b",
    borderColor: "#f4c38c",
  },
  tagText: {
    color: "#c9a87c",
    fontSize: 13,
  },
  tagTextSelected: {
    color: "#f4c38c",
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "#3d2220",
    color: "#fff6ee",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#5a3a36",
  },
  nav: {
    flexDirection: "row",
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#3d2220",
  },
  navButtonPrimary: {
    flex: 1,
    backgroundColor: "#6f1d1b",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  navButtonPrimaryText: {
    color: "#fff6ee",
    fontSize: 16,
    fontWeight: "700",
  },
  navButtonSecondary: {
    flex: 1,
    backgroundColor: "#3d2220",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  navButtonSecondaryText: {
    color: "#c9a87c",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wsat-tasting-modal.tsx
git commit -m "feat: add WSET L2 tasting wizard modal component"
```

---

### Task 4: Integration with AddWinePanel and App.tsx

**Files:**
- Modify: `App.tsx`
- Modify: `src/components/cellar-workflows.tsx`

- [ ] **Step 1: Add state and import in App.tsx**

At the top of App.tsx, add import:
```typescript
import type { WsatTastingData } from "./src/lib/wsat-data";
```

After `const [savingTasting, setSavingTasting] = useState(false);` (line 121), add:
```typescript
  const [wsatData, setWsatData] = useState<WsatTastingData | null>(null);
  const [wsatModalVisible, setWsatModalVisible] = useState(false);
```

- [ ] **Step 2: Update saveTasting in App.tsx**

In the `saveTasting()` function, after the line `consumed_at: tastingDate || null,` (line 508), add:
```typescript
        tasting_data: wsatData ?? null,
```

After `setTastingDate(new Date().toISOString().slice(0, 10));` (line 514), add:
```typescript
      setWsatData(null);
```

- [ ] **Step 3: Pass new props to AddWinePanel in App.tsx**

Find the `<AddWinePanel` JSX element and add these props alongside the existing tasting props:
```typescript
        wsatData={wsatData}
        onOpenWsat={() => setWsatModalVisible(true)}
```

- [ ] **Step 4: Render WsatTastingModal in App.tsx**

Add import at top of App.tsx:
```typescript
import { WsatTastingModal } from "./src/components/wsat-tasting-modal";
```

In the render function, after the `<AddWinePanel ... />` closing, add the modal:
```tsx
      <WsatTastingModal
        visible={wsatModalVisible}
        wineType={draft.type}
        initialData={wsatData}
        onSave={(data) => setWsatData(data)}
        onClose={() => setWsatModalVisible(false)}
      />
```

- [ ] **Step 5: Update AddWinePanel props in cellar-workflows.tsx**

Add to the destructured props of `AddWinePanel`:
```typescript
  wsatData,
  onOpenWsat,
```

Add to the type definition:
```typescript
  wsatData: WsatTastingData | null;
  onOpenWsat: () => void;
```

Add import at top of cellar-workflows.tsx:
```typescript
import { buildWsatSummary, type WsatTastingData } from "../lib/wsat-data";
```

- [ ] **Step 6: Add WSET button/summary in AddWinePanel UI**

In the tasting section of AddWinePanel (after the `<SuggestionRow title="Betyg" .../>` line, around line 512), add:

```tsx
          {wsatData ? (
            <Pressable onPress={onOpenWsat} style={styles.importSuggestionCard}>
              <Text style={styles.inputLabel}>WSET-provning</Text>
              <Text style={styles.notesText}>{buildWsatSummary(wsatData)}</Text>
              <Text style={styles.linkText}>Redigera</Text>
            </Pressable>
          ) : (
            <Pressable onPress={onOpenWsat} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>WSET-provning</Text>
            </Pressable>
          )}
```

- [ ] **Step 7: Verify types compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add App.tsx src/components/cellar-workflows.tsx
git commit -m "feat: integrate WSET tasting wizard into AddWinePanel"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Verify the full flow compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Verify migration was applied**

Run via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'wine_history' AND column_name = 'tasting_data'
```

- [ ] **Step 3: Push all commits**

```bash
git push
```
