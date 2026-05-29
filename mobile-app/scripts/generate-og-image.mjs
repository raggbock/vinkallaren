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
