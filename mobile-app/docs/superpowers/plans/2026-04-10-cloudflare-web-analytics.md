# Cloudflare Web Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudflare Web Analytics to the Vinkällaren web build for privacy-friendly, cookie-free visitor tracking.

**Architecture:** Cloudflare Web Analytics works via a single `<script>` tag with a site token, injected before `</body>`. We add this to the existing `inject-meta.mjs` post-build script so it's included in every production build. The token is stored as a build-time constant (not a secret — it's a public client-side token).

**Tech Stack:** Cloudflare Web Analytics (free), Node.js build script

---

## Prerequisites

Before starting, you need a Cloudflare Web Analytics site token:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Web Analytics
2. Add site `minvinkallare.se`
3. Copy the token (the `token` value from the provided script tag — looks like a hex string)

---

### Task 1: Add the analytics snippet to inject-meta.mjs

**Files:**
- Modify: `scripts/inject-meta.mjs:62-68`

- [ ] **Step 1: Add the Cloudflare beacon script injection**

In `scripts/inject-meta.mjs`, add a new injection step between the skeleton injection and the final write. The snippet goes before `</body>` (not `</head>`) per Cloudflare's recommendation:

```javascript
// Inject Cloudflare Web Analytics beacon before </body>
const CF_ANALYTICS_TOKEN = process.env.CF_ANALYTICS_TOKEN || "";
const withAnalytics = CF_ANALYTICS_TOKEN
  ? withSkeleton.replace(
      "</body>",
      `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF_ANALYTICS_TOKEN}"}'></script>\n</body>`
    )
  : withSkeleton;

const final = withAnalytics;
```

Replace the existing `const final = withSkeleton;` line with the above block.

- [ ] **Step 2: Update the console.log to reflect the new injection**

Update the final log line:

```javascript
console.log(
  `Injected SEO meta tags + loading skeleton${CF_ANALYTICS_TOKEN ? " + Cloudflare Analytics" : ""} into dist/index.html`
);
```

- [ ] **Step 3: Run the build locally to verify**

Run: `cd mobile-app && npm run web:build`

Expected: Build succeeds. Without `CF_ANALYTICS_TOKEN` set, the analytics snippet is NOT injected (graceful skip). Console says "Injected SEO meta tags + loading skeleton into dist/index.html".

- [ ] **Step 4: Verify with token set**

Run: `cd mobile-app && CF_ANALYTICS_TOKEN=test123 npm run web:build`

Then check the output:

Run: `grep -c "cloudflareinsights" dist/index.html`

Expected: `1` — the beacon script is present with `data-cf-beacon='{"token":"test123"}'`.

- [ ] **Step 5: Commit**

```bash
git add scripts/inject-meta.mjs
git commit -m "feat: add Cloudflare Web Analytics beacon to web build"
```

---

### Task 2: Configure the token in Cloudflare Pages environment

**Files:** None (Cloudflare dashboard only)

- [ ] **Step 1: Add environment variable in Cloudflare Pages**

In the Cloudflare Dashboard:
1. Go to Pages → vinkällaren project → Settings → Environment variables
2. Add variable:
   - Name: `CF_ANALYTICS_TOKEN`
   - Value: *(the token from the prerequisite step)*
   - Environment: Production (and optionally Preview)

- [ ] **Step 2: Trigger a new deploy**

Push the commit from Task 1 to `codex/initial-setup`. Cloudflare Pages will auto-deploy.

- [ ] **Step 3: Verify in production**

After deploy completes, visit https://minvinkallare.se and check:
1. View page source → search for `cloudflareinsights` — the script tag should be present
2. In DevTools Network tab → look for a request to `cloudflareinsights.com/beacon.min.js`
3. Check Cloudflare Dashboard → Web Analytics → data should start appearing within minutes

---

## Notes

- **No cookie, no GDPR consent needed** — Cloudflare Web Analytics is privacy-first
- **Zero impact on performance** — the script is `defer`ed and tiny (~5KB)
- **Token is not a secret** — it's visible in page source by design (like a Google Analytics ID)
- **Graceful degradation** — if `CF_ANALYTICS_TOKEN` is not set, no snippet is injected, build works fine
