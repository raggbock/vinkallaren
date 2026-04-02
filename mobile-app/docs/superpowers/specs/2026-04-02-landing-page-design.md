# Landing Page Design Spec

**Goal:** Replace the current AuthScreen with a marketing-first landing page at minvinkallare.se that communicates value, converts visitors, and provides SEO content for crawlers.

**Domain:** https://minvinkallare.se

---

## Architecture

A new `LandingScreen` component (`src/screens/landing.tsx`) replaces `AuthScreen` as the unauthenticated view. On web (desktop >768px), it renders a split layout: marketing features on the left, auth form on the right. On mobile/narrow screens, the two halves stack vertically (marketing first, then auth form). The existing auth logic (sign-in, sign-up, guest mode, email verification) moves into the new component — `AuthScreen` in `src/screens/auth.tsx` is retired.

The landing page is a web-only concern. On native (iOS/Android), the existing `AuthScreen` behavior is acceptable as-is since users don't arrive via search engines. However, to avoid maintaining two auth screens, `LandingScreen` should work on both platforms (the split layout simply stacks on narrow screens regardless of platform).

## Layout

### Desktop (>768px)

Two-column split filling the viewport:

- **Left column** (flex: 1, min-width ~0): Marketing content vertically centered
- **Right column** (flex: 0 0 380px): Auth form panel on darker background (#3d2220), vertically centered

### Mobile / Narrow (<768px)

Single column, scrollable:

1. Marketing content (top)
2. Auth form panel (below, full width)

### Responsive detection

Use `Dimensions.get("window").width` with an event listener to toggle between layouts. Breakpoint: 768px.

## Marketing Content (Left Side)

Top to bottom:

1. **Eyebrow label:** "Vinkällaren" — uppercase, letter-spacing 3px, color #f4c38c, font-size 11px
2. **Headline:** "Håll koll på hela din vinsamling" — color #fffaf5, font-size 28px, font-weight 800
3. **Subheadline:** "Katalogisera, provsmaka och hitta rätt vin till maten — allt på ett ställe." — color #c4a882, font-size 13px
4. **Feature list** — four items, each with icon box + title + description:

| # | Icon | Title | Description |
|---|------|-------|-------------|
| 1 | 🥂 (&#129346;) | Provningar med vänner | Starta blindprovningar, dela en kod och betygsätt tillsammans. Avslöja resultaten när alla är klara. |
| 2 | 🍷 (&#127863;) | Katalogisera din samling | Håll ordning på flaskor, förvaringsplatser och årgångar. Sök och filtrera i din källare. |
| 3 | 🍽 (&#127869;) | Hitta rätt vin till maten | Välj vad du ska äta — få förslag på matchande viner direkt från din egen samling. |
| 4 | ★ (&#9733;) | Smaknoteringar och betyg | Spara tasting notes med WSAT-stöd. Bygg upp din smakhistorik över tid. |

Each icon sits in a 40x40 rounded box (#3d2220, border-radius 10px). Title is #fffaf5, 13px, bold. Description is #c4a882, 11px. Gap between items: 20px.

## Auth Form (Right Side)

Container: background #3d2220, padding 48px 32px (desktop) / 24px (mobile).

Inner card: background #2b1714, border-radius 16px, padding 28px.

### Segment control

Toggle between "Logga in" and "Skapa konto". Active tab: background #3d2220, text #fffaf5. Inactive tab: no background, text #8f8178. Container: background #1a0f0e, border-radius 10px, padding 3px.

### Form fields

- **E-post** — labeled input, placeholder "namn@exempel.se"
- **Lösenord** — labeled input, secure text entry

Field styling: background #1a0f0e, border 1px solid #5a3a38, border-radius 8px, padding 10px 12px. Label: color #c4a882, font-size 10px.

### Primary CTA

- Sign-in mode: "Logga in"
- Sign-up mode: "Skapa konto"

Style: background #f4c38c, color #2b1714, padding 12px, border-radius 10px, font-weight 700, font-size 13px.

### Guest CTA

"Testa utan konto" — outline button. Border 1.5px solid #f4c38c, color #f4c38c, padding 10px, border-radius 10px, font-weight 600, font-size 12px.

### Email verification state

When sign-up triggers email verification, the auth form area switches to a verification notice (same as current AuthScreen behavior): message about checking email, "Jag har verifierat min mail" button, and a "Fortsätt som gäst i stället" fallback.

## Auth Logic

All auth logic from the current `AuthScreen` is preserved:

- `handleAuth()` — sign-in with password or sign-up (with email verification flow)
- `handleGuestSignIn()` — anonymous sign-in via Supabase
- Error handling via `showError()`
- Loading states for both primary and guest buttons
- Sign-up notice and `awaitingVerification` state

No changes to auth behavior — only the visual presentation changes.

## Colors

All from the existing theme:

| Token | Hex | Usage |
|-------|-----|-------|
| Dark wine | #2b1714 | Page background, form card background |
| Medium wine | #3d2220 | Right column background, icon boxes, active segment |
| Deep wine | #1a0f0e | Segment container, input backgrounds |
| Gold | #f4c38c | Eyebrow, primary CTA background, guest CTA border/text |
| Cream | #fffaf5 | Headlines, feature titles, active segment text |
| Muted gold | #c4a882 | Body text, descriptions, labels |
| Border | #5a3a38 | Input field borders |
| Inactive text | #8f8178 | Inactive segment, placeholder text |

## File Changes

| File | Action |
|------|--------|
| `src/screens/landing.tsx` | **Create** — new LandingScreen component |
| `src/screens/auth.tsx` | **Modify** — remove AuthScreen, keep SetupScreen and LoadingScreen |
| `App.tsx` | **Modify** — import LandingScreen instead of AuthScreen |
| `src/styles/theme.ts` | **Modify** — add landing page styles (or use local StyleSheet) |

## Accessibility

- Semantic structure: heading hierarchy (eyebrow → h1 headline → h2 feature titles)
- Form inputs have proper labels
- Contrast ratios meet WCAG AA (gold on dark wine = high contrast)
- Keyboard navigation: tab through form fields and buttons
- Guest CTA is clearly visible and not hidden below the fold on mobile

## SEO

The landing page content is rendered as HTML on web, providing crawlable text for:
- Product name and description
- Feature descriptions with relevant keywords (vinsamling, provning, blindprovning, tasting notes)
- The domain minvinkallare.se already has meta tags injected via the post-build script

## Out of Scope

- Guest → real account upgrade (tracked separately)
- Stale guest cleanup (tracked separately)
- Analytics or tracking
- Animations or transitions
- Social login (Google, Apple)
- Password reset flow
