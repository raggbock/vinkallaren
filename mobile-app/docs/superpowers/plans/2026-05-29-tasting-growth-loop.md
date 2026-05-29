# Tasting Growth Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn tastings into the growth engine — convert anonymous participants and recruit hosts at the results screen, make invite links one-tap and chat-previewable, and reposition the public surface around vinprovning for SEO.

**Architecture:** Role logic extracted to a pure `lib` helper (testable in the existing `unit` jest project); presentational `.tsx` stays thin. The results CTA reuses the existing `UpgradePrompt` modal (account upgrade keeps the same `user_id`, so ratings persist with no migration). SEO is delivered build-time via `inject-meta.mjs` (tasting-first meta, OG image, JSON-LD, crawlable content block) — no SPA architecture change.

**Tech Stack:** React Native / Expo Web (TypeScript), Supabase auth, Jest + ts-jest, `sharp` (OG image), Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-05-29-tasting-growth-loop-design.md`

**Branch:** `tasting-growth-loop` (already created; spec already committed there)

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/tasting-cta.ts` | **new** — pure `resolveResultsCta` role logic |
| `src/lib/__tests__/tasting-cta.test.ts` | **new** — unit tests for the resolver |
| `src/components/tasting-cta.tsx` | **new** — thin presentational CTA card |
| `src/components/results-dashboard.tsx` | render `TastingCta`, +4 props |
| `src/components/tasting-session-modal.tsx` | `isAnonymous` prop, own `UpgradePrompt`, wire CTA handlers |
| `App.tsx` | pass `isAnonymous` to `TastingSessionPanel` |
| `src/screens/landing.tsx` | invite-mode `AuthForm`; tasting-first `MarketingContent` |
| `scripts/generate-og-image.mjs` | **new** — render `public/og-image.png` via sharp |
| `public/og-image.png` | **new** — 1200×630 share image |
| `scripts/inject-meta.mjs` | OG image, `summary_large_image`, JSON-LD, crawlable SEO block, tasting-first meta |
| `app.json` | tasting-first `web.name` / `web.description` |
| `public/_redirects` | **new, if missing** — SPA fallback for crawler routing |

---

## Task 1: CTA role resolver (lib, TDD)

**Files:**
- Create: `src/lib/tasting-cta.ts`
- Test: `src/lib/__tests__/tasting-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/tasting-cta.test.ts`:

```ts
import { resolveResultsCta } from "../tasting-cta";

describe("resolveResultsCta", () => {
  test("host sees no CTA (already converted)", () => {
    expect(resolveResultsCta({ isAnonymous: false, isHost: true })).toBeNull();
    expect(resolveResultsCta({ isAnonymous: true, isHost: true })).toBeNull();
  });

  test("anonymous participant is prompted to create an account", () => {
    expect(resolveResultsCta({ isAnonymous: true, isHost: false })).toBe("create-account");
  });

  test("logged-in participant is prompted to host their own", () => {
    expect(resolveResultsCta({ isAnonymous: false, isHost: false })).toBe("start-own");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tasting-cta`
Expected: FAIL — `Cannot find module '../tasting-cta'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/tasting-cta.ts`:

```ts
export type ResultsCtaVariant = "create-account" | "start-own" | null;

/**
 * Which post-tasting CTA to show on the results screen.
 * Host → none (already converted). Anonymous → create account. Else → host your own.
 */
export function resolveResultsCta(opts: { isAnonymous: boolean; isHost: boolean }): ResultsCtaVariant {
  if (opts.isHost) return null;
  if (opts.isAnonymous) return "create-account";
  return "start-own";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tasting-cta`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasting-cta.ts src/lib/__tests__/tasting-cta.test.ts
git commit -m "feat(tasting): results CTA role resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TastingCta presentational component

**Files:**
- Create: `src/components/tasting-cta.tsx`

No unit test — the jest config has no component-test project; logic is already covered by Task 1. Verified end-to-end in Task 10.

- [ ] **Step 1: Write the component**

Create `src/components/tasting-cta.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../styles/theme";
import { resolveResultsCta } from "../lib/tasting-cta";

type Props = {
  isAnonymous: boolean;
  isHost: boolean;
  onCreateAccount: () => void;
  onStartOwnTasting: () => void;
};

export function TastingCta({ isAnonymous, isHost, onCreateAccount, onStartOwnTasting }: Props) {
  const variant = resolveResultsCta({ isAnonymous, isHost });
  if (!variant) return null;

  const isCreate = variant === "create-account";
  return (
    <View style={s.card}>
      <Text style={s.title}>{isCreate ? "Spara dina resultat" : "Sugen på att vara värd?"}</Text>
      <Text style={s.body}>
        {isCreate
          ? "Skapa ett konto så att dina provningar och betyg finns kvar."
          : "Starta din egen vinprovning och bjud in dina vänner."}
      </Text>
      <Pressable style={s.btn} onPress={isCreate ? onCreateAccount : onStartOwnTasting}>
        <Text style={s.btnText}>{isCreate ? "Skapa konto" : "Starta en egen provning"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.textLight, borderRadius: 18, padding: 18, gap: 8, borderWidth: 1, borderColor: colors.surfaceAlt, marginTop: 8 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  btn: { backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  btnText: { color: colors.textLight, fontWeight: "700", fontSize: 15 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/tasting-cta.tsx
git commit -m "feat(tasting): results CTA card component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Render TastingCta in ResultsDashboard

**Files:**
- Modify: `src/components/results-dashboard.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/components/results-dashboard.tsx`, after the existing imports, add:

```tsx
import { TastingCta } from "./tasting-cta";
```

- [ ] **Step 2: Extend the Props type**

Replace the existing `type Props = { ... }` block (lines ~11-15) with:

```tsx
type Props = {
  results: SessionResults;
  participants: SessionParticipant[];
  onBack: () => void;
  isAnonymous: boolean;
  isHost: boolean;
  onCreateAccount: () => void;
  onStartOwnTasting: () => void;
};
```

- [ ] **Step 3: Destructure and render the CTA**

Change the function signature line:

```tsx
export function ResultsDashboard({ results, participants, onBack, isAnonymous, isHost, onCreateAccount, onStartOwnTasting }: Props) {
```

Then, inside the outer `<View style={s.container}>`, immediately before its closing `</View>` (after the wine-list `.map(...)`), add:

```tsx
      <TastingCta
        isAnonymous={isAnonymous}
        isHost={isHost}
        onCreateAccount={onCreateAccount}
        onStartOwnTasting={onStartOwnTasting}
      />
```

- [ ] **Step 4: Typecheck (expect a caller error)**

Run: `npx tsc --noEmit`
Expected: an error in `tasting-session-modal.tsx` — `ResultsDashboard` is missing the new required props. That is fixed in Task 4. The `results-dashboard.tsx` file itself must have no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/results-dashboard.tsx
git commit -m "feat(tasting): wire results CTA into dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: isAnonymous plumbing + UpgradePrompt in the tasting panel

**Files:**
- Modify: `src/components/tasting-session-modal.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Add imports and the isAnonymous prop**

In `src/components/tasting-session-modal.tsx`, add to the imports (near the other component imports):

```tsx
import { UpgradePrompt } from "./upgrade-prompt";
```

Add `isAnonymous` to the destructured params (in the `TastingSessionPanel({ ... })` list, next to `userId`):

```tsx
  styles, userId, isAnonymous, sessions, loading, toasts, pushToast, activeSession, activeWines, activeTastings,
```

Add it to the props type (right after `userId: string;`):

```tsx
  userId: string;
  isAnonymous: boolean;
```

- [ ] **Step 2: Add upgrade-modal state**

Immediately after the existing `const [view, setView] = useState<"list" | "create" | "join">("list");` line, add:

```tsx
  const [upgradeVisible, setUpgradeVisible] = useState(false);
```

- [ ] **Step 3: Wire the ended-state branch**

Replace the entire `if (activeSession && activeSession.status === "ended") { ... }` block with:

```tsx
  // Results view for ended/revealed sessions
  if (activeSession && activeSession.status === "ended") {
    const results = buildSessionResults(activeWines, activeTastings, activeSession.format, activeSession.created_at, dishes, tastingDishes);
    const isHost = activeSession.host_id === userId;
    return (
      <View style={styles.panel}>
        <ResultsDashboard
          results={results}
          participants={participants}
          onBack={() => { onCloseSession(); setView("list"); }}
          isAnonymous={isAnonymous}
          isHost={isHost}
          onCreateAccount={() => setUpgradeVisible(true)}
          onStartOwnTasting={() => { onCloseSession(); setView("create"); }}
        />
        <UpgradePrompt
          visible={upgradeVisible}
          isBlocked={false}
          onUpgraded={() => setUpgradeVisible(false)}
          onDismiss={() => setUpgradeVisible(false)}
        />
      </View>
    );
  }
```

- [ ] **Step 4: Pass isAnonymous from App.tsx**

In `App.tsx`, in the `<TastingSessionPanel ... />` JSX (inside the `activeSession` branch, around line 335), add the prop next to `userId`:

```tsx
            styles={styles} userId={session.user.id} isAnonymous={session.user.is_anonymous ?? false}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite (no regressions)**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/tasting-session-modal.tsx App.tsx
git commit -m "feat(tasting): account/host CTA at results for participants

Anonymous participants get a create-account prompt (reusing UpgradePrompt;
upgrade keeps the same user_id so ratings persist). Logged-in participants
get a start-your-own-tasting prompt.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Invited-link landing — guest-join as primary

**Files:**
- Modify: `src/screens/landing.tsx`

- [ ] **Step 1: Pass `invited` into AuthForm**

In `LandingScreen` (bottom of file), replace `<AuthForm />` with:

```tsx
            <AuthForm invited={!!pendingJoinCode} />
```

- [ ] **Step 2: Rewrite AuthForm for invite mode**

Replace the entire `function AuthForm() { ... }` (the non-verification return path) with:

```tsx
function AuthForm({ invited }: { invited?: boolean }) {
  const auth = useAuthForm();
  const [showLogin, setShowLogin] = useState(!invited);

  if (auth.awaitingVerification) {
    return <VerificationView email={auth.email} onBack={auth.resetVerification} onGuestSignIn={auth.handleGuestSignIn} guestBusy={auth.guestBusy} />;
  }

  return (
    <View style={s.formCard} {...web({ dataSet: { landingGlow: true } })}>
      <View style={{ alignItems: "center", marginBottom: -4 }}>
        <WineGlassDoodle size={48} color="#C83C2D" />
      </View>

      {invited ? (
        <>
          <Text style={s.formWelcome}>Du är inbjuden!</Text>
          <Pressable onPress={auth.handleGuestSignIn} style={s.primaryCta} disabled={auth.guestBusy} {...web({ dataSet: { landingCta: true } })}>
            <Text style={s.primaryCtaText}>{auth.guestBusy ? "Ansluter..." : "Gå med i provningen"}</Text>
          </Pressable>
          {!showLogin ? (
            <Pressable onPress={() => setShowLogin(true)} style={{ alignItems: "center", paddingVertical: 6 }}>
              <Text style={s.guestCtaText}>Har du redan ett konto? Logga in</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={s.formWelcome}>Välkommen in</Text>
      )}

      {showLogin ? (
        <>
          <View style={s.segment}>
            <Pressable onPress={() => auth.setMode("signin")} style={[s.segmentTab, auth.mode === "signin" && s.segmentTabActive]}>
              <Text style={[s.segmentLabel, auth.mode === "signin" && s.segmentLabelActive]}>Logga in</Text>
            </Pressable>
            <Pressable onPress={() => auth.setMode("signup")} style={[s.segmentTab, auth.mode === "signup" && s.segmentTabActive]}>
              <Text style={[s.segmentLabel, auth.mode === "signup" && s.segmentLabelActive]}>Skapa konto</Text>
            </Pressable>
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>E-post</Text>
            <TextInput value={auth.email} onChangeText={auth.setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" placeholder="namn@exempel.se" style={s.fieldInput} placeholderTextColor="#8f8178" accessibilityLabel="E-post" />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Lösenord</Text>
            <TextInput value={auth.password} onChangeText={auth.setPassword} secureTextEntry returnKeyType="go" onSubmitEditing={auth.handleAuth} style={s.fieldInput} placeholderTextColor="#8f8178" accessibilityLabel="Lösenord" />
          </View>
          <Pressable onPress={auth.handleAuth} style={s.primaryCta} disabled={auth.busy} {...web({ dataSet: { landingCta: true } })}>
            <Text style={s.primaryCtaText}>{auth.busy ? "Arbetar..." : auth.mode === "signup" ? "Skapa konto" : "Logga in"}</Text>
          </Pressable>
          {auth.signupNotice ? <Text style={s.notice}>{auth.signupNotice}</Text> : null}
          {!invited ? (
            <Pressable onPress={auth.handleGuestSignIn} style={s.guestCta} disabled={auth.guestBusy} {...web({ dataSet: { landingCta: true } })}>
              <Text style={s.guestCtaText}>{auth.guestBusy ? "Startar gästläge..." : "Testa utan konto"}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 3: Confirm the file stays under the 500-line limit**

Run: `npx wc -l src/screens/landing.tsx` (or `(Get-Content src/screens/landing.tsx | Measure-Object -Line).Lines`)
Expected: under 500. If it exceeds, stop and extract `AuthForm` + `VerificationView` + `useAuthForm` into `src/components/landing-auth.tsx` before continuing.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/landing.tsx
git commit -m "feat(landing): one-tap guest join for invited users

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Tasting-first positioning copy

**Files:**
- Modify: `app.json`
- Modify: `src/screens/landing.tsx`

- [ ] **Step 1: Update app.json web metadata**

In `app.json`, under `expo.web`, replace the `name` and `description` values with:

```json
      "name": "Vinkällaren — Vinprovning med vänner",
      "description": "Skapa eller gå med i en vinprovning, blindprova och betygsätt tillsammans, och avslöja resultaten. Plus: katalogisera din vinsamling och hitta rätt vin till maten. Gratis och utan reklam.",
```

- [ ] **Step 2: Reorder landing features (tasting first) and reframe the subheadline**

In `src/screens/landing.tsx`, replace the `subheadline` string in `MarketingContent` with:

```tsx
        Håll vinprovningar med vänner — blindprova, betygsätt tillsammans och avslöja resultaten. Och håll ordning på din vinsamling däremellan.
```

Then in the `FEATURES` array, move the existing "Provningar med vänner" object to be the **first** element (no text changes to the items themselves — only order).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app.json src/screens/landing.tsx
git commit -m "feat(seo): reposition public copy around vinprovning

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: OG share image

**Files:**
- Create: `scripts/generate-og-image.mjs`
- Create: `public/og-image.png` (generated)

- [ ] **Step 1: Write the generator script**

Create `scripts/generate-og-image.mjs`:

```js
/**
 * One-off / re-runnable: render the social share image to public/og-image.png.
 * Uses sharp (already a devDependency) to rasterize an inline SVG. System
 * serif font is used — librsvg does not load web fonts.
 * Run: node ./scripts/generate-og-image.mjs
 */
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FDFAF6"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="none" stroke="#E0D8CE" stroke-width="3"/>
  <text x="600" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" letter-spacing="8" fill="#C83C2D" font-weight="600">VINKÄLLAREN</text>
  <text x="600" y="320" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" fill="#2A2A2A" font-weight="700">Vinprovning</text>
  <text x="600" y="420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="92" fill="#2A2A2A" font-weight="700">med vänner</text>
  <text x="600" y="520" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="#555555">Blindprova · betygsätt tillsammans · avslöja resultaten</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/og-image.png");
console.log("Wrote public/og-image.png (1200x630)");
```

- [ ] **Step 2: Generate the image**

Run: `node ./scripts/generate-og-image.mjs`
Expected: `Wrote public/og-image.png (1200x630)` and the file exists.

- [ ] **Step 3: Sanity-check dimensions**

Run: `node -e "import('sharp').then(s=>s.default('public/og-image.png').metadata()).then(m=>console.log(m.width,m.height))"`
Expected: `1200 630`.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-og-image.mjs public/og-image.png
git commit -m "feat(seo): branded OG share image

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: SEO injection in inject-meta.mjs

**Files:**
- Modify: `scripts/inject-meta.mjs`

- [ ] **Step 1: Tasting-first meta + OG image in the `tags` template**

In `scripts/inject-meta.mjs`, replace the existing OG/Twitter lines inside the `tags` template with:

```js
    <meta property="og:title" content="Vinkällaren — Vinprovning med vänner" />
    <meta property="og:description" content="Skapa eller gå med i en vinprovning, blindprova och betygsätt tillsammans, och avslöja resultaten. Gratis och utan reklam." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://minvinkallare.se/" />
    <meta property="og:locale" content="sv_SE" />
    <meta property="og:site_name" content="Vinkällaren" />
    <meta property="og:image" content="https://minvinkallare.se/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Vinkällaren — Vinprovning med vänner" />
    <meta name="twitter:description" content="Skapa eller gå med i en vinprovning, blindprova och betygsätt tillsammans, och avslöja resultaten." />
    <meta name="twitter:image" content="https://minvinkallare.se/og-image.png" />
```

(Remove the old `og:title`, `og:description`, `og:type`, `og:url`, `og:locale`, `og:site_name`, `twitter:card`, `twitter:title`, `twitter:description` lines so they are not duplicated.)

- [ ] **Step 2: Add JSON-LD structured data**

In `scripts/inject-meta.mjs`, immediately after the `const tags = \`...\`;` declaration, add:

```js
const jsonLd = `
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Vinkällaren",
      description: "Skapa eller gå med i en vinprovning, blindprova och betygsätt tillsammans, och avslöja resultaten. Plus: katalogisera din vinsamling och hitta rätt vin till maten.",
      url: "https://minvinkallare.se/",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "sv-SE",
      offers: { "@type": "Offer", price: "0", priceCurrency: "SEK" },
      featureList: [
        "Vinprovning med vänner",
        "Blindprovning med avslöjning",
        "Betygsätt och jämför viner tillsammans",
        "Katalogisera din vinsamling",
        "Hitta rätt vin till maten",
      ],
    })}</script>`;
```

Then change the injection line from:

```js
const patched = html.replace("</head>", tags + "\n  </head>");
```

to:

```js
const patched = html.replace("</head>", tags + jsonLd + "\n  </head>");
```

- [ ] **Step 3: Add a crawlable SEO content block**

In `scripts/inject-meta.mjs`, find the `skeleton` template literal. Change its final line from:

```js
    <div id="root"></div>`;
```

to:

```js
    <div id="seo-content" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)">
      <h1>Vinprovning med vänner</h1>
      <p>Vinkällaren är appen för vinprovning. Skapa en blindprovning, dela en kod med dina vänner och betygsätt vinerna tillsammans — avslöja resultaten när alla är klara. Håll dessutom ordning på din vinsamling och hitta rätt vin till maten.</p>
    </div>
    <div id="root"></div>`;
```

- [ ] **Step 4: Verify the script still runs against a build**

Run: `npm run web:build`
Expected: build completes; final log line includes "Injected SEO meta tags + loading skeleton ...".

- [ ] **Step 5: Assert the injected output**

Run (PowerShell):
```powershell
Select-String -Path dist/index.html -Pattern 'og:image','summary_large_image','application/ld\+json','id="seo-content"','Vinprovning med vänner'
```
Expected: matches for all five patterns.

- [ ] **Step 6: Commit**

```bash
git add scripts/inject-meta.mjs
git commit -m "feat(seo): OG image, JSON-LD, crawlable content block

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: SPA fallback for crawler routing

**Files:**
- Create (if missing): `public/_redirects`

- [ ] **Step 1: Check whether a fallback already exists**

Run: `npx wrangler pages download config 2>$null; Test-Path public/_redirects`
If `public/_redirects` already exists, inspect it; if it already maps `/*` to `/index.html 200`, skip to Step 3.

- [ ] **Step 2: Create the fallback**

Create `public/_redirects`:

```
/*    /index.html   200
```

(Cloudflare Pages serves existing static files — `/og-image.png`, `/sitemap.xml`, `/manifest.json` — before applying this rule, so only unknown paths like `/join/:code` fall through to the SPA shell.)

- [ ] **Step 3: Rebuild and confirm the file lands in dist**

Run: `npm run web:build`
Then: `Test-Path dist/_redirects`
Expected: `True`.

- [ ] **Step 4: Commit**

```bash
git add public/_redirects
git commit -m "fix(web): SPA fallback so /join links return index.html for crawlers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass (including the new `tasting-cta` tests).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run web:build`
Expected: completes without error; `dist/index.html`, `dist/og-image.png`, `dist/_redirects`, `dist/sitemap.xml` all present.

- [ ] **Step 4: Manual smoke (local web)**

Run: `npm run web`
Verify in the browser:
- Open `/join/TEST12` → landing shows "Du är inbjuded!" banner and "Gå med i provningen" as the primary button; login is collapsed behind "Har du redan ett konto?".
- End a tasting as a non-host participant → results screen shows the role-appropriate CTA card.

- [ ] **Step 5: Post-deploy crawler check (after merge + deploy)**

Run: `curl -sI https://minvinkallare.se/join/TEST12`
Expected: `HTTP/2 200` with `content-type: text/html` (confirms the SPA fallback serves the OG-tagged shell to crawlers). Optionally validate the share preview with a card validator.

---

## Self-review

**Spec coverage:**
- §1 conversion CTA → Tasks 1–4 ✓
- §2 invited landing → Task 5 ✓
- §3 OG preview → Tasks 7, 8, 9 ✓
- §4 start-your-own → Task 4 (`onStartOwnTasting`) + Task 2 variant ✓
- §5 SEO/positioning → Tasks 6, 8 ✓
- Out-of-scope (Phase 2, dynamic OG, migration) → not built ✓

**Placeholder scan:** none — every code/command step is concrete.

**Type consistency:** `resolveResultsCta({ isAnonymous, isHost })` and `ResultsCtaVariant` (Task 1) are used identically in `TastingCta` (Task 2); `ResultsDashboard` prop names (`isAnonymous`, `isHost`, `onCreateAccount`, `onStartOwnTasting`) match between Tasks 3 and 4; `UpgradePrompt` props (`visible`, `isBlocked`, `onUpgraded`, `onDismiss`) match the existing component signature.
