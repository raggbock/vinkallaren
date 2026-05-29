# Tasting growth loop + tasting-first SEO — Design

**Date:** 2026-05-29
**Status:** Approved design, pending spec review
**Goal:** Turn wine tastings into the product's growth engine and SEO specialization. Plug the leak where invited guests vanish, make every tasting recruit and convert new users, and reposition the public surface so "vinprovning" is what Vinkällaren ranks and is known for.

## Background

The app is live at `minvinkallare.se` (React Native / Expo web SPA, Supabase backend). Real usage is small but tasting has the most traction (17 sessions, 16 participants vs. ~1 wine/user). The tasting invite loop works mechanically but leaks at two points and is invisible to search:

1. **Conversion leak.** `UpgradePrompt` (create-account modal) is wired only into `add-wine-tab.tsx` and triggers on `wines.length` (cellar size). A guest invited to a *tasting* never adds cellar wines, so they never see any account-creation nudge — they rate wines, the tasting ends, nothing asks them to stay, and `cleanup_stale_guests()` deletes them after 30 days.
2. **Recruitment friction.** The invited-link landing leads with marketing + an email/password form; guest-join is a tertiary button.
3. **No SEO specialization.** SPA serves one client-rendered page. Title/description/OG lead with "vinsamling", there is no structured data, no OG image, and crawlers see an empty shell. Nothing positions the product around vinprovning.

Key enabler: account upgrade uses `supabase.auth.updateUser({ email, password })`, which **keeps the same `user_id`**. A guest's `session_tastings` rows stay linked automatically — no data migration needed.

## Scope

One cohesive feature → one spec → one plan. Five sections:

1. Conversion + recruit CTA at the results screen
2. Invited-link landing reorder
3. OG share preview
4. (folded into 1) start-your-own-tasting loop
5. Tasting-first SEO & positioning

### Out of scope (YAGNI)

- Dynamic per-session OG images (requires SSR/edge — explicitly deferred).
- Changes to the reveal ceremony flow itself.
- Tasting-rating data migration (unnecessary — same `user_id`).
- Static pre-render / dedicated `/vinprovning` route (documented as Phase 2 below).

## Section 1 — Conversion + recruit CTA at results (fix #1 + #4)

`ResultsDashboard` (rendered for `activeSession.status === "ended"`) is the single "after" view for **both** blind (reveal → ended) and open/quick sessions. The CTA lives here only — the reveal ceremony is untouched.

A new small component `src/components/tasting-cta.tsx` renders a role-conditional card at the bottom of the dashboard:

| Viewer | Card | Action |
|---|---|---|
| Anonymous participant | "Spara dina resultat" — *"Skapa ett konto så att dina provningar och betyg finns kvar."* | **Skapa konto** → opens existing `UpgradePrompt` |
| Logged-in non-host | "Sugen på att vara värd?" — *"Starta din egen vinprovning och bjud in dina vänner."* | **Starta en egen provning** → `onStartOwnTasting` |
| Host | (no card) | — |

### Interfaces

- `ResultsDashboard` gains props: `isAnonymous: boolean`, `isHost: boolean`, `onCreateAccount: () => void`, `onStartOwnTasting: () => void`. It renders `<TastingCta>` with the resolved role; all branching logic lives in `tasting-cta.tsx`.
- `tasting-cta.tsx` exports `TastingCta({ isAnonymous, isHost, onCreateAccount, onStartOwnTasting })` — pure presentational, returns `null` for hosts.
- `TastingSessionPanel`:
  - Receives new prop `isAnonymous: boolean`.
  - Owns local `const [upgradeVisible, setUpgradeVisible] = useState(false)`.
  - Renders `<UpgradePrompt visible={upgradeVisible} isBlocked={false} onUpgraded={...} onDismiss={() => setUpgradeVisible(false)} />` alongside the ended-state view.
  - `onCreateAccount = () => setUpgradeVisible(true)`.
  - `onStartOwnTasting = () => { onCloseSession(); setView("create"); }` — closes the ended session and returns to the list in create mode. (Requires lifting the create intent: `onCloseSession()` then setting list view to `"create"`; the panel's `view` state already supports `"create"`.)
  - On `onUpgraded`: close modal, the auth state change in `App.tsx` re-renders with a non-anonymous session, so the CTA naturally flips to the "start your own" variant on next render.

### Data flow

`App.tsx` already passes `userId={session.user.id}` to `TastingSessionPanel`. Add `isAnonymous={session.user.is_anonymous ?? false}` (same source already used for `AddWineTab`). `isHost` is computed in the panel as `activeSession.host_id === userId` (existing pattern) and passed to `ResultsDashboard`.

### Anti-bloat

`results-dashboard.tsx` is 265 lines. Extracting the CTA into `tasting-cta.tsx` keeps it from growing; net change to `results-dashboard.tsx` is a few lines (props + one element).

## Section 2 — Invited-link landing reorder (fix #2)

When `pendingJoinCode` is present, `AuthForm` enters "invite mode":

- A prominent primary button **"Gå med i provningen"** at the top of the form card → calls `handleGuestSignIn` (anonymous sign-in; auto-join is already handled by `App.tsx`'s `pendingJoinCode` effect after auth).
- The email/password form collapses below under a secondary affordance: *"Har du redan ett konto? Logga in"* (toggles the existing form open).
- Without `pendingJoinCode`, the landing renders exactly as today (no regression).

### Interfaces

- `LandingScreen` already receives `pendingJoinCode`. Pass an `invited: boolean` (`!!pendingJoinCode`) into `<AuthForm invited={invited} />`.
- `AuthForm({ invited }: { invited?: boolean })`:
  - When `invited`, render the guest CTA first and gate the credential fields behind a `showLogin` local toggle (default collapsed).
  - Reuses existing `useAuthForm` hook unchanged (`handleGuestSignIn`, `handleAuth`).
- The existing `joinBanner` in `LandingScreen` is kept and its copy strengthened.

## Section 3 — OG share preview (fix #3)

- `scripts/inject-meta.mjs`: add `og:image` and `twitter:image` tags; change `twitter:card` from `summary` to `summary_large_image`.
- Static branded image `public/og-image.png` (1200×630), generated from an inline SVG via `sharp` (already a devDependency) in a small build/one-off script and committed. Visual leads with **"Vinprovning med vänner"** + the Vinkällaren wordmark (ties to Section 5 positioning). Served at `/og-image.png` (Expo copies `public/` → dist root, same mechanism as `manifest.json`).
- **Crawler routing verification (blocking):** confirm `/join/:code` returns `index.html` with HTTP 200 for non-JS crawlers. Cloudflare Pages SPA fallback must be in place; if not, add `public/_redirects` with `/* /index.html 200`. Without this, chat-app link previews on `/join/...` URLs won't render. Verify via `curl -sI https://minvinkallare.se/join/TEST123`.

## Section 4 — (folded into Section 1)

The "start your own tasting" loop is the logged-in/host-recruitment branch of the results CTA above.

## Section 5 — Tasting-first SEO & positioning

The product should rank and be known for **vinprovning**. Brand stays "Vinkällaren"; the tagline and all public copy lead with tastings, with collection as secondary.

### Positioning (copy)

- `app.json` → `web.name`: `"Vinkällaren — Vinprovning med vänner"`; `web.description`: leads with tastings, e.g. *"Skapa eller gå med i en vinprovning, blindprova och betygsätt tillsammans, och avslöja resultaten. Plus: katalogisera din vinsamling och hitta rätt vin till maten. Gratis och utan reklam."*
- `inject-meta.mjs` → `og:title`/`twitter:title` and descriptions updated to match the tasting-first framing. `og:image` from Section 3.
- `landing.tsx` → `MarketingContent`: reorder `FEATURES` so "Provningar med vänner" is first, and reframe the `subheadline` to lead with hosting/joining tastings.

### Technical SEO

- **JSON-LD structured data** injected by `inject-meta.mjs`: a `WebApplication` schema (`name`, tasting-first `description`, `applicationCategory: "LifestyleApplication"`, `inLanguage: "sv-SE"`, free `offers`, `featureList` leading with vinprovning/blindprovning). Emitted as a `<script type="application/ld+json">` before `</head>`.
- **Crawlable SEO content block** injected into `index.html` by `inject-meta.mjs`: a semantic, keyword-bearing block (one `<h1>` + short descriptive paragraphs targeting *vinprovning*, *blindprovning*, *vinprovning med vänner*, *digital vinprovning*) placed inside the existing loading-skeleton container (real DOM crawlers read before JS hydrates; visually replaced when the app mounts via the existing `.app-ready` class). This gives non-JS and JS-rendering crawlers indexable keyword content without changing the SPA architecture.
- `public/sitemap.xml`: keep `/` (priority 1.0). `/join/*` stays out of the sitemap (ephemeral). `robots.txt` unchanged (already allows all + points to sitemap).

### Phase 2 (documented, not built now)

Stronger SEO would pre-render a dedicated static `/vinprovning` marketing page (full crawlable content without relying on JS rendering). This requires either Expo `output: "static"` (a routing migration) or a hand-authored static HTML page served alongside the SPA. Deferred until the keyword shows traction in Search Console.

## Testing

Follows the existing `src/**/__tests__` Jest + Testing Library pattern.

- `tasting-cta.test.tsx`: renders correct card for anonymous / logged-in-non-host / host (host → `null`); fires `onCreateAccount` and `onStartOwnTasting`.
- `landing` invite mode: with `invited`, the guest-join CTA is primary and credential fields are collapsed until toggled; without `invited`, unchanged.
- Build-output checks are manual/verification steps (OG tags present in `dist/index.html`, JSON-LD valid, `/join/:code` returns 200) — captured in the implementation plan's verification section, not unit tests.

## Components touched

| File | Change |
|---|---|
| `src/components/tasting-cta.tsx` | **new** — role-conditional results CTA |
| `src/components/results-dashboard.tsx` | render `TastingCta`, +4 props |
| `src/components/tasting-session-modal.tsx` | own `UpgradePrompt` for tasting; `isAnonymous` prop; wire CTA handlers |
| `App.tsx` | pass `isAnonymous` to `TastingSessionPanel` |
| `src/screens/landing.tsx` | invite-mode `AuthForm`; reordered tasting-first `MarketingContent` |
| `scripts/inject-meta.mjs` | OG image, `summary_large_image`, JSON-LD, crawlable SEO block, tasting-first meta |
| `public/og-image.png` | **new** — 1200×630 branded share image |
| `public/_redirects` | **new, if missing** — SPA fallback for crawler routing |
| `app.json` | tasting-first `web.name` / `web.description` |

## Success criteria

- An anonymous tasting participant sees a "create account" CTA at results; upgrading keeps their ratings.
- A logged-in participant sees a "start your own tasting" CTA at results.
- Opening an invite link presents one-tap "Gå med i provningen" as the primary action.
- A shared `/join/...` link renders a branded large-image preview in chat apps.
- `dist/index.html` carries tasting-first title/description/OG, valid `WebApplication` JSON-LD, and a crawlable vinprovning content block.
