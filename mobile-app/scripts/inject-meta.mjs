/**
 * Post-build: inject SEO meta tags into dist/index.html.
 * Expo's web export only includes title, description, and theme-color from app.json.
 * This adds OG, Twitter, canonical, and PWA tags that crawlers need statically.
 */
import { readFileSync, writeFileSync } from "fs";

const HTML_PATH = "dist/index.html";
const html = readFileSync(HTML_PATH, "utf-8");

const tags = `
    <link rel="preconnect" href="https://gonspypbhqvfvpgwsdtu.supabase.co" crossorigin />
    <link rel="dns-prefetch" href="https://gonspypbhqvfvpgwsdtu.supabase.co" />
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap" />
    <link rel="canonical" href="https://minvinkallare.se/" />
    <meta property="og:title" content="Vinkällaren — Din digitala vinsamling" />
    <meta property="og:description" content="Håll koll på din vinsamling, hitta rätt vin till maten och spara smaknoteringar. Gratis och utan reklam." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://minvinkallare.se/" />
    <meta property="og:locale" content="sv_SE" />
    <meta property="og:site_name" content="Vinkällaren" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Vinkällaren — Din digitala vinsamling" />
    <meta name="twitter:description" content="Håll koll på din vinsamling, hitta rätt vin till maten och spara smaknoteringar." />
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Vinkällaren" />`;

// Inject before </head>
const patched = html.replace("</head>", tags + "\n  </head>");

// Also fix the noscript message to Swedish
const withNoscript = patched.replace(
  "You need to enable JavaScript to run this app.",
  "Du behöver aktivera JavaScript för att använda Vinkällaren."
);

// Fix theme-color to match light theme
const withTheme = withNoscript.replace(
  '<meta name="theme-color" content="#2b1714">',
  '<meta name="theme-color" content="#FDFAF6">'
);

// Inject loading skeleton into <div id="root"> for instant LCP
const skeleton = `
    <div id="root"><div role="status" aria-label="Laddar Vinkällaren" style="background:#FDFAF6;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding-top:12vh;font-family:'Cormorant Garamond',Georgia,serif">
      <svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vinkällaren logotyp" style="width:280px;height:auto;opacity:0.9">
        <ellipse cx="180" cy="72" rx="155" ry="65" fill="none" stroke="#2A2A2A" stroke-width="1.8" opacity="0.14"/>
        <ellipse cx="180" cy="72" rx="146" ry="58" fill="none" stroke="#C83C2D" stroke-width="0.6" opacity="0.13"/>
        <text x="180" y="48" text-anchor="middle" font-family="'Cormorant Garamond',Georgia,serif" font-size="10" fill="#C83C2D" letter-spacing="4" font-weight="600">SEDAN 2026</text>
        <text x="180" y="84" text-anchor="middle" font-family="'Cormorant Garamond',Georgia,serif" font-size="42" fill="#2A2A2A" font-weight="700" letter-spacing="1.5">Vinkällaren</text>
        <text x="180" y="106" text-anchor="middle" font-family="'Cormorant Garamond',Georgia,serif" font-size="8.5" fill="#555555" letter-spacing="4.5" font-weight="400">SAMLA · SMAKA · UPPTÄCK</text>
      </svg>
      <p style="margin-top:32px;color:#555555;font-size:14px;letter-spacing:1px">Laddar din vinsamling...</p>
      <div style="margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:12px" aria-hidden="true">
        <div style="width:200px;height:12px;background:#E0D8CE;border-radius:6px;animation:pulse 1.5s ease-in-out infinite"></div>
        <div style="width:150px;height:12px;background:#E0D8CE;border-radius:6px;animation:pulse 1.5s ease-in-out infinite;animation-delay:0.2s"></div>
        <div style="width:170px;height:12px;background:#E0D8CE;border-radius:6px;animation:pulse 1.5s ease-in-out infinite;animation-delay:0.4s"></div>
      </div>
      <style>@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}</style>
    </div></div>`;
const withSkeleton = withTheme.replace('<div id="root"></div>', skeleton);

// Inject Cloudflare Web Analytics beacon before </body>
const CF_ANALYTICS_TOKEN = "2138bdeaf19c4a6e8322abfd4196952c";
const withAnalytics = CF_ANALYTICS_TOKEN
  ? withSkeleton.replace(
      "</body>",
      `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${CF_ANALYTICS_TOKEN}"}'></script>\n</body>`
    )
  : withSkeleton;

writeFileSync(HTML_PATH, withAnalytics);
console.log(
  `Injected SEO meta tags + loading skeleton${CF_ANALYTICS_TOKEN ? " + Cloudflare Analytics" : ""} into dist/index.html`
);
