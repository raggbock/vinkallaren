# User Dishes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save custom dishes with categories, shown as extra groups in the food pairing picker when adding wines.

**Architecture:** New `user_dishes` table stores per-user dishes with optional category. A hook fetches them and groups by category. `GroupedSuggestionRow` in `cellar-fields.tsx` gets the user groups appended after `FOOD_CATEGORIES`. An inline "add dish" row at the bottom lets users create dishes with a category picker.

**Tech Stack:** React Native, TypeScript, Supabase (PostgreSQL + RLS)

---

### Task 1: Database migration — user_dishes

**Files:**
- Create: `supabase/migrations/20260412110000_user_dishes.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.user_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_user_dishes_user on user_dishes (user_id);

alter table user_dishes enable row level security;

create policy "user_dishes_select" on user_dishes for select using (user_id = auth.uid());
create policy "user_dishes_insert" on user_dishes for insert with check (user_id = auth.uid());
create policy "user_dishes_update" on user_dishes for update using (user_id = auth.uid());
create policy "user_dishes_delete" on user_dishes for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Apply migration via Supabase MCP**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260412110000_user_dishes.sql
git commit -m "feat: add user_dishes table"
```

---

### Task 2: TypeScript types and data-access functions

**Files:**
- Create: `src/types/user-dish.ts`
- Create: `src/lib/user-dish-actions.ts`

- [ ] **Step 1: Create types**

`src/types/user-dish.ts`:
```ts
export type UserDishRow = {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Create data-access functions**

`src/lib/user-dish-actions.ts`:
```ts
import { ok, fail, type Result } from "../types/result";
import { supabase } from "./supabase";
import type { UserDishRow } from "../types/user-dish";

export async function fetchUserDishes(): Promise<Result<UserDishRow[]>> {
  const { data, error } = await supabase
    .from("user_dishes")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as UserDishRow[]);
}

export async function addUserDish(name: string, category: string | null): Promise<Result<UserDishRow>> {
  const { data, error } = await supabase
    .from("user_dishes")
    .upsert({ user_id: (await supabase.auth.getUser()).data.user?.id, name, category }, { onConflict: "user_id,name" })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return ok(data as UserDishRow);
}

export async function deleteUserDish(dishId: string): Promise<Result<true>> {
  const { error } = await supabase.from("user_dishes").delete().eq("id", dishId);
  if (error) return fail(error.message);
  return ok(true);
}
```

- [ ] **Step 3: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/types/user-dish.ts src/lib/user-dish-actions.ts
git commit -m "feat: add user dish types and data-access functions"
```

---

### Task 3: Hook to fetch and group user dishes

**Files:**
- Create: `src/hooks/useUserDishes.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUserDishes, addUserDish, deleteUserDish } from "../lib/user-dish-actions";
import type { UserDishRow } from "../types/user-dish";

export function useUserDishes() {
  const [dishes, setDishes] = useState<UserDishRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserDishes().then((r) => {
      if (r.data) setDishes(r.data);
      setLoading(false);
    });
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of dishes) {
      const cat = d.category || "Mina rätter";
      const arr = map.get(cat) ?? [];
      arr.push(d.name);
      map.set(cat, arr);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [dishes]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const d of dishes) {
      if (d.category) cats.add(d.category);
    }
    return [...cats].sort();
  }, [dishes]);

  const handleAdd = useCallback(async (name: string, category: string | null) => {
    const r = await addUserDish(name.trim(), category?.trim() || null);
    if (r.data) setDishes((prev) => [...prev.filter((d) => d.name.toLowerCase() !== name.trim().toLowerCase()), r.data!]);
    return r;
  }, []);

  const handleDelete = useCallback(async (dishId: string) => {
    const r = await deleteUserDish(dishId);
    if (r.data) setDishes((prev) => prev.filter((d) => d.id !== dishId));
  }, []);

  return { dishes, groups, categories, loading, addDish: handleAdd, deleteDish: handleDelete };
}
```

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useUserDishes.ts
git commit -m "feat: add useUserDishes hook"
```

---

### Task 4: Add dish inline component

**Files:**
- Create: `src/components/add-dish-inline.tsx`

- [ ] **Step 1: Create the component**

A compact row with dish name input, category picker (chips + "Ny kategori..."), and add button.

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../styles/theme";
import { FOOD_CATEGORIES } from "../lib/cellar-helpers";

type Props = {
  userCategories: string[];
  onAdd: (name: string, category: string | null) => void;
};

export function AddDishInline({ userCategories, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const allCategories = [
    ...FOOD_CATEGORIES.map((c) => c.label),
    ...userCategories.filter((c) => !FOOD_CATEGORIES.some((fc) => fc.label === c)),
  ];

  function handleAdd() {
    const dishName = name.trim();
    if (!dishName) return;
    const cat = showNewCat ? newCategory.trim() || null : category;
    onAdd(dishName, cat);
    setName("");
    setCategory(null);
    setNewCategory("");
    setShowNewCat(false);
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={s.openBtn}>
        <Text style={s.openBtnText}>+ Lägg till egen maträtt</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.container}>
      <TextInput
        style={s.input}
        placeholder="Namn på maträtt..."
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        returnKeyType="done"
      />

      <Text style={s.label}>Kategori</Text>
      <View style={s.chipRow}>
        {allCategories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => { setCategory(cat); setShowNewCat(false); }}
            style={[s.chip, category === cat && !showNewCat && s.chipActive]}
          >
            <Text style={[s.chipText, category === cat && !showNewCat && s.chipTextActive]}>{cat}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => { setShowNewCat(true); setCategory(null); }}
          style={[s.chip, showNewCat && s.chipActive]}
        >
          <Text style={[s.chipText, showNewCat && s.chipTextActive]}>Ny kategori...</Text>
        </Pressable>
      </View>

      {showNewCat ? (
        <TextInput
          style={s.input}
          placeholder="Kategorinamn..."
          placeholderTextColor={colors.textSecondary}
          value={newCategory}
          onChangeText={setNewCategory}
          autoFocus
        />
      ) : null}

      <View style={s.actionRow}>
        <Pressable onPress={handleAdd} style={[s.addBtn, !name.trim() && s.addBtnDisabled]} disabled={!name.trim()}>
          <Text style={s.addBtnText}>Lägg till</Text>
        </Pressable>
        <Pressable onPress={() => { setOpen(false); setName(""); setCategory(null); setShowNewCat(false); }} style={s.cancelBtn}>
          <Text style={s.cancelBtnText}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8, backgroundColor: colors.textLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.surfaceAlt },
  openBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.textLight, borderWidth: 1, borderColor: colors.surfaceAlt },
  openBtnText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  input: { backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceAlt },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.textLight },
  actionRow: { flexDirection: "row", gap: 8 },
  addBtn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: colors.textLight, fontWeight: "700", fontSize: 14 },
  cancelBtn: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  cancelBtnText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
});
```

- [ ] **Step 2: Verify build**

- [ ] **Step 3: Commit**

```bash
git add src/components/add-dish-inline.tsx
git commit -m "feat: add AddDishInline component"
```

---

### Task 5: Wire user dishes into cellar-fields and add-wine flow

**Files:**
- Modify: `src/components/cellar-fields.tsx`
- Modify: `src/components/add-wine-tab.tsx`

- [ ] **Step 1: Add useUserDishes to AddWineTabContent and pass to CellarFields**

In `add-wine-tab.tsx`, inside `AddWineTabContent`:

Add import:
```ts
import { useUserDishes } from "../hooks/useUserDishes";
```

Add hook call inside the function body:
```ts
const userDishes = useUserDishes();
```

Pass to `<AddWinePanel>` — but AddWinePanel passes through to CellarFields. The simplest approach: pass `userDishes` as a new prop on `AddWinePanel`, which passes it through to `CellarFields`.

However, to avoid prop drilling through AddWinePanel, pass directly to CellarFields. But CellarFields is rendered inside AddWinePanel...

Better approach: Add `userDishGroups`, `userCategories`, and `onAddDish` to `CellarFields` props. Pass from AddWinePanel, which gets them from AddWineTab.

In `add-wine-panel.tsx`, add to `AddWinePanelProps`:
```ts
userDishGroups: Array<{ label: string; items: string[] }>;
userCategories: string[];
onAddUserDish: (name: string, category: string | null) => void;
```

Pass them through to `<CellarFields>`.

In `add-wine-tab.tsx`, pass to `<AddWinePanel>`:
```tsx
userDishGroups={userDishes.groups}
userCategories={userDishes.categories}
onAddUserDish={userDishes.addDish}
```

- [ ] **Step 2: Update CellarFields to show user dish groups and AddDishInline**

In `cellar-fields.tsx`:

Add imports:
```ts
import { AddDishInline } from "./add-dish-inline";
```

Add props:
```ts
userDishGroups: Array<{ label: string; items: string[] }>;
userCategories: string[];
onAddUserDish: (name: string, category: string | null) => void;
```

Update the `GroupedSuggestionRow` to include user groups:
```tsx
<GroupedSuggestionRow
  title="Matförslag"
  groups={[...FOOD_CATEGORIES, ...userDishGroups]}
  selected={parseTags(draft.foodPairings)}
  onSelect={(pairing) => onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, pairing) })}
/>
<AddDishInline
  userCategories={userCategories}
  onAdd={(name, category) => {
    onAddUserDish(name, category);
    onDraftChange({ foodPairings: mergeTagText(draft.foodPairings, name) });
  }}
/>
```

- [ ] **Step 3: Update add-wine-panel.tsx to accept and pass through props**

Add the three new props to `AddWinePanelProps` and pass them to `<CellarFields>`:
```tsx
<CellarFields
  styles={styles}
  draft={draft}
  // ... existing props ...
  userDishGroups={props.userDishGroups}
  userCategories={props.userCategories}
  onAddUserDish={props.onAddUserDish}
/>
```

- [ ] **Step 4: Verify build**

Run: `cd /c/Projects/vinkällaren/mobile-app && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/cellar-fields.tsx src/components/add-wine-tab.tsx src/components/add-wine-panel.tsx
git commit -m "feat: wire user dishes into add-wine flow"
```
