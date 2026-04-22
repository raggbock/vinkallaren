# Spike: use-context-selector adoption

Follow-up investigation noted in #19.

## Question
Would `use-context-selector` let us collapse the 7-provider tower (Wines → Aggregate → Storage → History → Reference → Actions → Filters) back into one context while preserving field-level re-render scoping?

## Findings

### Package state
- `use-context-selector@2.0.0`
- peer deps: `react >=18.0.0`, `scheduler >=0.19.0`
- bundle size: ~2.2 kB minified + gzipped

### Compatibility
- **React version**: the project runs React 19 via Expo SDK 54. `use-context-selector` supports React 18+ officially; React 19 works in practice but the library hasn't shipped a major since React 19.
- **React Native**: supported. Works with React Native's reconciler via the shared `scheduler` dependency.
- **Jest**: requires `scheduler` be available — already installed transitively. No known mock issues with `@testing-library/react-native`.

### API surface
```ts
import { createContext, useContextSelector } from "use-context-selector";

const CellarContext = createContext<CellarValue | null>(null);

// In a consumer:
const wines = useContextSelector(CellarContext, (v) => v?.wines ?? []);
```

Selector fires only when the selected slice changes identity (Object.is comparison). Consumer re-renders are therefore scoped to the actual field read, not the whole context value.

### Migration cost from current setup
- Replace `createContext` calls from `react` with `use-context-selector`'s variant.
- Collapse 7 Provider nestings back to one.
- Rewrite 20+ consumer call sites from `const { x } = useCellarFooContext()` to `const x = useContextSelector(Ctx, v => v?.x)`.
- Selector hooks can still be exported as convenience wrappers: `export const useCellarWines = () => useContextSelector(Ctx, v => v?.wines ?? [])`. Keeping that wrapper layer means the migration is a one-file change on the provider side plus a find-replace on consumers.

### What it doesn't give us for free
- **Memoisation of derived values**: `useContextSelector` compares by `Object.is`. If a selector returns a new object/array each call (e.g. `.filter()`), it still triggers re-render. Must wrap in useMemo at the provider level — which we already do.
- **Ergonomics**: you lose TypeScript destructuring sugar for the hook return. Either write explicit selectors per field or keep multi-field selector hooks that return objects (but memoed).

### Known gotchas
- `use-context-selector` wraps React's Context API with its own scheduler hooks; it **does not** interoperate with `<React.Suspense>` boundaries that try to throw promises across the selector. Not an issue for us — we don't suspend on context values.
- React devtools shows the single context but doesn't visualise which field each consumer selects. Acceptable trade-off.

## Recommendation
**Don't adopt now.** Current per-domain split already delivers the re-render scoping we need for the consumers we have. Adding a dep + a migration touching 20+ sites needs stronger justification than "7 providers feels like many".

**Adopt when** any of:
- We start seeing concrete re-render churn in profiling that the 5-domain split doesn't solve (e.g. a reader that needs `wines.length` but not `wines`).
- We want to expand the data layer further (e.g. tasting state) without nesting another provider.
- We drop `CellarActionsContext` or `CellarFiltersContext` in favour of a unified model.

## References
- https://github.com/dai-shi/use-context-selector
- Issue #19 (tech-debt follow-up)
