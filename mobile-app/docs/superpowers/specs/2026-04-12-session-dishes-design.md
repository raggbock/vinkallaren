# Session Dishes & MealPlanner Cleanup

**Date:** 2026-04-12

## Problem

1. `MealPlannerPanel` is rendered as a sibling after `MinKallarePanel` (a SectionList) in CellarTab, causing broken layout — it appears as a fullscreen overlay stuck on half the screen
2. Tasting sessions have no way to register what food was served and link it to wines

## Changes

### Part 1: Remove MealPlannerPanel from CellarTab

- Remove `MealPlannerPanel` rendering from `cellar-tab.tsx`
- Delete `MealPlannerPanel` component from `cellar-sections.tsx`
- Delete `buildCustomPairings` from `cellar-helpers.ts` (only used by MealPlannerPanel)
- Delete `buildMealRecommendations` from `cellar-helpers.ts` and remove its export from `useWines.ts` (only consumer is cellar-tab)
- Keep `FOOD_CATEGORIES` — used by `cellar-fields.tsx` (add wine form)
- Keep the "Mat" filter pill in cellar-list-header (uses `pairingOptions` from wines, not MealPlannerPanel)
- Delete `mealStyles` from `cellar-sections.tsx`

### Part 2: Session-level dishes in tastings

#### Data model

New table `session_dishes`:
```sql
create table public.session_dishes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tasting_sessions(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
```

New junction table `session_tasting_dishes`:
```sql
create table public.session_tasting_dishes (
  session_tasting_id uuid not null references public.session_tastings(id) on delete cascade,
  session_dish_id uuid not null references public.session_dishes(id) on delete cascade,
  primary key (session_tasting_id, session_dish_id)
);
```

RLS policies: same pattern as existing session tables (owner + participants via session membership).

#### UI: Add dishes to session

In the tasting session panel (before/during tasting), a "Maträtter" section:
- Text input + add button
- Added dishes shown as chips with X to remove
- Dishes can be added/removed at any point during the session

#### UI: Link dishes when tasting a wine

In session-tasting-view, below rating/notes and above the existing "Passar till" freetext field:
- Show session dishes as tappable chips (toggle on/off)
- No dishes selected = default state
- Selected dishes highlighted with accent color

#### Results: Food & wine pairings

In results-dashboard, a new section "Mat & vin":
- Show average rating per dish-wine combination
- Sorted best match first
- Only shown if session has dishes AND dish-wine links exist

### What stays unchanged

- "Passar till" field when adding wine to cellar
- Per-wine "Passar till" freetext in session tasting view
- Food pairing filter in cellar list header
- `buildPairingOptions` helper (used by cellar filter)
- `getSuggestedPairings` helper (used by add-wine flow)
