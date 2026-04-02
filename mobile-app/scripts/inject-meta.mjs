/**
 * Post-build: inject SEO meta tags into dist/index.html.
 * Expo's web export only includes title, description, and theme-color from app.json.
 * This adds OG, Twitter, canonical, and PWA tags that crawlers need statically.
 */
import { readFileSync, writeFileSync } from "fs";

const HTML_PATH = "dist/index.html";
const html = readFileSync(HTML_PATH, "utf-8");

const tags = `
    <link rel="canonical" href="https://vinkallaren.pages.dev/" />
    <meta property="og:title" content="Vinkällaren — Din digitala vinsamling" />
    <meta property="og:description" content="Håll koll på din vinsamling, hitta rätt vin till maten och spara smaknoteringar. Gratis och utan reklam." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://vinkallaren.pages.dev/" />
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
const final = patched.replace(
  "You need to enable JavaScript to run this app.",
  "Du behöver aktivera JavaScript för att använda Vinkällaren."
);

writeFileSync(HTML_PATH, final);
console.log("Injected SEO meta tags into dist/index.html");
