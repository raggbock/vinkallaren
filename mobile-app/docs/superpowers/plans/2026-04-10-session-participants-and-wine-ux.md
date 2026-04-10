# Session Participants + Wine UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the RLS chicken-and-egg bug so guests can see wines, add batch wine selection from cellar, and add drag-and-drop wine reordering.

**Architecture:** One migration adds `session_participants` table and updates three SQL functions. UI changes in `session-forms.tsx` (batch select + remove text fields) and `session-setup-view.tsx` (draggable wine list). New deps for drag-and-drop.

**Tech Stack:** Supabase (migration), React Native, react-native-draggable-flatlist, react-native-reanimated, react-native-gesture-handler

---

### Task 1: Add `session_participants` table and update SQL functions

**Files:**
- Create: `supabase/migrations/20260410120000_session_participants.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260410120000_session_participants.sql`:

```sql
-- session_participants: tracks who joined a session (fixes RLS chicken-and-egg bug)
create table if not exists public.session_participants (
  session_id uuid not null references public.tasting_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table session_participants enable row level security;

-- Participants can see who else is in their session
create policy "participants_select" on session_participants for select using (
  exists (
    select 1 from session_participants sp
    where sp.session_id = session_participants.session_id
    and sp.user_id = auth.uid()
  )
);

-- Only host can remove participants
create policy "participants_delete" on session_participants for delete using (
  exists (
    select 1 from tasting_sessions ts
    where ts.id = session_participants.session_id
    and ts.host_id = auth.uid()
  )
);

-- Insert handled by RPC functions (security definer), not direct insert

-- Update is_session_participant to check session_participants
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from session_participants
    where session_id = p_session_id and user_id = auth.uid()
  );
$$;

-- Update join_session_by_code to also insert into session_participants
create or replace function public.join_session_by_code(code text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  sess record;
begin
  select id, title, host_id, join_code, mode, format, free_order, status, created_at
  into sess
  from tasting_sessions
  where join_code = upper(code) and status in ('setup', 'active');

  if not found then
    return json_build_object('error', 'Session not found or not active');
  end if;

  -- Register as participant (ignore if already joined)
  insert into session_participants (session_id, user_id)
  values (sess.id, auth.uid())
  on conflict do nothing;

  return json_build_object(
    'id', sess.id,
    'title', sess.title,
    'host_id', sess.host_id,
    'join_code', sess.join_code,
    'mode', sess.mode,
    'format', sess.format,
    'free_order', sess.free_order,
    'status', sess.status,
    'created_at', sess.created_at
  );
end;
$$;

-- Update get_session_participants to use session_participants
create or replace function public.get_session_participants(p_session_id uuid)
returns json
language sql security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'avatar_color', p.avatar_color
  )), '[]'::json)
  from profiles p
  where p.id in (
    select sp.user_id from session_participants sp where sp.session_id = p_session_id
  );
$$;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the migration SQL against the project using `mcp__plugin_supabase_supabase__apply_migration`.

- [ ] **Step 3: Auto-join host on session creation**

In `src/lib/session-actions.ts`, after the `createSession` insert succeeds, insert the host into `session_participants`:

```typescript
// Inside createSession, after the session insert succeeds:
const { error: joinErr } = await supabase
  .from("session_participants")
  .insert({ session_id: data.id, user_id: userId });
if (joinErr) console.warn("Host auto-join failed:", joinErr.message);
```

Add this right after line ~24 where `data` is returned from the session insert.

- [ ] **Step 4: Verify with sim scripts**

Run: `node scripts/sim-join-session.mjs ADWTCC 2`
Then: `node scripts/sim-taste-wines.mjs sim-guests-ADWTCC.json`

Expected: Both scripts succeed — guests can now read session_wines.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260410120000_session_participants.sql src/lib/session-actions.ts
git commit -m "fix: add session_participants table to resolve RLS chicken-and-egg bug"
```

---

### Task 2: Install drag-and-drop dependencies and wrap app root

**Files:**
- Modify: `App.tsx` (wrap root in GestureHandlerRootView)

- [ ] **Step 1: Install packages**

```bash
npx expo install react-native-gesture-handler react-native-reanimated react-native-draggable-flatlist
```

- [ ] **Step 2: Add reanimated plugin to babel config**

Check if `babel.config.js` already has the reanimated plugin. If not, add `'react-native-reanimated/plugin'` as the last item in the plugins array.

- [ ] **Step 3: Wrap app root in GestureHandlerRootView**

In `App.tsx`, import `GestureHandlerRootView` from `react-native-gesture-handler` and wrap the outermost `<View>` in `<GestureHandlerRootView style={{ flex: 1 }}>`.

- [ ] **Step 4: Verify app starts**

Run: `npx expo start --web` and confirm no crashes.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json babel.config.js App.tsx
git commit -m "chore: install drag-and-drop dependencies and wrap app root"
```

---

### Task 3: Add `reorderSessionWines` action and batch-add support

**Files:**
- Modify: `src/lib/session-actions.ts`

- [ ] **Step 1: Add reorderSessionWines function**

```typescript
export async function reorderSessionWines(
  sessionId: string,
  wineIds: string[],
): Promise<Result<true>> {
  // Update each wine's position based on array index
  const updates = wineIds.map((id, i) =>
    supabase.from("session_wines").update({ position: i + 1 }).eq("id", id).eq("session_id", sessionId)
  );
  const results = await Promise.all(updates);
  const err = results.find((r) => r.error);
  if (err?.error) return fail(err.error.message);
  return ok(true);
}
```

- [ ] **Step 2: Add batchAddWinesToSession function**

```typescript
export async function batchAddWinesToSession(
  sessionId: string,
  startPosition: number,
  wines: Array<{ name: string; producer: string | null; vintage: number | null; wine_id: string | null }>,
): Promise<Result<SessionWineRow[]>> {
  const rows = wines.map((w, i) => ({
    session_id: sessionId,
    position: startPosition + i,
    name: w.name,
    producer: w.producer,
    vintage: w.vintage,
    wine_id: w.wine_id,
  }));
  const { data, error } = await supabase.from("session_wines").insert(rows).select();
  if (error) return fail(error.message);
  return ok(data as SessionWineRow[]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/session-actions.ts
git commit -m "feat: add reorderSessionWines and batchAddWinesToSession actions"
```

---

### Task 4: Rebuild AddWineForm with batch cellar selection

**Files:**
- Modify: `src/components/session-forms.tsx`

- [ ] **Step 1: Rewrite AddWineForm**

Replace the current `AddWineForm` (lines 147-226) with a new version:

- **Props:** Same as before: `sessionId`, `wineCount`, `wines` (cellar wines), `searchWineNames`
- **Source toggle:** Keep "Sök" and "Från källaren" toggle
- **Search mode:** `AutocompleteInput` as before. When a result is selected, call `addWineToSession` directly with the selected wine's data (no intermediate text fields). Show inline success/error.
- **Cellar mode:** Show cellar wines with checkboxes. Filter input at top. A `selectedIds: Set<string>` state tracks checked wines. A "Lagg till X viner" button calls `batchAddWinesToSession`. After success, clear selection.
- **Remove:** The three `LabeledInput` fields for Name, Producer, Vintage. Remove the `prefill` function. Remove `name`, `producer`, `vintage` state vars.

```tsx
export function AddWineForm({ sessionId, wineCount, wines, searchWineNames, onWinesAdded }: {
  sessionId: string; wineCount: number; wines: WineRecord[];
  searchWineNames: (query: string, offset?: number) => Promise<{ suggestions: Suggestion[]; hasMore: boolean; nextOffset: number }>;
  onWinesAdded?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState<"manual" | "cellar">("cellar");
  const [cellarFilter, setCellarFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCellarWines = cellarFilter.length >= 2
    ? wines.filter((w) => w.name.toLowerCase().includes(cellarFilter.toLowerCase())).slice(0, 20)
    : wines.slice(0, 20);

  function toggleWine(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBatchAdd() {
    const selected = wines.filter((w) => selectedIds.has(w.id));
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    const result = await batchAddWinesToSession(
      sessionId,
      wineCount + 1,
      selected.map((w) => ({ name: w.name, producer: w.producer, vintage: w.vintage, wine_id: w.id })),
    );
    setSaving(false);
    if (result.error) { setError("Kunde inte lagga till viner"); return; }
    setSelectedIds(new Set());
    setCellarFilter("");
    setExpanded(false);
    onWinesAdded?.();
  }

  async function handleSearchSelect(wineName: string, parentName: string | null) {
    setSaving(true);
    setError(null);
    const result = await addWineToSession({
      session_id: sessionId,
      position: wineCount + 1,
      name: wineName,
      producer: parentName || null,
      vintage: null,
      wine_id: null,
    });
    setSaving(false);
    if (result.error) { setError("Kunde inte lagga till vin"); return; }
    onWinesAdded?.();
  }

  return (
    <View>
      <Pressable onPress={() => setExpanded(!expanded)} style={s.secondaryBtn}>
        <Text style={s.secondaryBtnText}>{expanded ? "Dolj" : "+ Lagg till vin"}</Text>
      </Pressable>
      <Expandable expanded={expanded}>
        <View style={s.formSection}>
          <SuggestionRow title="Kalla" options={["Sok", "Fran kallaren"]}
            selected={source === "manual" ? "Sok" : "Fran kallaren"}
            onSelect={(v: string) => setSource(v === "Sok" ? "manual" : "cellar")} />

          {source === "cellar" ? (
            <>
              <LabeledInput label="Filtrera" value={cellarFilter}
                onChangeText={setCellarFilter} placeholder="Sok bland dina viner..." />
              {filteredCellarWines.map((w) => (
                <Pressable key={w.id} style={[s.cellarPick, selectedIds.has(w.id) && s.cellarPickSelected]}
                  onPress={() => toggleWine(w.id)}>
                  <Text style={s.cellarPickName}>{selectedIds.has(w.id) ? "\u2611 " : "\u2610 "}{w.name}</Text>
                  <Text style={s.cellarPickMeta}>{[w.producer, w.vintage].filter(Boolean).join(" \u00B7 ")}</Text>
                </Pressable>
              ))}
              {selectedIds.size > 0 ? (
                <Pressable onPress={handleBatchAdd} style={s.primaryBtn} disabled={saving}>
                  <Text style={s.primaryBtnText}>
                    {saving ? "Lagger till..." : `Lagg till ${selectedIds.size} vin${selectedIds.size > 1 ? "er" : ""}`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <AutocompleteInput label="Sok vin" value="" onChangeText={() => {}}
              onOptionSelected={handleSearchSelect}
              options={[]} searchAsync={searchWineNames}
              placeholder="Skriv minst 4 bokstaver" minimumQueryLength={4} />
          )}

          <InlineError message={error} />
        </View>
      </Expandable>
    </View>
  );
}
```

Add `cellarPickSelected` style:
```typescript
cellarPickSelected: { borderColor: colors.accent, borderWidth: 2 },
```

- [ ] **Step 2: Update imports**

Add `batchAddWinesToSession` to the import from `../lib/session-actions`.

- [ ] **Step 3: Verify build**

Run: `npx expo export --platform web` — should compile without errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/session-forms.tsx
git commit -m "feat: batch wine selection from cellar, remove redundant text fields"
```

---

### Task 5: Add drag-and-drop wine reordering to setup view

**Files:**
- Modify: `src/components/session-setup-view.tsx`

- [ ] **Step 1: Replace static wine list with DraggableFlatList**

In `session-setup-view.tsx`:

Import `DraggableFlatList` and `ScaleDecorator` from `react-native-draggable-flatlist`, and `reorderSessionWines` from `../lib/session-actions`.

Add `onReorder` prop to the component:
```typescript
type Props = {
  session: TastingSessionRow;
  wines: SessionWineRow[];
  participants: SessionParticipant[];
  isHost: boolean;
  onStart: () => void;
  onBack: () => void;
  onReorder: (wines: SessionWineRow[]) => void;
  children?: React.ReactNode;
};
```

Replace the wine list section (lines 65-78) with:

```tsx
{wines.length > 0 ? (
  <View style={s.section}>
    <Text style={s.sectionTitle}>Viner ({wines.length})</Text>
    {isHost ? (
      <DraggableFlatList
        data={wines}
        keyExtractor={(item) => item.id}
        onDragEnd={async ({ data }) => {
          onReorder(data);
          await reorderSessionWines(session.id, data.map((w) => w.id));
        }}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <Pressable onLongPress={drag} disabled={isActive}
              style={[s.wineRow, isActive && s.wineRowDragging]}>
              <Text style={s.dragHandle}>≡</Text>
              <Text style={s.winePosition}>{item.position}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.wineName}>{item.name}</Text>
                {item.producer ? <Text style={s.wineMeta}>{item.producer}</Text> : null}
              </View>
            </Pressable>
          </ScaleDecorator>
        )}
        scrollEnabled={false}
      />
    ) : (
      wines.map((w) => (
        <View key={w.id} style={s.wineRow}>
          <Text style={s.winePosition}>{w.position}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.wineName}>{w.name}</Text>
            {w.producer ? <Text style={s.wineMeta}>{w.producer}</Text> : null}
          </View>
        </View>
      ))
    )}
  </View>
) : null}
```

- [ ] **Step 2: Add drag styles**

Add to the StyleSheet:
```typescript
wineRowDragging: { opacity: 0.8, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
dragHandle: { color: colors.textSecondary, fontSize: 20, width: 24, textAlign: "center" },
```

- [ ] **Step 3: Wire up onReorder in parent**

Find where `SessionSetupView` is used (in `tasting-session-modal.tsx` or similar). Pass `onReorder` that updates local wine state with the new order:

```typescript
onReorder={(reordered) => setActiveWines(reordered.map((w, i) => ({ ...w, position: i + 1 })))}
```

- [ ] **Step 4: Verify build and test drag-and-drop**

Run: `npx expo start --web`
Test: Open a session in setup, long-press a wine, drag to reorder.

- [ ] **Step 5: Commit**

```bash
git add src/components/session-setup-view.tsx
git commit -m "feat: drag-and-drop wine reordering in session setup"
```

---

## Post-Implementation

- Run `npm run web:build` to verify production build
- Test the full flow: create session, batch-add wines, reorder, invite guests, guests can see wines
- Run sim scripts to verify the RLS fix works end-to-end
