# WSET Level 2 Tasting Protocol

## Goal

Add a structured wine tasting mode based on the WSET Level 2 Systematic Approach to Tasting (SAT) as a step-by-step wizard modal alongside the existing quick tasting mode.

## Architecture

The feature adds a modal wizard (`WsatTastingModal`) that collects structured tasting data across 4 steps. Data is stored as a JSON object in a new `tasting_data jsonb` column on the existing `wine_history` table. The quick tasting mode (rating + free-text note) remains unchanged.

## Data Model

### New column

```sql
ALTER TABLE wine_history ADD COLUMN tasting_data jsonb DEFAULT NULL;
```

### TypeScript type

```typescript
type WsatTastingData = {
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
```

### Interaction with existing fields

- `rating` (number 1-5) and `tasting_notes` (text) remain independent.
- `tasting_data` is null when using quick tasting mode.
- WSET quality conclusion does not auto-set `rating` — they are independent assessments.

## Wizard UI

### Modal: `WsatTastingModal`

Opens from AddWinePanel when in tasting mode. 4 steps with back/next navigation and a step indicator (e.g. "1 / 4").

#### Step 1: Utseende (Appearance)

- **Intensity**: `SuggestionRow` with 3 options — pale, medium, deep
- **Colour**: `SuggestionRow` with options dependent on wine type:
  - White: lemon, gold, amber
  - Rose: pink, pink-orange, orange
  - Red: purple, ruby, garnet, tawny
  - Other types default to the white colour set

#### Step 2: Doft (Nose)

- **Intensity**: `SuggestionRow` with 3 options — light, medium, pronounced
- **Aromas**: Tappable tags grouped by category from the WSET Level 2 lexicon:
  - **Primary**: Floral (blossom, rose, violet), Green fruit (apple, pear, gooseberry, grape), Citrus fruit (grapefruit, lemon, lime, orange), Stone fruit (peach, apricot, nectarine), Tropical fruit (banana, lychee, mango, melon, passion fruit, pineapple), Red fruit (redcurrant, cranberry, raspberry, strawberry, red cherry, red plum), Black fruit (blackcurrant, blackberry, blueberry, black cherry, black plum), Herbaceous (green bell pepper, grass, tomato leaf, asparagus), Herbal (eucalyptus, mint, fennel, dill, dried herbs), Spice (black/white pepper, liquorice), Fruit ripeness (unripe fruit, ripe fruit, dried fruit, cooked fruit), Other (wet stones, candy)
  - **Secondary**: Yeast (biscuit, pastry, bread, toasted bread, bread dough, cheese, yogurt), Malolactic (butter, cream, cheese), Oak (vanilla, cloves, coconut, cedar, charred wood, smoke, chocolate, coffee)
  - **Tertiary**: Red wine (dried fruit, leather, earth, mushroom, meat, tobacco, wet leaves, forest floor, caramel), White wine (dried fruit, orange marmalade, petrol, cinnamon, ginger, nutmeg, almond, hazelnut, honey, caramel), Oxidised (almond, hazelnut, walnut, chocolate, coffee, caramel)
- **Free text field**: optional additional aroma notes

#### Step 3: Smak (Palate)

- **Sweetness**: 4 options — dry, off-dry, medium, sweet
- **Acidity**: 3 options — low, medium, high
- **Tannin**: 3 options — low, medium, high. Only shown when wine type is "Rott" (red).
- **Alcohol**: 3 options — low, medium, high
- **Body**: 3 options — light, medium, full
- **Flavour intensity**: 3 options — light, medium, pronounced
- **Flavours**: Same tappable tag system as nose aromas
- **Free text field**: optional additional flavour notes
- **Finish**: 3 options — short, medium, long

#### Step 4: Slutsats (Conclusions)

- **Quality**: 5 options — poor, acceptable, good, very good, outstanding

### Navigation

- Back/Next buttons at the bottom of each step
- Step 1 has no back button (or it closes the modal)
- Step 4 has "Spara" instead of "Nasta" which closes the modal and returns the data
- User can navigate freely back and forth without losing data

## Integration with AddWinePanel

### UI changes (tasting mode only)

Below the existing rating row, add a button: **"WSET-provning"**.

When WSET data exists (modal has been completed):
- Show a compact summary text replacing the button, e.g.: "Medium intensity, ruby | Medium nose: apple, vanilla | Dry, high acidity, medium body | Good"
- Tapping the summary re-opens the modal for editing

### Save flow

`saveTasting()` in App.tsx is updated:
- If `wsatData` state is non-null, include it as `tasting_data` in the `WineHistoryInsert` payload.
- If null, `tasting_data` is omitted (quick tasting mode).

## New Files

| File | Responsibility |
|------|---------------|
| `src/components/wsat-tasting-modal.tsx` | Wizard modal: 4 steps, navigation, tag selection UI |
| `src/lib/wsat-data.ts` | WSET lexicon data (aroma tags, colour options, labels), WsatTastingData type, summary builder function |
| `supabase/migrations/YYYYMMDDHHMMSS_add_tasting_data_column.sql` | `ALTER TABLE wine_history ADD COLUMN tasting_data jsonb DEFAULT NULL` |

## Modified Files

| File | Change |
|------|--------|
| `src/types/wine-history.ts` | Add `tasting_data` to `WineHistoryRow`, `WineHistoryRecord`, `WineHistoryInsert` |
| `src/components/cellar-workflows.tsx` | Add WSET button/summary in AddWinePanel tasting section, pass props |
| `App.tsx` | Add `wsatData` state, pass to modal, include in `saveTasting()` payload |

## UI Labels

All step titles and option labels displayed in Swedish. Internal data values stored in English (matching the WSET standard). Example: button shows "Torrt" but value is `"dry"`.

Swedish labels for steps:
- Step 1: "Utseende"
- Step 2: "Doft"
- Step 3: "Smak"
- Step 4: "Slutsats"

Swedish labels for quality: fattig, acceptabel, bra, mycket bra, enastående.

Aroma/flavour tag labels remain in English (these are WSET standard terms that Swedish wine tasters learn in English).
