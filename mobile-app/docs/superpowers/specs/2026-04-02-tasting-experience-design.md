# Tasting Experience Upgrade — Design Spec

## Goal

Transform the wine tasting feature from a functional tool into a compelling social experience. Focus on what happens after the tasting (results, profiles, sharing) while improving the flow during the session (overview, onboarding, reveal).

## Target Scenarios

- **Home tasting** — 3-5 friends around a table, 4-6 wines, casual Friday evening
- **Wine club** — 8-15 people, themed tastings, more structured setting

## Architecture

Six independent subsystems that build on the existing tasting infrastructure (sessions, WSET protocol, realtime subscriptions, join codes). No changes to the core tasting recording flow (create session → add wines → taste → save).

**Subsystems:**
1. User profiles & display names (foundation — other systems depend on this)
2. Join flow improvements (shareable links + guest onboarding)
3. Session overview improvements (progress tracking during session)
4. Reveal ceremony (step-by-step blind reveal)
5. Results dashboard (format-adapted post-session view)
6. Personal taste profile (aggregated from all sessions)

## Tech Stack

- React Native / Expo (existing)
- Supabase: Postgres + RLS + Realtime (existing)
- No new external dependencies

---

## 1. User Profiles & Display Names

### Problem
No participant identity — sessions show user IDs or email fragments. Avatars, results, and social features all need a display name.

### Design

**First-time prompt:** After login/signup, if `display_name` is null or empty, show a blocking modal: "Välj ett användarnamn". Free text, minimum 2 characters. Guest users get the same prompt when joining a session. Can be skipped — generates "Gäst" + 4 random digits.

**Avatar generation:** Automatic — first letter of display name + a deterministic colour derived from user_id (hash to HSL hue, fixed saturation/lightness in the wine-red palette). Stored as `avatar_color` on profiles table. No image upload.

**Profile page:** Accessed via a settings icon in the "Min källare" panel header. Shows:
- Display name (editable inline)
- Taste profile summary (from subsystem 6)
- Tasting history (list of past sessions)
- Sign out button (moved here from panel header)

**Database changes:**
- Ensure `profiles.display_name` is prompted and set (column exists already)
- Add `profiles.avatar_color TEXT` — hex colour, generated on first save
- RLS: users can read all profiles (for session participant display), update only own

---

## 2. Join Flow Improvements

### Problem
Joining requires the app + manual code entry. High friction for new users at a tasting evening.

### Design

**Shareable link:** Host taps "Dela" and gets a link: `minvinkallare.se/join/ABC123`. The 6-char code is embedded in the URL path.

**Link behaviour:**
1. **Logged in user:** Route parses code, calls `join_session_by_code`, navigates to session
2. **Not logged in:** Landing page shows session title + host name + "Logga in för att gå med" and "Testa utan konto" (guest sign-in). After auth, auto-joins the session.
3. **No app (web):** Works identically — the app is a web app on Cloudflare Pages

**Code still works:** The manual "Gå med (kod)" button remains as fallback.

**Guest display name:** After guest sign-in via join link, immediately prompt for display name before entering the session.

**Implementation:**
- Add route handling in App.tsx: parse `/join/:code` from URL on web
- Store pending join code in state, execute join after auth completes
- Share button uses `Share` API on native, clipboard + toast on web
- `buildShareMessage()` updated to include link instead of just code

---

## 3. Session Overview Improvements

### Problem
During a session, participants lack overview of group progress. Host can't see who has tasted what.

### Design

**Session header (always visible when session is open):**
- Title + badges: mode ("Blind"/"Öppen") and format ("Quick"/"WSET")
- Participant row: avatar circles for all participants. Subtle pulse animation on participants who are currently active (have tasted recently).
- Personal progress: "3 av 5 viner smakade" — small progress bar

**Wine list — enhanced cards:**
- Each wine card shows progress dots: one dot per participant, filled = has tasted
- In blind mode: dots show tasting status only, no data
- In open mode: show live average rating (updates via realtime)
- Visual state: untasted wines = muted opacity, tasted = full opacity with checkmark
- Wine card is tappable to open the tasting form (unchanged)

**Host extras:**
- Full progress matrix visible: which participants have tasted which wines
- Notification when all participants have tasted a wine: "Alla har smakat [vinnamn]"
- Reveal button becomes prominent (pulsing border) when all wines are tasted by all participants
- End button always available but with confirmation

**Database changes:** None — all data derivable from existing `session_tastings` table via realtime subscriptions.

---

## 4. Reveal Ceremony (Blind Mode)

### Problem
"Avslöja" button instantly shows everything. No drama, no shared moment.

### Design

**Trigger:** Host taps "Avslöja alla viner". Confirmation dialog: "Starta avslöjningen? Alla kommer se resultaten ett vin i taget."

**Session status flow:** `active` → `revealing` → `ended`

New status `revealing` indicates the step-by-step reveal is in progress. When all wines are revealed, status transitions to `ended`. RLS updated: during `revealing`, data is released per-wine as the host advances.

**Reveal sequence (one wine at a time):**

1. Wine identity revealed — "Vin #1 var..." + name, producer, vintage slide in
2. Participant ratings appear one by one — avatar + rating/quality with staggered animation
3. Consensus badge fades in — "Eniga" (low spread) or "Delade meningar" (high spread)
4. Brief pause — group discusses at the table
5. Host taps "Nästa vin" → repeats for next wine

**After last wine:** Auto-transition to results dashboard with a summary animation.

**Tempo:** Entirely host-controlled. No auto-advance, no timers. The host taps "Nästa vin" when the table is ready.

**Open mode:** No reveal ceremony. Host taps "Avsluta provning" → status goes directly to `ended` → results dashboard appears.

**Implementation:**
- New session status: `revealing`
- New column `tasting_sessions.revealed_up_to INTEGER DEFAULT 0` — tracks how many wines have been revealed (by position)
- Host advances by incrementing `revealed_up_to`
- RLS for session_tastings during `revealing`: only show tastings for wines with position ≤ revealed_up_to
- Realtime broadcasts status + revealed_up_to changes to all participants
- New RevealView component with animations (React Native Animated API)

**Database changes:**
- Add `tasting_sessions.revealed_up_to INTEGER DEFAULT 0`
- Update status CHECK constraint: `status IN ('active', 'revealing', 'ended')`
- Remove `revealed` status — `revealing` with `revealed_up_to = wine_count` replaces it
- Update RLS on session_tastings: during `revealing`, SELECT others' tastings only for wines where position ≤ session's revealed_up_to

---

## 5. Results Dashboard

### Problem
After reveal/end, no summary exists. Tastings just stop.

### Design

**Entry point:** Automatically shown after reveal ceremony completes (blind) or when host ends session (open). Also accessible from tasting history at any time.

**Common header (both formats):**
- Stats row: wine count, participant count, date
- "Gruppens favorit" — wine with highest average rating (Quick) or most common quality ≥ "good" (WSET)
- "Mest delade meningar" — wine with highest rating spread

### Quick Format Results

- Wine list sorted by average rating (descending)
- Each wine: name, average rating (1-5 with one decimal), consensus badge
- Expand a wine → see each participant's rating, notes, food pairings
- Common taste tags across all notes (simple word frequency from notes text)

### WSET Format Results

- Wine list sorted by average quality level
- Each wine: name, average quality, consensus badge
- Expand a wine → structured comparison:
  - Parameter bars: "Syra: 3 hög, 1 medium" — visual horizontal bars
  - Shared aromas: tags that 2+ participants identified
  - "Delade meningar om..." — parameters where participants disagreed most
  - Each participant's full WSET summary (collapsible)

### Shareable Summary

- "Dela kvällen" button at bottom of results
- Generates a styled view optimized for screenshots:
  - Dark background (matching app theme), logo at top
  - Session title, date, participant names
  - Wine list with ratings/quality and highlights
  - "Provad med Vinkällaren — minvinkallare.se"
- On web: rendered as a styled div. On native: could use `ViewShot` library (future enhancement, screenshot for now)

**Implementation:**
- New `ResultsDashboard` component with Quick and WSET sub-views
- Aggregation logic in a pure helper: `buildSessionResults(wines, tastings, format)` → computed stats
- Consensus calculation: standard deviation of ratings. Low σ = "Eniga", high σ = "Delade meningar". Threshold: σ < 0.8 = consensus.
- WSET parameter comparison: count occurrences of each option per parameter across participants
- No new database tables — all derived from existing session_tastings data

---

## 6. Personal Taste Profile

### Problem
No learning from past tastings. Each session is isolated — no accumulated self-knowledge.

### Design

**Location:** Accessible from the profile page (subsystem 1). Shows data aggregated from all sessions the user has participated in.

**Minimum data requirement:** At least 2 completed sessions with tastings. Before that, show: "Drick mer vin! Din smakprofil byggs upp efter 2 provningar."

### Content

**Taste preferences (WSET data only):**
- Visual bars for average values across wines rated "good" or higher:
  - Acidity, body, sweetness, tannin, alcohol
- Summary text: "Du föredrar torra viner med hög syra och medelfyllig kropp"
- Only includes wines the user rated quality ≥ "good" (preferences = what you like, not everything you've tasted)

**Top regions & grapes:**
- From all tasted wines (not just high-quality): which regions/grapes appeared most in sessions
- "Dina topp 3 regioner: Piemonte, Bourgogne, Rioja"
- Only shown if enough data (5+ wines with region/grape data)

**Tasting stats:**
- Total sessions attended
- Total wines tasted
- Date of last session
- Most common format (Quick vs WSET)

**Tasting history:**
- Chronological list of past sessions
- Each shows: title, date, wine count, participants
- Tap to open that session's results dashboard

**Taste evolution (future, not in this spec):**
- Requires 4+ WSET sessions over time
- Trend lines for preferences
- Marked as out-of-scope — noted here for future reference only

**Implementation:**
- New `TasteProfile` component
- Aggregation helper: `buildTasteProfile(allSessionTastings, allSessionWines)` → profile data
- Query: fetch all session_tastings + session_wines for user across all ended sessions
- No new database tables — all derived from existing data
- Cache-friendly: profile recalculated on page open, not stored

---

## Scope Boundaries

**In scope:**
- Everything described in subsystems 1-6
- Bug fix: pass wine type to WSET modal in session tasting (currently hardcoded empty string)

**Out of scope (future work):**
- Taste evolution trends over time
- Push notifications
- Chat/messaging in sessions
- Tasting templates/themes
- Third tasting format
- Wine images in sessions
- PDF/CSV export of results
- Freemium paywall (monetization)

## Implementation Order

Subsystems have dependencies:

1. **User profiles** (foundation — everything else shows usernames/avatars)
2. **Join flow** (depends on profiles for guest name prompt)
3. **Session overview** (depends on profiles for avatars)
4. **Results dashboard** (independent of 2-3, but needs profiles)
5. **Reveal ceremony** (depends on results dashboard as the destination after reveal)
6. **Personal taste profile** (depends on results dashboard patterns, profiles)

Recommended build order: 1 → 2 → 3 → 4 → 5 → 6
