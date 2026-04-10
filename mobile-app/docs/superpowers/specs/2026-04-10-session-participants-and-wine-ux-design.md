# Session Participants + Wine UX Fixes — Design Spec

## Problem

Three related issues in tasting session setup:

1. **Chicken-and-egg RLS bug:** `is_session_participant()` checks `session_tastings`, but guests need to read `session_wines` before they can create tastings. Guests who join via code can't see the wine list.

2. **Redundant text fields:** After selecting a wine (from search or cellar), the user still sees editable Name/Producer/Vintage fields. These add friction and serve no purpose — the selection already has this data.

3. **No wine reordering:** Wines are locked in insertion order. Host can't rearrange them after adding.

## Fix 1: `session_participants` table

**New table:**
```sql
session_participants (
  session_id uuid references tasting_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (session_id, user_id)
)
```

**Changes to existing SQL functions:**
- `join_session_by_code`: INSERT into `session_participants` when guest joins
- `is_session_participant`: Check `session_participants` instead of `session_tastings`
- `get_session_participants`: Join `session_participants` with `profiles` instead of `session_tastings`

**RLS on `session_participants`:**
- SELECT: participants can see other participants in same session
- INSERT: via `join_session_by_code` RPC (security definer)
- DELETE: host only

**Host auto-join:** When creating a session, the host should also be inserted into `session_participants` so they appear in the participant list.

## Fix 2: Batch wine selection from cellar

**Remove:** The three `LabeledInput` fields for Name, Producer, Vintage (lines 214-216 of `session-forms.tsx`). These are redundant — wine data comes from the selection.

**Cellar mode changes:**
- Each cellar wine gets a checkbox instead of being a tap-to-prefill
- Multi-select: user checks multiple wines
- "Lagg till X viner" batch button inserts all at once
- After batch insert, checkboxes reset

**Search mode:** Keep `AutocompleteInput` as-is. When a search result is selected, add it directly (no intermediate text fields). The `prefill` function becomes a direct `handleAdd` call.

## Fix 3: Drag-and-drop wine reordering

**New dependencies:** `react-native-draggable-flatlist`, `react-native-reanimated`, `react-native-gesture-handler`

**App root change:** Wrap root in `GestureHandlerRootView` (required by gesture-handler).

**Setup view wine list:** Replace the static wine list in `SessionSetupView` with a `DraggableFlatList`. Each row gets a drag handle. On drag end, update positions in database.

**New action:** `reorderSessionWines(sessionId, wineIds)` — batch-updates positions based on array order.

**Host-only:** Only the host sees drag handles and can reorder.
