# Session Dishes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove broken MealPlannerPanel from CellarTab, add session-level dish tracking to tasting sessions with food-wine pairing results.

**Architecture:** Two new DB tables (`session_dishes`, `session_tasting_dishes`) with RLS. Session setup/active views get a dish input section. Tasting view gets dish toggle chips. Results dashboard gets a food-wine pairing section. MealPlannerPanel and dead helpers are deleted.

**Tech Stack:** React Native, TypeScript, Supabase (PostgreSQL + RLS), existing component patterns.

---

### Task 1: Remove MealPlannerPanel from CellarTab

**Files:**
- Modify: `src/components/cellar-tab.tsx`
- Modify: `src/components/cellar-sections.tsx` (delete MealPlannerPanel + mealStyles)
- Modify: `src/lib/cellar-helpers.ts` (delete buildMealRecommendations, buildCustomPairings)
- Modify: `src/hooks/useWines.ts` (remove buildMealRecommendations export)
- Modify: `src/hooks/__tests__/useWinesAndHistory.test.tsx` (remove mock)
- Modify: `src/lib/__tests__/cellar-helpers.test.ts` (remove tests)

- [ ] **Step 1: Remove MealPlannerPanel from cellar-tab.tsx**

Remove the import and rendering of MealPlannerPanel, plus the `selectedMeal`/`mealRecommendations` state:

```tsx
// cellar-tab.tsx — remove these lines:
import { buildMealRecommendations } from "../lib/cellar-helpers";
import { MealPlannerPanel } from "./cellar-sections";

// Remove from inside CellarTab:
const [selectedMeal, setSelectedMeal] = useState("");
const mealRecommendations = useMemo(
  () => selectedMeal ? buildMealRecommendations(ctx.wines, selectedMeal) : [],
  [selectedMeal, ctx.wines],
);

// Remove from the JSX return (keep MinKallarePanel, remove fragment wrapper):
<MealPlannerPanel ... />
```

The return becomes just `<MinKallarePanel ... />` (no fragment needed).

- [ ] **Step 2: Delete MealPlannerPanel and mealStyles from cellar-sections.tsx**

Delete the entire `MealPlannerPanel` function (lines 66–173) and the `mealStyles` StyleSheet (lines 387–415). Keep `BottomTabBar`, `HistoryPanel`, and everything else.

- [ ] **Step 3: Delete buildMealRecommendations and buildCustomPairings from cellar-helpers.ts**

Delete `buildCustomPairings` function and `buildMealRecommendations` function. Keep `FOOD_CATEGORIES` (used by `cellar-fields.tsx`), `buildPairingOptions`, `getSuggestedPairings`, and everything else.

- [ ] **Step 4: Remove buildMealRecommendations from useWines.ts**

Remove the import of `buildMealRecommendations` and the line:
```ts
buildMealRecommendations: (meal: string) => buildMealRecommendations(wines, meal),
```

- [ ] **Step 5: Clean up tests**

In `src/hooks/__tests__/useWinesAndHistory.test.tsx`, remove the `buildMealRecommendations` mock line.

In `src/lib/__tests__/cellar-helpers.test.ts`, remove the import of `buildMealRecommendations` and the entire `describe("buildMealRecommendations", ...)` block.

- [ ] **Step 6: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/cellar-tab.tsx src/components/cellar-sections.tsx src/lib/cellar-helpers.ts src/hooks/useWines.ts src/hooks/__tests__/useWinesAndHistory.test.tsx src/lib/__tests__/cellar-helpers.test.ts
git commit -m "fix: remove broken MealPlannerPanel from CellarTab"
```

---

### Task 2: Database migration — session_dishes and session_tasting_dishes

**Files:**
- Create: `supabase/migrations/20260412100000_session_dishes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- session_dishes: dishes served at a tasting session
create table if not exists public.session_dishes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index idx_session_dishes_session on session_dishes (session_id);

-- session_tasting_dishes: which dishes each taster linked to a wine
create table if not exists public.session_tasting_dishes (
  session_tasting_id uuid not null references public.session_tastings (id) on delete cascade,
  session_dish_id uuid not null references public.session_dishes (id) on delete cascade,
  primary key (session_tasting_id, session_dish_id)
);

-- RLS: session_dishes
alter table session_dishes enable row level security;

create policy "session_dishes_select" on session_dishes for select using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and (ts.host_id = auth.uid() or is_session_participant(ts.id))
  )
);
create policy "session_dishes_insert" on session_dishes for insert with check (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and ts.host_id = auth.uid()
  )
);
create policy "session_dishes_delete" on session_dishes for delete using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_dishes.session_id
    and ts.host_id = auth.uid()
  )
);

-- RLS: session_tasting_dishes
alter table session_tasting_dishes enable row level security;

create policy "session_tasting_dishes_select" on session_tasting_dishes for select using (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and (
      st.user_id = auth.uid()
      or exists (
        select 1 from tasting_sessions ts
        where ts.id = st.session_id
        and (ts.mode = 'open' or ts.status in ('revealed', 'ended') or ts.host_id = auth.uid())
      )
    )
  )
);
create policy "session_tasting_dishes_insert" on session_tasting_dishes for insert with check (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and st.user_id = auth.uid()
  )
);
create policy "session_tasting_dishes_delete" on session_tasting_dishes for delete using (
  exists (
    select 1 from session_tastings st
    where st.id = session_tasting_dishes.session_tasting_id
    and st.user_id = auth.uid()
  )
);
```

- [ ] **Step 2: Apply migration**

Use the Supabase MCP `apply_migration` tool to apply the migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260412100000_session_dishes.sql
git commit -m "feat: add session_dishes and session_tasting_dishes tables"
```

---

### Task 3: TypeScript types and data-access functions

**Files:**
- Modify: `src/types/tasting-session.ts`
- Modify: `src/lib/session-actions.ts`

- [ ] **Step 1: Add types to tasting-session.ts**

Add after the existing types:

```ts
export type SessionDishRow = {
  id: string;
  session_id: string;
  name: string;
  created_at: string;
};

export type SessionTastingDishRow = {
  session_tasting_id: string;
  session_dish_id: string;
};
```

- [ ] **Step 2: Add data-access functions to session-actions.ts**

Add these functions:

```ts
import type { SessionDishRow, SessionTastingDishRow } from "../types/tasting-session";

export async function fetchSessionDishes(sessionId: string): Promise<Result<SessionDishRow[]>> {
  const { data, error } = await supabase
    .from("session_dishes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as SessionDishRow[]);
}

export async function addSessionDish(sessionId: string, name: string): Promise<Result<SessionDishRow>> {
  const { data, error } = await supabase
    .from("session_dishes")
    .insert({ session_id: sessionId, name })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as SessionDishRow);
}

export async function deleteSessionDish(dishId: string): Promise<Result<true>> {
  const { error } = await supabase.from("session_dishes").delete().eq("id", dishId);
  if (error) return fail(error.message);
  return ok(true);
}

export async function fetchTastingDishes(sessionId: string): Promise<Result<SessionTastingDishRow[]>> {
  const { data, error } = await supabase
    .from("session_tasting_dishes")
    .select("*, session_tastings!inner(session_id)")
    .eq("session_tastings.session_id", sessionId);
  if (error) return fail(error.message);
  return ok((data ?? []).map((d: any) => ({
    session_tasting_id: d.session_tasting_id,
    session_dish_id: d.session_dish_id,
  })));
}

export async function saveTastingDishes(
  sessionTastingId: string,
  dishIds: string[],
): Promise<Result<true>> {
  // Delete existing links, then insert new ones
  const { error: delError } = await supabase
    .from("session_tasting_dishes")
    .delete()
    .eq("session_tasting_id", sessionTastingId);
  if (delError) return fail(delError.message);

  if (dishIds.length > 0) {
    const rows = dishIds.map((id) => ({ session_tasting_id: sessionTastingId, session_dish_id: id }));
    const { error: insError } = await supabase.from("session_tasting_dishes").insert(rows);
    if (insError) return fail(insError.message);
  }
  return ok(true);
}
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/tasting-session.ts src/lib/session-actions.ts
git commit -m "feat: add session dish types and data-access functions"
```

---

### Task 4: Dish input UI component

**Files:**
- Create: `src/components/session-dishes.tsx`

- [ ] **Step 1: Create the SessionDishes component**

This component shows a text input + add button, and renders added dishes as removable chips. Used in both setup and active views.

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import type { SessionDishRow } from "../types/tasting-session";

type Props = {
  dishes: SessionDishRow[];
  isHost: boolean;
  onAdd: (name: string) => void;
  onRemove: (dishId: string) => void;
};

export function SessionDishes({ dishes, isHost, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");

  function handleAdd() {
    const name = input.trim();
    if (!name) return;
    onAdd(name);
    setInput("");
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Maträtter ({dishes.length})</Text>

      {dishes.length > 0 ? (
        <View style={s.chipRow}>
          {dishes.map((d) => (
            <View key={d.id} style={s.chip}>
              <Text style={s.chipText}>{d.name}</Text>
              {isHost ? (
                <Pressable onPress={() => onRemove(d.id)} hitSlop={8}>
                  <Text style={s.chipRemove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.hint}>Inga maträtter tillagda ännu.</Text>
      )}

      {isHost ? (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Lägg till maträtt..."
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable onPress={handleAdd} style={[s.addBtn, !input.trim() && s.addBtnDisabled]} disabled={!input.trim()}>
            <Text style={s.addBtnText}>Lägg till</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function DishToggleChips({
  dishes,
  selectedIds,
  onToggle,
}: {
  dishes: SessionDishRow[];
  selectedIds: Set<string>;
  onToggle: (dishId: string) => void;
}) {
  if (dishes.length === 0) return null;

  return (
    <View style={s.toggleSection}>
      <Text style={s.toggleLabel}>Maträtter</Text>
      <View style={s.chipRow}>
        {dishes.map((d) => {
          const selected = selectedIds.has(d.id);
          return (
            <Pressable key={d.id} onPress={() => onToggle(d.id)} style={[s.toggleChip, selected && s.toggleChipActive]}>
              <Text style={[s.toggleChipText, selected && s.toggleChipTextActive]}>{d.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8 },
  title: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { color: colors.textSecondary, fontSize: 13, fontStyle: "italic" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chipRemove: { color: colors.textSecondary, fontSize: 11 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: colors.textLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceAlt },
  addBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  toggleSection: { gap: 6 },
  toggleLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  toggleChip: { backgroundColor: colors.textLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.surfaceAlt },
  toggleChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleChipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  toggleChipTextActive: { color: colors.textLight },
});
```

- [ ] **Step 2: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/session-dishes.tsx
git commit -m "feat: add SessionDishes and DishToggleChips components"
```

---

### Task 5: Wire dishes into session setup and active views

**Files:**
- Modify: `src/components/tasting-session-modal.tsx`
- Modify: `src/components/session-setup-view.tsx`
- Modify: `src/components/session-active-view.tsx`

- [ ] **Step 1: Add dish state and fetching to TastingSessionPanel**

In `tasting-session-modal.tsx`, add dish state and handlers. Add to the imports:

```ts
import { addSessionDish, deleteSessionDish, fetchSessionDishes, fetchTastingDishes, saveTastingDishes } from "../lib/session-actions";
import type { SessionDishRow, SessionTastingDishRow } from "../types/tasting-session";
```

Add state inside `TastingSessionPanel`:

```ts
const [dishes, setDishes] = useState<SessionDishRow[]>([]);
const [tastingDishes, setTastingDishes] = useState<SessionTastingDishRow[]>([]);
```

Add a fetch effect after the existing participants effect:

```ts
useEffect(() => {
  if (!activeSession) { setDishes([]); setTastingDishes([]); return; }
  fetchSessionDishes(activeSession.id).then((r) => { if (r.data) setDishes(r.data); });
  fetchTastingDishes(activeSession.id).then((r) => { if (r.data) setTastingDishes(r.data); });
}, [activeSession?.id, activeSession?.status]);
```

Add handlers:

```ts
async function handleAddDish(name: string) {
  if (!activeSession) return;
  const r = await addSessionDish(activeSession.id, name);
  if (r.data) setDishes((prev) => [...prev, r.data!]);
}

async function handleRemoveDish(dishId: string) {
  const r = await deleteSessionDish(dishId);
  if (r.data) setDishes((prev) => prev.filter((d) => d.id !== dishId));
}
```

- [ ] **Step 2: Pass dishes to setup view**

In the setup view render block (where `activeSession.status === "setup"`), add dishes props to `SessionSetupView`:

```tsx
<SessionSetupView
  session={activeSession}
  wines={activeWines}
  participants={participants}
  isHost={isHost}
  dishes={dishes}
  onAddDish={handleAddDish}
  onRemoveDish={handleRemoveDish}
  onStart={async () => { ... }}
  onBack={() => { ... }}
  onReorder={(reordered) => onSetActiveWines(() => reordered)}
>
```

Update `session-setup-view.tsx` to accept and render dishes. Add to Props type:

```ts
dishes: SessionDishRow[];
onAddDish: (name: string) => void;
onRemoveDish: (dishId: string) => void;
```

Add import:
```ts
import { SessionDishes } from "./session-dishes";
import type { SessionDishRow } from "../types/tasting-session";
```

Add the dishes section in the JSX, after the wines section and before `{children}`:

```tsx
{/* Dishes */}
<SessionDishes dishes={dishes} isHost={isHost} onAdd={onAddDish} onRemove={onRemoveDish} />
```

- [ ] **Step 3: Pass dishes to active view**

In the active session render block, add dishes prop:

```tsx
<ActiveSessionView
  session={activeSession}
  userId={userId}
  wines={activeWines}
  tastings={activeTastings}
  toasts={toasts}
  participants={participants}
  dishes={dishes}
  onAddDish={handleAddDish}
  onRemoveDish={handleRemoveDish}
  onTasteWine={...}
  onBack={...}
>
```

Update `session-active-view.tsx` — add to props type:

```ts
dishes: SessionDishRow[];
onAddDish: (name: string) => void;
onRemoveDish: (dishId: string) => void;
```

Add import:
```ts
import { SessionDishes } from "./session-dishes";
import type { SessionDishRow } from "../types/tasting-session";
```

Render the dishes section after the header and before the wine cards:

```tsx
{/* Dishes */}
<SessionDishes dishes={dishes} isHost={session.host_id === userId} onAdd={onAddDish} onRemove={onRemoveDish} />
```

- [ ] **Step 4: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/tasting-session-modal.tsx src/components/session-setup-view.tsx src/components/session-active-view.tsx
git commit -m "feat: wire session dishes into setup and active views"
```

---

### Task 6: Wire dish toggle chips into tasting view

**Files:**
- Modify: `src/components/session-tasting-view.tsx`
- Modify: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Add dish props to SessionTastingView**

In `session-tasting-view.tsx`, add to props:

```ts
import { DishToggleChips } from "./session-dishes";
import type { SessionDishRow } from "../types/tasting-session";
```

Add to the prop type:

```ts
dishes: SessionDishRow[];
initialDishIds: string[];
onSave: (data: { rating: number | null; notes: string | null; foodPairings: string[]; wsetData: WsetTastingData | null; dishIds: string[] }) => void;
```

Add state:

```ts
const [selectedDishIds, setSelectedDishIds] = useState<Set<string>>(new Set(initialDishIds));
```

Add toggle handler:

```ts
function toggleDish(dishId: string) {
  setSelectedDishIds((prev) => {
    const next = new Set(prev);
    if (next.has(dishId)) next.delete(dishId);
    else next.add(dishId);
    return next;
  });
}
```

Update `handleSave` to include dishIds:

```ts
function handleSave() {
  const pairings = foodPairings.split(",").map((s) => s.trim()).filter(Boolean);
  onSave({
    rating: rating ? Number(rating) : null,
    notes: notes.trim() || null,
    foodPairings: pairings,
    wsetData: initialWsetData,
    dishIds: [...selectedDishIds],
  });
}
```

Add the toggle chips in the form, between the rating/WSET section and the "Smaknotering" input:

```tsx
<DishToggleChips dishes={dishes} selectedIds={selectedDishIds} onToggle={toggleDish} />
```

- [ ] **Step 2: Update TastingSessionPanel to pass dishes and save dish links**

In `tasting-session-modal.tsx`, update the tasting wine render block. Pass `dishes` and `initialDishIds` to `SessionTastingView`:

```tsx
const existingDishIds = tastingDishes
  .filter((td) => td.session_tasting_id === existing?.id)
  .map((td) => td.session_dish_id);

<SessionTastingView
  wine={tastingWine}
  format={activeSession.format}
  initialRating={existing?.rating ?? null}
  initialNotes={existing?.notes ?? null}
  initialFoodPairings={existing?.food_pairings ?? []}
  initialWsetData={wsetData}
  initialDishIds={existingDishIds}
  dishes={dishes}
  saving={savingTasting}
  onSave={handleSaveTasting}
  onOpenWset={() => onOpenWset(tastingWine.type || "")}
  onBack={() => setTastingWine(null)}
/>
```

Update `handleSaveTasting` to save dish links after saving the tasting:

```ts
async function handleSaveTasting(data: {
  rating: number | null; notes: string | null; foodPairings: string[];
  wsetData?: WsetTastingData | null; dishIds: string[];
}) {
  if (!activeSession || !tastingWine) return;
  setSavingTasting(true);
  const result = await saveTasting({
    session_id: activeSession.id, session_wine_id: tastingWine.id,
    user_id: userId, rating: data.rating, notes: data.notes,
    food_pairings: data.foodPairings, tasting_data: data.wsetData ?? null,
  });
  if (result.error) { setSavingTasting(false); setInlineError("Kunde inte spara provning"); return; }

  // Save dish links
  if (result.data && data.dishIds.length > 0) {
    await saveTastingDishes(result.data.id, data.dishIds);
    // Refresh tasting dishes
    const tdResult = await fetchTastingDishes(activeSession.id);
    if (tdResult.data) setTastingDishes(tdResult.data);
  } else if (result.data) {
    // Clear any existing dish links
    await saveTastingDishes(result.data.id, []);
    const tdResult = await fetchTastingDishes(activeSession.id);
    if (tdResult.data) setTastingDishes(tdResult.data);
  }

  setSavingTasting(false);
  setTastingWine(null);
}
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/session-tasting-view.tsx src/components/tasting-session-modal.tsx
git commit -m "feat: add dish toggle chips to tasting view with save"
```

---

### Task 7: Food-wine pairing results in dashboard

**Files:**
- Modify: `src/lib/session-results.ts`
- Modify: `src/components/results-dashboard.tsx`
- Modify: `src/components/tasting-session-modal.tsx`

- [ ] **Step 1: Add dish-wine result types and builder to session-results.ts**

Add to the types:

```ts
import type { SessionDishRow, SessionTastingDishRow } from "../types/tasting-session";

export type DishWineResult = {
  dish: SessionDishRow;
  wine: SessionWineRow;
  averageRating: number;
  tastingCount: number;
};
```

Add to `SessionResults` type:

```ts
dishWineResults: DishWineResult[];
```

Add a builder function:

```ts
export function buildDishWineResults(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  dishes: SessionDishRow[],
  tastingDishes: SessionTastingDishRow[],
): DishWineResult[] {
  if (dishes.length === 0) return [];

  const wineMap = new Map(wines.map((w) => [w.id, w]));
  const results: DishWineResult[] = [];

  for (const dish of dishes) {
    // Find all tasting IDs linked to this dish
    const linkedTastingIds = new Set(
      tastingDishes.filter((td) => td.session_dish_id === dish.id).map((td) => td.session_tasting_id),
    );

    // Group linked tastings by wine
    const byWine = new Map<string, number[]>();
    for (const t of tastings) {
      if (!linkedTastingIds.has(t.id) || t.rating == null) continue;
      const arr = byWine.get(t.session_wine_id) ?? [];
      arr.push(t.rating);
      byWine.set(t.session_wine_id, arr);
    }

    for (const [wineId, ratings] of byWine) {
      const wine = wineMap.get(wineId);
      if (!wine) continue;
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      results.push({ dish, wine, averageRating: avg, tastingCount: ratings.length });
    }
  }

  results.sort((a, b) => b.averageRating - a.averageRating);
  return results;
}
```

Update `buildSessionResults` to accept dishes params and include dishWineResults:

```ts
export function buildSessionResults(
  wines: SessionWineRow[],
  tastings: SessionTastingRow[],
  format: "quick" | "wset",
  sessionDate: string,
  dishes: SessionDishRow[] = [],
  tastingDishes: SessionTastingDishRow[] = [],
): SessionResults {
  // ... existing code ...
  return {
    format,
    wineCount: wines.length,
    participantCount: participantIds.length,
    date: sessionDate,
    wines: wineResults,
    favorite,
    mostDivided: mostDivided && mostDivided.ratingSpread > 0 ? mostDivided : null,
    participantIds,
    dishWineResults: buildDishWineResults(wines, tastings, dishes, tastingDishes),
  };
}
```

- [ ] **Step 2: Add DishWinePairings section to results-dashboard.tsx**

Add import:
```ts
import type { DishWineResult } from "../lib/session-results";
```

Add a new component in results-dashboard.tsx:

```tsx
function DishWinePairings({ results }: { results: DishWineResult[] }) {
  if (results.length === 0) return null;

  return (
    <View style={s.dishSection}>
      <Text style={s.dishSectionTitle}>Mat & vin</Text>
      {results.map((r, i) => (
        <View key={`${r.dish.id}-${r.wine.id}`} style={s.dishRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.dishName}>{r.dish.name}</Text>
            <Text style={s.dishWine}>{r.wine.name}</Text>
          </View>
          <Text style={s.dishRating}>{r.averageRating.toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
}
```

Add to the `ResultsDashboard` JSX, after the highlights and before the wine list:

```tsx
<DishWinePairings results={results.dishWineResults} />
```

Add styles to the StyleSheet:

```ts
dishSection: { gap: 8 },
dishSectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
dishRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.textLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.surfaceAlt },
dishName: { color: colors.accent, fontSize: 14, fontWeight: "700" },
dishWine: { color: colors.textSecondary, fontSize: 12 },
dishRating: { color: colors.accent, fontSize: 18, fontWeight: "800" },
```

- [ ] **Step 3: Pass dishes to buildSessionResults in TastingSessionPanel**

In `tasting-session-modal.tsx`, update the results view block (where `activeSession.status === "ended"`):

```tsx
const results = buildSessionResults(activeWines, activeTastings, activeSession.format, activeSession.created_at, dishes, tastingDishes);
```

Also update the history expandable session card in `cellar-sections.tsx` — there we don't have dishes data, so the default `[]` params are fine (no changes needed since we added defaults).

- [ ] **Step 4: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-results.ts src/components/results-dashboard.tsx src/components/tasting-session-modal.tsx
git commit -m "feat: add food-wine pairing results to dashboard"
```

---

### Task 8: Manual testing

- [ ] **Step 1: Start the dev server**

```bash
cd /c/Projects/vinkällaren/mobile-app && npx expo start --web
```

- [ ] **Step 2: Test MealPlannerPanel removal**

Navigate to "Min källare" tab. Verify:
- No meal planner panel visible
- Wine list renders normally with no layout issues
- "Mat" filter pill in the filter bar still works

- [ ] **Step 3: Test dish management in tasting session**

1. Create a new tasting session
2. In setup view: add 2-3 dishes (e.g. "Lammracks", "Comté 24 mån")
3. Verify dishes appear as chips with X buttons
4. Remove one dish, verify it disappears
5. Add a couple of wines and start the session

- [ ] **Step 4: Test dish linking during tasting**

1. Tap a wine to taste it
2. Verify dish chips appear between rating and notes
3. Select 1-2 dishes, save the tasting
4. Re-open the same wine's tasting — verify selected dishes are pre-selected
5. Repeat for another wine with different dish selections

- [ ] **Step 5: Test results**

1. End the session
2. Verify "Mat & vin" section appears in results
3. Verify dish-wine combinations are sorted by rating
4. Verify the section doesn't appear if no dishes were linked
