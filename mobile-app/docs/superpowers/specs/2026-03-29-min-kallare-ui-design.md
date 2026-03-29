# Min källare UI Restructuring

## Overview

Restructure the app's navigation from 7 horizontal top pills to 4 bottom tabs, with "Min källare" as the default tab combining wine collection, stats overview, and storage location grouping.

## Navigation

- **Bottom tab bar** with 4 tabs: Min källare (default), Lägg till, Mat, Historik
- Active: dark brown (#6f1d1b) icon + label
- Inactive: muted tan (#ead8ca) icon + label
- Remove standalone tabs: Översikt, Platser, Katalog

## Min källare Tab — Single Scrollable Page

### 1. Stats Summary Bar (tap-to-toggle)

- **Collapsed (default):** single row summary — e.g. "12 flaskor · 4 länder · snitt 2019"
- **Tapping:** expands to 2×2 grid with 4 insight cards (top country, most common type, top food pairing, avg vintage)
- **Tapping again:** collapses back to single row

### 2. Search + Filter Bar

- Same search input and filter dropdowns as current WineCollectionPanel
- Filters apply across all storage cards below

### 3. Storage Space Cards

- One collapsed card per storage space showing: name, type icon, bottle count badge
- Tapping a card expands it inline to show wines stored in that space
- Wine rows show: name, producer, vintage, type, quantity
- Tapping a wine opens the existing edit/detail flow
- "Utan plats" card for wines with no storage location assigned
- Cards with no filter matches are hidden when filters are active

## Other Tabs

- **Lägg till:** unchanged (AddWinePanel)
- **Mat:** unchanged (MealPlannerPanel)
- **Historik:** unchanged (HistoryPanel)

## Removed

- Översikt tab — stats merged into Min källare stats bar
- Platser tab — storage spaces merged into Min källare as expandable cards
- Katalog tab — removed from UI; catalog still functions behind the scenes for wine autocomplete
