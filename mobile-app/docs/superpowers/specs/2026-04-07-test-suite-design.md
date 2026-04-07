# Test Suite Design — Vinkällaren

**Date:** 2026-04-07
**Status:** Approved

## Overview

Full test coverage for the Vinkällaren mobile app across three layers: unit tests (pure logic), hook/integration tests (React state + Supabase), and E2E tests (Playwright against Expo Web).

## Goals

- Catch regressions in critical business logic (wine inference, OCR parsing, statistics, scoring)
- Verify hook state management and data flow
- Test critical user journeys end-to-end via the web build
- No paid APIs or external services — all tests run against mocks/fixtures

---

## Layer 1: Unit Tests (Jest + TypeScript)

### Setup

- **Framework:** Jest with `ts-jest` preset
- **Location:** `src/lib/__tests__/<module>.test.ts`
- **Config:** `jest.config.ts` at project root

### Dependencies

```
jest, ts-jest, @types/jest
```

### Modules to Test

| Module | Key Functions | Priority |
|--------|--------------|----------|
| `wine-inference.ts` | `inferWineType`, `inferGrape`, `inferRegion`, `inferVintage` | High |
| `session-results.ts` | `stddev`, `averageRating`, `consensusLevel`, WSET parameter comparison | High |
| `format-date.ts` | `formatDateFull`, `formatDateLong`, `formatDateShort`, `toISODate` | High |
| `image-hash.ts` | `computeDHash`, `hammingDistance`, similarity threshold | High |
| `label-ocr.ts` | Line quality scoring, noise filtering, OCR error correction patterns | High |
| `cellar-helpers.ts` | Options builders, stats aggregation, suggested pairings, tag parsing | Medium |
| `wine-helpers.ts` | Draft conversions, completeness scoring, merge logic | Medium |
| `wset-data.ts` | Summary builder, quality labels, tannin helpers | Medium |
| `join-link.ts` | URL parsing, share message building | Medium |
| `taste-profile.ts` | `buildTasteProfile` aggregation | Medium |
| `profile-actions.ts` | `avatarColorFromId` (deterministic hash) | Low |
| `query-helpers.ts` | `applyNullableCatalogFilter` | Low |
| `catalog-search.ts` | Match ranking/merging (pure parts only) | Low |

### Test Strategy

- Each module gets its own test file mirroring the source structure
- Test happy paths, edge cases, and boundary conditions
- No mocking needed — these are pure functions
- Swedish-specific edge cases (å/ä/ö in wine names, Swedish date locale)

---

## Layer 2: Hook Tests (React Native Testing Library)

### Setup

- **Framework:** Jest + `@testing-library/react-native`
- **Location:** `src/hooks/__tests__/<hook>.test.tsx`
- **Supabase mock:** Shared `src/__mocks__/supabase.ts`

### Dependencies

```
@testing-library/react-native, @testing-library/jest-native
```

### Supabase Mock Design

A chainable mock that mirrors the Supabase query builder:

```typescript
// src/__mocks__/supabase.ts
const mockFrom = (data: any[]) => ({
  select: () => mockFrom(data),
  eq: () => mockFrom(data),
  order: () => mockFrom(data),
  limit: () => mockFrom(data),
  range: () => ({ data, error: null }),
  single: () => ({ data: data[0], error: null }),
});
```

### Hooks to Test

| Hook | What to Verify | Priority |
|------|---------------|----------|
| `useCellarData` | Fetches wines, handles loading/error, pagination | High |
| `useTastingSessions` | Create/join session, realtime subscription updates | High |
| `useCellarFilters` | Filter application, reset, combined filters | Medium |
| `useCatalogWorkflow` | State transitions: idle → scanning → matching → done | Medium |
| `useModalToggle` | Open/close toggle (smoke test) | Low |

### Test Strategy

- Render hooks via `renderHook` wrapper
- Mock Supabase client at module level
- Test state transitions and side effects
- Verify loading/error/success states
- No real network calls

---

## Layer 3: E2E Tests (Playwright against Expo Web)

### Setup

- **Framework:** Playwright (`@playwright/test`)
- **Target:** Expo Web dev server (`expo start --web`)
- **Location:** `e2e/tests/<flow>.spec.ts`
- **Config:** `e2e/playwright.config.ts`

### Configuration

```typescript
// e2e/playwright.config.ts
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  },
  webServer: {
    command: 'npx expo start --web --port 8081',
    port: 8081,
    reuseExistingServer: true,
  },
});
```

### Flows to Test

| Flow | Steps | Priority |
|------|-------|----------|
| Auth | Sign up → verify → sign in → sign out | High |
| Add wine | Navigate to "Lägg till" → fill form → save → verify in cellar | High |
| Search & filter | Search by name → apply type filter → verify results | Medium |
| Drink wine | Select wine → mark as drunk → verify in history | Medium |
| Tasting session | Create session → add wine → WSET tasting → view results | Low (complex) |

### Test Strategy

- Each flow is a separate spec file
- Use Playwright's `test.describe` for grouping related steps
- Page Object pattern NOT used (YAGNI — flows are straightforward)
- Auth state saved as storage state fixture for non-auth tests
- Tests run against local Expo dev server
- Supabase: tests use a dedicated test user account (seeded or created in setup)

### E2E Test Data

- Tests create their own data via the UI (not DB seeding)
- Cleanup: each test run uses unique wine names with timestamps to avoid collisions
- No shared state between test files

---

## File Structure

```
mobile-app/
├── jest.config.ts
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/
│   │   └── auth.ts              # Test user login helper
│   └── tests/
│       ├── auth.spec.ts
│       ├── add-wine.spec.ts
│       ├── search-filter.spec.ts
│       ├── drink-wine.spec.ts
│       └── tasting-session.spec.ts
├── src/
│   ├── __mocks__/
│   │   └── supabase.ts          # Shared Supabase mock
│   ├── lib/
│   │   └── __tests__/
│   │       ├── wine-inference.test.ts
│   │       ├── session-results.test.ts
│   │       ├── format-date.test.ts
│   │       ├── image-hash.test.ts
│   │       ├── label-ocr.test.ts
│   │       ├── cellar-helpers.test.ts
│   │       ├── wine-helpers.test.ts
│   │       ├── wset-data.test.ts
│   │       ├── join-link.test.ts
│   │       ├── taste-profile.test.ts
│   │       ├── profile-actions.test.ts
│   │       ├── query-helpers.test.ts
│   │       └── catalog-search.test.ts
│   └── hooks/
│       └── __tests__/
│           ├── useCellarData.test.tsx
│           ├── useTastingSessions.test.tsx
│           ├── useCellarFilters.test.tsx
│           ├── useCatalogWorkflow.test.tsx
│           └── useModalToggle.test.tsx
```

## Package.json Scripts

```json
{
  "test": "jest",
  "test:unit": "jest --testPathPattern=src/lib/__tests__",
  "test:hooks": "jest --testPathPattern=src/hooks/__tests__",
  "test:e2e": "npx playwright test --config=e2e/playwright.config.ts"
}
```

## Implementation Order

1. Install dependencies and configure Jest
2. Unit tests for high-priority lib modules
3. Unit tests for medium/low-priority lib modules
4. Supabase mock + hook tests
5. Playwright config + E2E auth flow
6. Remaining E2E flows
