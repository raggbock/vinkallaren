# Tasting Sessions — Design Spec

## Goal

Let users create and host wine tasting sessions where multiple participants taste the same wines, rate them, and compare results — either openly or blind. Sessions are shareable via a short join code.

## Core Concepts

A **session** is a tasting event created by a **host**. The host adds wines, chooses settings, and controls the session lifecycle. **Participants** join via a 6-character code, taste the wines, and submit ratings/notes. Results are visible based on session mode.

## Data Model

### `tasting_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `host_id` | uuid FK → auth.users | Creator |
| `title` | text NOT NULL | e.g. "Italiensk kväll" |
| `join_code` | text UNIQUE NOT NULL | 6 uppercase alphanumeric chars |
| `mode` | text NOT NULL | `'blind'` or `'open'` |
| `format` | text NOT NULL | `'quick'` or `'wset'` |
| `free_order` | boolean NOT NULL DEFAULT false | Participants choose own order |
| `status` | text NOT NULL DEFAULT 'active' | `'active'`, `'revealed'`, `'ended'` |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

### `session_wines`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK → tasting_sessions ON DELETE CASCADE | |
| `position` | integer NOT NULL | Display order (1-based) |
| `name` | text NOT NULL | Wine name |
| `producer` | text | |
| `country` | text | |
| `region` | text | |
| `grape` | text | |
| `vintage` | integer | |
| `type` | text | Rött, Vitt, etc. |
| `wine_id` | uuid FK → wines ON DELETE SET NULL | If added from cellar |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

### `session_tastings`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK → tasting_sessions ON DELETE CASCADE | |
| `session_wine_id` | uuid FK → session_wines ON DELETE CASCADE | |
| `user_id` | uuid FK → auth.users | Participant |
| `rating` | integer CHECK (1-5) | Nullable |
| `notes` | text | Free-text tasting note |
| `food_pairings` | text[] | e.g. `{"lamm","pasta"}` |
| `tasting_data` | jsonb | WSET data (same format as wine_history) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Unique constraint:** `(session_wine_id, user_id)` — one tasting per participant per wine.

### Participation model

No separate participants table. You are a participant if:
- You are `host_id`, OR
- You have at least one row in `session_tastings` for that session

The join code grants access to insert into `session_tastings`.

## RLS Policies

### `tasting_sessions`
- **SELECT:** You can see a session if you are `host_id` OR you have a `session_tastings` row in it OR you look it up by `join_code` (needed for the join flow — a Supabase RPC function `join_session_by_code(code)` handles this securely, returning session info only for active sessions)
- **INSERT:** Any authenticated user (creates session as host)
- **UPDATE:** Only `host_id` (for status changes, settings)
- **DELETE:** Only `host_id`

### `session_wines`
- **SELECT:** Same as session visibility (participant or host)
- **INSERT/UPDATE/DELETE:** Only session's `host_id`

### `session_tastings`
- **SELECT own:** Always see your own tastings
- **SELECT others:** Only if session `mode = 'open'` OR `status IN ('revealed', 'ended')` OR you are `host_id`
- **INSERT:** Any authenticated user for a session with `status = 'active'` (this is how you "join")
- **UPDATE:** Only your own rows, only while `status = 'active'`
- **DELETE:** Only your own rows

## Session Lifecycle

### 1. Create
Host fills in: title, mode (blind/open), format (quick/wset), free order (yes/no). A random 6-char `join_code` is generated (uppercase letters + digits, collision-checked). Status starts as `'active'`.

### 2. Add wines
Host adds wines to the session. Two sources:
- **From cellar:** Pick from own wines → copies name/producer/country/etc + sets `wine_id` reference
- **Manual:** Type in name, producer, etc.

Each wine gets an auto-incrementing `position`. Host can add more wines during the session.

### 3. Share
"Dela provning" button copies to clipboard:
```
Vinprovning: {title} — Gå med med kod: {join_code}
```
No deep linking in V1. Participant opens Vinkällaren, taps "Gå med i provning", enters code.

### 4. Join
Participant enters 6-char code → app looks up session → if found and `status = 'active'`, participant sees the wine list and can start tasting.

### 5. Taste
Participant selects a wine from the list (in order, or freely if `free_order = true`). Fills in:
- **Quick format:** Rating (1-5), notes (text), food pairings (text)
- **WSET format:** Full WSET modal (reuses existing `WsatTastingModal`), plus food pairings

Saved immediately to `session_tastings`. Supabase Realtime broadcasts the insert.

### 6. Live updates
All participants subscribe to Realtime on the `session_tastings` table filtered by `session_id`.
- **Open mode:** See name + rating + notes as they come in
- **Blind mode:** See only "N/M har provsmakat" count per wine, no details

### 7. Reveal (blind only)
Host taps "Avslöja" → `status` changes to `'revealed'` → RLS opens up → all participants see everyone's tastings. Realtime broadcasts the session update.

### 8. End
Host taps "Avsluta" → `status` changes to `'ended'`. Session becomes read-only. Stays in history indefinitely.

## UI Structure

### Entry point
A "Provningar" button in the Min källare panel (secondary button, below filters). Opens a fullscreen modal.

### Tasting Sessions Modal — three views:

**1. Session list**
- Active sessions (yours + ones you've joined)
- Ended sessions (read-only history)
- "Ny provning" button → create flow
- "Gå med" button → enter join code

**2. Active session view**
- Session title, mode badge (blind/öppen), format badge
- Wine list with status per wine:
  - Your tasting status (done/not done)
  - Participant progress ("3/5 har provsmakat")
  - In open mode: expand to see others' ratings
- Host controls (if you are host):
  - "Lägg till vin" button
  - "Avslöja" button (blind mode, sets status to revealed)
  - "Avsluta provning" button
  - "Dela" button (copy join code message)

**3. Tasting view (per wine)**
- Wine info header (name, producer, vintage, type)
- Quick format: rating selector (1-5) + notes input + food pairings input
- WSET format: opens existing `WsatTastingModal`, then food pairings
- Save button → returns to session view

### Results display (revealed/ended)
Each wine expandable to show all participants' tastings side-by-side:
- Name, rating, notes, food pairings
- WSET summary (if wset format)
- Aggregated food pairings highlight ("3 av 4 sa lamm")

## New Files

| File | Responsibility | Est. lines |
|------|---------------|------------|
| `src/types/tasting-session.ts` | Type definitions | ~60 |
| `src/hooks/useTastingSessions.ts` | CRUD, realtime subscription, session state | ~200 |
| `src/lib/session-actions.ts` | Create, join, add wine, save tasting, reveal, end | ~150 |
| `src/components/tasting-session-modal.tsx` | Main modal with list/session/tasting views | ~300 |
| `src/components/session-wine-card.tsx` | Wine card with tasting status and results | ~150 |
| `supabase/migrations/2026XXXX_tasting_sessions.sql` | Tables, RLS, indexes, realtime | ~120 |

All files within the 500-line limit.

## Supabase Realtime Setup

Enable realtime on `session_tastings` and `tasting_sessions` tables. Clients subscribe to:
- `session_tastings` filtered by `session_id` — new tastings coming in
- `tasting_sessions` filtered by `id` — status changes (reveal, end)

RLS applies to realtime subscriptions, so blind mode is enforced server-side.

## Integration with Existing Features

- **WSET modal:** Reused as-is (`WsatTastingModal`), same props
- **Food pairings:** Same format as `wines.food_pairings`, searchable in history
- **History:** Session tastings are separate from `wine_history`. They live in `session_tastings` and are browsable from the session view. Not duplicated into `wine_history` (avoids data duplication, sessions have their own archive).

## Out of Scope (V1)

- Deep linking (join via URL)
- Push notifications
- Participant list/profiles
- Session templates/presets
- Export/share results as image/PDF
- Editing wine order after creation
- Removing participants
