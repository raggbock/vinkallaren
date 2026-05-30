# Cloudflare Pages Setup

Use Cloudflare Pages to host the Expo web export from this repo.

## Repository Settings

- Repository: `raggbock/vinkallaren`
- Production branch: `main` (the old `codex/initial-setup` branch is archived as tag `archive/codex-initial-setup` and no longer exists — the Pages "Production branch" setting MUST be `main` or deploys will silently stop)
- Root directory: `mobile-app`

## Build Settings

- Framework preset: `None`
- Build command: `npm run web:build`
- Build output directory: `dist`
- Node version: `22`

## Environment Variables

Set these in Cloudflare Pages:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PRODUCT_LOOKUP_URL` if external product lookup is enabled

## Routing

SPA routing (serving `index.html` with HTTP 200 for unknown paths such as
`/join/:code`) is handled by `wrangler.jsonc`:

```jsonc
"assets": { "not_found_handling": "single-page-application" }
```

Do NOT add a `public/_redirects` with `/* /index.html 200` — this project
deploys as Cloudflare Workers Static Assets, where that rule fails the build
with "Infinite loop detected" (code 100324). The wrangler.jsonc setting above
is the correct SPA fallback.

## Domain

When the Pages site works, attach your custom domain in Cloudflare:

- Suggested first choice: `minvinkallare.se`
- Add the domain to Cloudflare
- Point the registrar nameservers to Cloudflare
- Attach the domain under Pages -> Custom domains
