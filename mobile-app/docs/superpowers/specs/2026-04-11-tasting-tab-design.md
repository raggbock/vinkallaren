# Spec: Provnings-flik (ersätter Måltid)

**Date:** 2026-04-11
**Status:** Approved

## Summary

Replace the "Måltid" bottom tab with "Provning" to give tasting sessions first-class navigation. The meal planner moves to a section within the Källare tab.

## Navigation Changes

Bottom tabs become: **Källare** | **Lägg till** | **Historik** | **Provning**

In `src/types/cellar.ts`, update `CELLAR_SECTIONS`:
- Remove `"meal"` entry
- Add `"tasting"` entry with label "Provning" and wine-glass icon

## Provning Tab Layout

### Active Sessions (top)

Cards for sessions where the user is a participant and status is `setup` or `active`:
- Title, participant count, wine count, status badge ("Uppställning" / "Pågår")
- Tap opens the session view (reuse existing `TastingSessionPanel` sub-views)
- If no active sessions: subtle empty state "Ingen pågående provning"

### Quick Actions (middle)

Two prominent buttons side by side:
- "Skapa provning" — opens CreateForm inline below
- "Gå med (kod)" — opens JoinForm inline below

### Ended Sessions (bottom)

List of sessions with status `ended`, newest first:
- Title, date, favorite wine (highest avg rating), participant count
- Tap opens ResultsDashboard for that session
- If no ended sessions: "Inga avslutade provningar ännu"

## Component Structure

### New files

| File | Purpose | Est. lines |
|------|---------|------------|
| `src/components/tasting-tab.tsx` | Tab container — renders active cards, quick actions, ended list | ~150 |
| `src/components/active-session-card.tsx` | Card for an active/setup session | ~60 |
| `src/components/ended-session-row.tsx` | Row for an ended session | ~50 |

### Reused from existing TastingSessionPanel

- `CreateForm`, `JoinForm` from `session-forms.tsx` — used as-is
- `SessionSetupView`, `ActiveSessionView`, `RevealView`, `ResultsDashboard` — opened when user taps a session
- `useTastingSessions` hook — unchanged, provides all state and actions

### Modified files

| File | Change |
|------|--------|
| `src/types/cellar.ts` | Replace `"meal"` with `"tasting"` in `CELLAR_SECTIONS` |
| `App.tsx` | Replace `MealTab` rendering with `TastingTab` in the activePanel switch |
| `src/components/cellar-tab.tsx` | Add MealPlannerPanel as a section (expandable or button-triggered) |
| `src/components/tasting-session-modal.tsx` | Extract sub-view rendering so TastingTab can mount views directly instead of only as a modal overlay |

### Removed

- `src/components/meal-tab.tsx` — deleted (its content moves into cellar-tab.tsx)

## MealTab Migration

MealPlannerPanel (the actual content of MealTab) moves into CellarTab as an expandable section below the wine list. Triggered by a "Måltidsplanering" button in the cellar header or as a collapsible panel.

## Data Flow

No database changes. No new tables or RPC functions.

`useTastingSessions` already fetches all sessions for the user. The tab filters them by status:
- Active: `sessions.filter(s => s.status === "setup" || s.status === "active")`
- Ended: `sessions.filter(s => s.status === "ended")`

Session detail views are the same components already used in TastingSessionPanel, just mounted inside the tab instead of as an overlay.

## Realtime

Existing realtime subscriptions in `useTastingSessions` continue to work. The hook subscribes on mount and cleans up on unmount — since the tab mounts/unmounts with navigation, subscriptions are active when the user is on the Provning tab.

## Error Handling

- Network errors on fetch: show existing `showError` toast
- Empty states: friendly Swedish text, not spinners
- Join code validation: existing 6-char uppercase validation in JoinForm

## Testing

- Verify tab navigation works (tap Provning, see list)
- Verify active session cards render and tap through to session view
- Verify ended sessions list and tap through to results
- Verify CreateForm and JoinForm work inline
- Verify MealPlannerPanel still accessible from Källare tab
- Verify realtime updates appear on the Provning tab
