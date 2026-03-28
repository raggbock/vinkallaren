# Release Guide

This repo has two release tracks:

## Mobile

- Build previews with EAS using `eas.json`
- Use `preview` for internal testers
- Use `production` for App Store / Google Play release candidates

Commands:

```powershell
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
```

## Web

The Expo app can also be exported as a static web app.

Local preview:

```powershell
npm run web
```

Static export:

```powershell
npm run web:build
```

Recommended deploy settings for Cloudflare Pages:

- Build command: `npm run web:build`
- Output directory: `dist`
- SPA fallback: `public/_redirects`

## Current Launch Notes

- `vinkallaren.se` appears to already be in use by an existing site and email setup.
- A .se registration at Loopia shows public pricing starting around 11.25 SEK ex. VAT for some offers, but pricing varies by case and registrar.
- Cloudflare Pages has a free plan and is a strong fit for this web preview path.
