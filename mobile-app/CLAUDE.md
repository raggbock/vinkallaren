# Vinkällaren — Development Rules

## Language

All UI text in Swedish. No English labels, buttons, placeholders, or alerts.

## Anti-Bloat Rules (Hard Limits)

The value of this codebase is in how SMALL it is, not how large.

### File Limits
- **Max 500 lines per file.** If a file exceeds this, split it before adding more code.
- **Max 50 lines per function.** If a function is longer, break it up.

### Before Editing a File
1. Check its size. If over limit, **trim first, change second.**
2. Search for existing implementations before writing new code. Duplication is the most common AI mistake.
3. After your change, check: can anything be removed? Aim for net-negative line delta.

### Mandatory Rules
- **Wire-in requirement:** If a function, hook, or component exists, it must be used somewhere. If it isn't — delete it.
- **No dead code.** Never comment out code. Delete it. Git has history.
- **No speculative code.** Don't think "this could be useful later." Think: "we don't need this now, remove it."
- **No unused exports, helpers, or abstractions.** Three similar lines > a premature abstraction.
- **If a fix is more than 10 lines, ask:** "What am I adding that I don't need?"

### Session Start
At the start of each session, check for bloat:
- Which files are largest? Flag any that break the 500-line limit.
- Are there unused functions or exports? Remove them.

## Code Style

- React Native / Expo with TypeScript
- Styles in `src/styles/theme.ts` (shared) or local `StyleSheet.create` in components
- Supabase for backend (project: `gonspypbhqvfvpgwsdtu`)
- No paid cloud APIs without explicit approval — prefer on-device solutions

## Architecture

- `App.tsx` — screen routing + state orchestration
- `src/components/` — UI components (sections, workflows, form controls)
- `src/hooks/` — data fetching and state (useCellarData, useCellarFilters, useImagePicker)
- `src/lib/` — pure logic helpers (no React)
- `src/types/` — TypeScript type definitions
- `src/styles/` — shared theme

## Commits

- Commit messages in English
- One logical change per commit
- Push to `main` (auto-deploys to Cloudflare Pages — production branch must be set to `main` in the Pages dashboard)
