# PostHog Analytics on minvinkallare.se

**Date:** 2026-04-19
**Status:** Approved

## Problem

Cloudflare Web Analytics reports 103 unique visitors in 24h on minvinkallare.se, but we can't tell whether that's real users or crawlers/bots. CF Web Analytics filters known bots but AI crawlers, scrapers, and headless browsers slip through. We need per-visitor data (UA, referrer, country, pageview flow) to answer the question "are people actually visiting?" without building our own log pipeline.

## Goal

Add minimal cookieless analytics on the web build so we can distinguish real humans from bots. Nothing more.

## Non-Goals

- No user identification (don't link Supabase users to PostHog)
- No custom event tracking beyond pageviews
- No session recording, surveys, feature flags, or experiments
- No cookie-consent banner (avoid by using cookieless mode)
- No native app integration (the iOS/Android app isn't where bots are)
- No replacement of Cloudflare Web Analytics — they run side-by-side

## Approach

PostHog loads via a `<script>` snippet injected into `dist/index.html` by `mobile-app/scripts/inject-meta.mjs`. Same pattern as the existing Cloudflare beacon — lives entirely outside the RN bundle, so native builds are unaffected.

PostHog is configured in cookieless/IP-less mode:

```js
posthog.init(POSTHOG_KEY, {
  api_host: "https://eu.i.posthog.com",
  persistence: "memory",
  disable_session_recording: true,
  disable_surveys: true,
  autocapture: false,
  capture_pageview: true,
  capture_pageleave: true,
  ip: false,
  property_blacklist: ["$ip"],
});
```

This captures: browser, OS, geoip country/city (derived server-side, raw IP discarded), referrer, URL, pageview flow, session duration. Enough to spot bots by UA patterns, referrer, and geography.

**Instance:** PostHog EU Cloud (`eu.posthog.com` / `eu.i.posthog.com`) for data residency.
**Persistence: memory** — no cookies, no localStorage. Each tab counts as a new session. Trade-off: returning-user metrics are meaningless, but that's not the goal. No consent banner required.
**ip: false** + `$ip` blacklist — PostHog processes IP for geoip but doesn't store it.

## Changes

### 1. `mobile-app/scripts/inject-meta.mjs` (+~15 lines)

Add a PostHog snippet block after the Cloudflare Web Analytics injection. Hardcode the public Project API Key (same pattern as `CF_ANALYTICS_TOKEN` — these are publishable keys, safe in client bundles).

### 2. `mobile-app/src/components/privacy-policy-modal.tsx` (+3 lines, -1 line)

- Update "Cookies och lokal lagring" section: remove the line "Vi använder inga analys-, spårnings- eller reklamcookies." Replace with "Vi använder inga spårningscookies — analys sker cookielöst via PostHog EU."
- Add PostHog to the "Tredjeparter" list: "PostHog (EU) — cookielös besöksstatistik, ingen IP-lagring."

## Manual Steps (User)

1. Create new PostHog project on **eu.posthog.com** (not US). Name it "Vinkällaren".
2. Copy the Project API Key.
3. Paste into `inject-meta.mjs` where the placeholder `POSTHOG_KEY` lives.

## Acceptance

- `npm run web:build` produces `dist/index.html` with the PostHog snippet before `</body>`.
- After deploy, opening minvinkallare.se in an incognito browser fires a `$pageview` event visible in the PostHog EU dashboard within ~30 seconds.
- No new cookies are set in DevTools → Application → Cookies (only Supabase auth + `__cf_bm` remain).
- The privacy policy modal reflects the new third party.

## Line Budget

Estimated total delta: **+20, -2**. Both files stay well under the 500-line limit.
