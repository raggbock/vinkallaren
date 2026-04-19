# Anonymous Pageview Tracking on minvinkallare.se

**Date:** 2026-04-19
**Status:** Approved

## Problem

Cloudflare Web Analytics reports 103 unique visitors in 24h on minvinkallare.se but can't tell us whether those are real humans or crawlers. AI bots, scrapers, and headless browsers slip past its filters. We need per-visit data (UA, referrer, viewport, pageview flow) to answer "are people actually visiting?"

## Goal

Add minimal cookieless pageview tracking to the web build so we can distinguish real humans from bots. Nothing more.

## Non-Goals

- No third-party analytics service (no PostHog, Plausible, GoatCounter, etc.)
- No user identification, no linking visits to authenticated users
- No custom event tracking beyond pageviews
- No IP logging, no cookies, no localStorage persistence
- No admin dashboard UI — data read via Supabase MCP/SQL editor
- No native app integration (bots aren't on iOS/Android)
- No replacement of Cloudflare Web Analytics — they run side-by-side

## Approach

Self-hosted pageview table in Supabase. A tiny inline `<script>` in the web build inserts one row per pageview directly via Supabase REST using the existing anon key.

### Supabase schema

```sql
create table public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid not null,
  path text not null,
  referrer text,
  ua text,
  screen_w int,
  screen_h int,
  language text
);
create index page_views_created_at_idx on page_views (created_at desc);

alter table page_views enable row level security;
create policy "anon insert" on page_views for insert to anon with check (true);
-- No SELECT policy — reads happen via service_role (MCP / Studio).
```

### Client tracker (inline, in `inject-meta.mjs`)

```js
<script>
(function(){
  try {
    var K='vk_sid', s=sessionStorage.getItem(K);
    if(!s){ s=crypto.randomUUID(); sessionStorage.setItem(K,s); }
    fetch('{{SUPABASE_URL}}/rest/v1/page_views', {
      method:'POST', keepalive:true,
      headers:{'Content-Type':'application/json','apikey':'{{ANON_KEY}}','Authorization':'Bearer {{ANON_KEY}}'},
      body: JSON.stringify({
        session_id: s,
        path: location.pathname + location.search,
        referrer: document.referrer || null,
        ua: navigator.userAgent,
        screen_w: screen.width, screen_h: screen.height,
        language: navigator.language || null
      })
    }).catch(function(){});
  } catch(e){}
})();
</script>
```

- Fires before the RN bundle boots — catches visitors who bail during load and some bots that don't execute the full app.
- `keepalive:true` so the request survives navigation.
- `session_id` in `sessionStorage` = tab-scoped, no cross-session persistence, no cookie banner required.
- All failures swallowed silently — tracking never blocks the app.

### Why these fields

| Field | Bot signal |
|---|---|
| `ua` | Crawler signatures (GPTBot, Claude-Web, Perplexity, headless Chrome patterns) |
| `referrer` | Known scraper gateways (e.g. `api.scraperforce.com`), empty vs. google/social |
| `screen_w/h` | 0×0 or unusual dimensions = headless |
| `language` | Bots often send `en-US` regardless of geo |
| `session_id` + `created_at` | Pageviews-per-session = bots usually 1.0 |

### What we deliberately skip

- **Country/geo**: would require a Cloudflare Pages Function to read `CF-IPCountry`. UA + referrer + viewport are strong enough bot signals. CF Web Analytics still provides country breakdown separately.
- **Returning-visitor metrics**: tab-scoped sessions only. Not the goal.

## Changes

1. **New migration** `mobile-app/supabase/migrations/20260419110000_page_views.sql` (~20 lines) — table + RLS policy.
2. **`mobile-app/scripts/inject-meta.mjs`** (+~25 lines) — read `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from env, inject minified tracker before `</body>`. Skip injection if env vars are missing (build still succeeds).
3. **`mobile-app/src/components/privacy-policy-modal.tsx`** (+3, -1) — replace "Vi använder inga analys-, spårnings- eller reklamcookies" with "Vi använder inga spårningscookies. Anonym besöksstatistik (sidväg, webbläsare, hänvisare, skärmstorlek) lagras i Supabase utan IP-adress." Add to third-party list: "Supabase — lagring, inloggning, och anonym besöksstatistik".

## How to read the data

Via Supabase MCP or SQL editor (using service_role):

```sql
-- Sessions in last 24h
select count(*) views, count(distinct session_id) sessions,
       count(distinct ua) unique_uas
from page_views where created_at > now() - interval '24 hours';

-- Pageviews per session (bots cluster at 1.0)
select session_id, count(*) n, min(ua) ua
from page_views where created_at > now() - interval '24 hours'
group by session_id order by n desc;

-- Spot obvious crawlers
select ua, count(*) from page_views
where created_at > now() - interval '24 hours'
  and (ua ilike '%bot%' or ua ilike '%crawler%' or ua ilike '%spider%'
       or ua ilike '%scraper%' or ua ilike '%headless%')
group by ua order by 2 desc;
```

## Acceptance

- Migration applies cleanly: `page_views` table exists with RLS on, `anon insert` policy, no SELECT policy.
- After `npm run web:build`, `dist/index.html` contains the tracker script before `</body>`, with URL and key substituted (not the placeholders).
- Opening minvinkallare.se in an incognito browser inserts one row. Reload = another row with same `session_id`. Closing tab and reopening = new `session_id`.
- Anon client cannot SELECT from `page_views` (try in Supabase SQL editor with role = anon).
- No new cookies in DevTools → Application → Cookies.
- Privacy policy modal reflects the change.

## Risks & mitigations

- **Abuse (spam inserts)**: anon can POST unlimited rows. Tiny site, low risk initially. If it becomes a problem: add Cloudflare rate-limit rule on `*.supabase.co/rest/v1/page_views`, or switch to a Pages Function middleman with its own rate limit.
- **Payload size**: add column `check` constraints later if needed. Skip for now (YAGNI).

## Line budget

Estimated delta: **+50, -2** across 3 files. Well under the 500-line limit.
