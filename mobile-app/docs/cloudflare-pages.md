# Cloudflare Pages Setup

Use Cloudflare Pages to host the Expo web export from this repo.

## Repository Settings

- Repository: `raggbock/vinkallaren`
- Branch: `codex/initial-setup` for first test deploy
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

The app includes `public/_redirects` with:

```text
/* /index.html 200
```

That keeps SPA routes working on Cloudflare Pages.

## Domain

When the Pages site works, attach your custom domain in Cloudflare:

- Suggested first choice: `minvinkallare.se`
- Add the domain to Cloudflare
- Point the registrar nameservers to Cloudflare
- Attach the domain under Pages -> Custom domains
