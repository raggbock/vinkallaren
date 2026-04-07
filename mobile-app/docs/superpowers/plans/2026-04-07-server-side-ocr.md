# Server-Side OCR Edge Function — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move OCR processing to a Supabase Edge Function with heavier preprocessing and multi-language support, improving wine label text extraction from ~43% to useful quality for most scans.

**Architecture:** App sends base64 image to `POST /functions/v1/ocr-label`. Edge Function runs preprocessing + Tesseract WASM with `eng+fra+ita+deu+swe`, picks best result, parses structured wine data, returns JSON. App uses existing catalog matching unchanged. Falls back to on-device OCR on failure.

**Tech Stack:** Supabase Edge Functions (Deno), tesseract.js (npm:tesseract.js@5 supports Deno/WASM), Canvas API via `jsr:@gfx/canvas` for image preprocessing (sharp uses native binaries incompatible with Deno Deploy).

**Constraint:** Deno Deploy does not support native Node.js addons (sharp, node-canvas). Image preprocessing must use pure JS/WASM solutions. Tesseract.js v5 works because it's WASM-based. For image manipulation we use `@gfx/canvas` (WASM-based canvas for Deno) or do preprocessing client-side before sending.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/functions/ocr-label/index.ts` | Edge Function entry point: receive image, orchestrate preprocessing + OCR, return result |
| — | ~~`supabase/functions/ocr-label/preprocess.ts`~~ | Removed: preprocessing done client-side (Deno Deploy can't run sharp) |
| Create | `supabase/functions/ocr-label/parse-label.ts` | Wine label text parsing (port from `src/lib/label-ocr.ts`) |
| Modify | `src/lib/label-ocr.ts` | Add `recognizeLabelRemote()` that calls Edge Function |
| Modify | `src/components/label-scanner-modal.tsx` (or wherever scanning is triggered) | Use remote OCR with on-device fallback |
| Create | `scripts/test-label-scan-remote.mjs` | Test script that calls Edge Function on etiketter/ images |

---

### Task 1: Scaffold the Edge Function

**Files:**
- Create: `supabase/functions/ocr-label/index.ts`

- [ ] **Step 1: Create the Edge Function entry point**

```ts
// supabase/functions/ocr-label/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing image (base64)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Placeholder — will wire in preprocessing + OCR in next tasks
    return new Response(
      JSON.stringify({
        name: null,
        producer: null,
        vintage: null,
        searchQuery: "",
        rawSearchQuery: "",
        confidence: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, confidence: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Create shared CORS headers**

```ts
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

- [ ] **Step 3: Deploy and verify the skeleton responds**

```bash
cd mobile-app
npx supabase functions deploy ocr-label --project-ref gonspypbhqvfvpgwsdtu
```

Test with curl:
```bash
curl -X POST "https://gonspypbhqvfvpgwsdtu.supabase.co/functions/v1/ocr-label" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"image":"dGVzdA=="}'
```

Expected: `{"name":null,"producer":null,"vintage":null,"searchQuery":"","rawSearchQuery":"","confidence":0}`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat: scaffold ocr-label edge function"
```

---

### Task 2: Image preprocessing (client-side approach)

Since Deno Deploy doesn't support native image libraries (sharp), we do preprocessing **client-side** before sending. The app already has sharp (web) and expo-image-manipulator (native). The Edge Function receives a pre-processed image and focuses on multi-language OCR.

**Files:**
- Modify: `src/lib/label-ocr.ts` — add `prepareImageForRemoteOcr()` 

- [ ] **Step 1: Add client-side image preparation**

Add to `src/lib/label-ocr.ts`:

```ts
/**
 * Prepare an image for remote OCR: downscale and compress.
 * Returns base64-encoded JPEG (no data: prefix).
 */
export async function prepareImageForRemoteOcr(imageUri: string): Promise<string> {
  if (Platform.OS === "web") {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1500;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        // Return as JPEG base64 (smaller than PNG)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUri;
    });
  }
  // Native: use expo-image-manipulator
  const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");
  const result = await manipulateAsync(
    imageUri,
    [{ resize: { width: 1500 } }],
    { compress: 0.85, format: SaveFormat.JPEG, base64: true },
  );
  return result.base64!;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/label-ocr.ts
git commit -m "feat: add client-side image preparation for remote OCR"
```

---

### Task 3: Wine label text parsing

**Files:**
- Create: `supabase/functions/ocr-label/parse-label.ts`

This is a port of the parsing logic from `src/lib/label-ocr.ts` (lines 254–380) adapted for Deno (no React/DOM dependencies).

- [ ] **Step 1: Port the parsing logic**

```ts
// supabase/functions/ocr-label/parse-label.ts

export type LabelParseResult = {
  name: string | null;
  producer: string | null;
  vintage: string | null;
  searchQuery: string;
  rawSearchQuery: string;
};

function cleanOcrLine(line: string): string {
  return line
    .split(/\s+/)
    .filter((t) => /[a-zA-ZÀ-ÿ]{2,}/.test(t) || /^\d{4}$/.test(t))
    .join(" ")
    .trim();
}

function lineQuality(line: string): number {
  const wc = (line.match(/[a-zA-ZÀ-ÿ]{3,}/g) ?? []).reduce(
    (s, w) => s + w.length,
    0,
  );
  return line.length > 0 ? wc / line.length : 0;
}

const NOISE_PATTERNS: RegExp[] = [
  /DENOMINAZ/i, /CONTROLLAT[AE]/i, /GARANTIT[AE]/i,
  /PRODUCT\s+OF/i, /IMBOTTIGLIATO/i, /BOTTLED\s+BY/i,
  /\bORIGIN[E]?\b/i, /APPELLATION.*CONTR[OÔ]L[ÉE]+/i,
  /CONTAINS\s+SUL[PF][HI]ITES/i, /MISE\s+EN\s+BOUTEILLE/i,
];

const WINE_TERMS =
  /CABERNET|MERLOT|PINOT|CHARDONNAY|SAUVIGNON|SANGIOVESE|NEBBIOLO|RIESLING|SYRAH|SHIRAZ|TEMPRANILLO|BAROLO|BARBERA|BRUNELLO|CHIANTI|PROSECCO|CHAMPAGNE|CREMANT|GRUNER/i;

const OCR_REPLACEMENTS: [RegExp, string][] = [
  [/[|]/g, "l"],
  [/(?<=[a-z])0/g, "o"],
  [/(?<=[A-Z])0/g, "O"],
  [/1(?=[a-z])/g, "l"],
];

function normalizeOcrText(text: string): string {
  let n = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [pattern, replacement] of OCR_REPLACEMENTS) {
    n = n.replace(pattern, replacement);
  }
  n = n.replace(/[^\w\s]/g, " ");
  return n.replace(/\s+/g, " ").trim();
}

export function parseLabelText(text: string): LabelParseResult {
  const lines = text.split("\n").filter((l) => l.trim());

  // Vintage extraction
  const vintageRegex = /\b(1[7-9]\d{2}|20[0-2]\d|2030)\b/g;
  const years: number[] = [];
  for (const line of lines) {
    let m: RegExpExecArray | null;
    while ((m = vintageRegex.exec(line)) !== null) years.push(parseInt(m[1], 10));
  }
  const vintage = years.length > 0 ? String(Math.max(...years)) : null;

  // Score and filter lines
  const scored = lines
    .filter((l) => !/^\d{4}$/.test(l.trim()))
    .map((l) => {
      const c = cleanOcrLine(l);
      let q = lineQuality(c);
      if (WINE_TERMS.test(c)) q = Math.min(1.0, q * 1.5);
      return { text: c, quality: q };
    })
    .filter(
      (l) =>
        l.quality >= 0.4 &&
        l.text.length >= 3 &&
        !NOISE_PATTERNS.some((p) => p.test(l.text)),
    )
    .sort(
      (a, b) =>
        b.quality * Math.sqrt(b.text.length) -
        a.quality * Math.sqrt(a.text.length),
    );

  const name = scored[0]?.text ?? null;
  const producer =
    scored[1] && scored[1].text !== name ? scored[1].text : null;
  const searchQuery = [name, producer].filter(Boolean).join(" ");

  const rawSearchQuery = scored
    .slice(0, 6)
    .map((s) => normalizeOcrText(s.text))
    .filter((l) => l.length >= 3)
    .join(" ");

  return { name, producer, vintage, searchQuery, rawSearchQuery };
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/ocr-label/parse-label.ts
git commit -m "feat: add wine label text parser for edge function"
```

---

### Task 4: Wire up Tesseract OCR in the Edge Function

**Files:**
- Modify: `supabase/functions/ocr-label/index.ts`

**Note:** Tesseract.js v5 uses WASM and works in Deno. If `npm:tesseract.js` has Deno Deploy issues (worker threads, filesystem), fall back to calling Tesseract via its HTTP/CDN worker mode or investigate `tesseract-wasm` (pure WASM, no worker threads). Test deployment early — this is the highest-risk task.

- [ ] **Step 1: Integrate Tesseract + parsing into the Edge Function**

Replace the placeholder in `index.ts`:

```ts
// supabase/functions/ocr-label/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createWorker } from "npm:tesseract.js@5";
import { corsHeaders } from "../_shared/cors.ts";
import { parseLabelText } from "./parse-label.ts";

// Warm worker on cold start — reused across requests
let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng+fra+ita+deu+swe");
  }
  return workerPromise;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing image (base64)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (image.length > 7_000_000) {
      return new Response(
        JSON.stringify({ error: "Image too large (max 5MB)" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const worker = await getWorker();

    // Decode base64 to buffer for Tesseract
    const imageBuffer = Uint8Array.from(atob(image), c => c.charCodeAt(0));

    // Run OCR (image is already preprocessed client-side)
    const { data } = await worker.recognize(imageBuffer);
    const parsed = parseLabelText(data.text);

    return new Response(
      JSON.stringify({
        ...parsed,
        confidence: Math.round(data.confidence),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message, confidence: 0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
```

- [ ] **Step 2: Deploy and test**

```bash
cd mobile-app
npx supabase functions deploy ocr-label --project-ref gonspypbhqvfvpgwsdtu
```

If deployment fails due to Tesseract.js worker thread issues, try:
1. Use `tesseract-wasm` (npm:tesseract-wasm) instead — pure WASM, no worker threads
2. Or bundle Tesseract worker inline

Test with curl:
```bash
IMAGE_B64=$(base64 -w 0 ../etiketter/1000003390.jpg)
curl -s -X POST "https://gonspypbhqvfvpgwsdtu.supabase.co/functions/v1/ocr-label" \
  -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$IMAGE_B64\"}" | jq .
```

Expected: JSON with name containing "Riesling", confidence > 40.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ocr-label/index.ts
git commit -m "feat: wire up Tesseract OCR in edge function"
```

---

### Task 5: Create test script for remote OCR

**Files:**
- Create: `scripts/test-label-scan-remote.mjs`

- [ ] **Step 1: Write the remote test script**

```js
/**
 * Test remote OCR edge function against etiketter/ images.
 * Usage: node scripts/test-label-scan-remote.mjs [folder]
 */
import fs from "node:fs";
import path from "node:path";
import { supabase } from "./lib/supabase-client.mjs";

const folder = process.argv[2] || path.resolve(import.meta.dirname, "../../etiketter");
const files = fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort();

console.log(`\nTesting ${files.length} images via remote OCR\n`);
console.log("─".repeat(90));

const results = [];

for (const file of files) {
  const filePath = path.join(folder, file);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const t0 = performance.now();

  const { data, error } = await supabase.functions.invoke("ocr-label", {
    body: { image: base64 },
  });

  const ms = Math.round(performance.now() - t0);

  if (error) {
    console.log(`${file.padEnd(30)} | ERROR: ${error.message} | ${ms}ms`);
    results.push({ file, error: true, ms });
    continue;
  }

  const shortName = file.length > 28 ? file.slice(0, 25) + "..." : file.padEnd(28);
  console.log(`${shortName} | conf: ${String(data.confidence).padStart(3)}% | ${ms}ms`);
  console.log(`  Namn:      ${data.name || "(inget)"}`);
  console.log(`  Producent: ${data.producer || "(ingen)"}`);
  console.log(`  Årgång:    ${data.vintage || "(ingen)"}`);
  console.log(`  Sökfråga:  ${data.searchQuery || "(tom)"}`);
  console.log("─".repeat(90));

  results.push({ file, ...data, ms });
}

// Summary
const ok = results.filter(r => !r.error);
const withName = ok.filter(r => r.name).length;
const avgConf = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + (r.confidence || 0), 0) / ok.length) : 0;
const avgMs = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + r.ms, 0) / ok.length) : 0;

console.log(`\nSammanfattning (${files.length} bilder):`);
console.log(`  Namn extraherat: ${withName}/${ok.length}`);
console.log(`  Snitt-konfidens: ${avgConf}%`);
console.log(`  Snitt-tid: ${avgMs}ms`);
console.log(`  Errors: ${results.filter(r => r.error).length}`);
```

- [ ] **Step 2: Run the test and compare results with local OCR**

```bash
cd mobile-app
node scripts/test-label-scan-remote.mjs
```

Compare confidence and name extraction with the local test results (43% avg confidence).

- [ ] **Step 3: Commit**

```bash
git add scripts/test-label-scan-remote.mjs
git commit -m "feat: add remote OCR test script"
```

---

### Task 6: Integrate remote OCR in the app

**Files:**
- Modify: `src/lib/label-ocr.ts`

- [ ] **Step 1: Add `recognizeLabelRemote()` function**

Add this function to `src/lib/label-ocr.ts`, after the existing `recognizeLabel()`:

```ts
type RemoteOcrResult = {
  name: string | null;
  producer: string | null;
  vintage: string | null;
  searchQuery: string;
  rawSearchQuery: string;
  confidence: number;
};

/**
 * Call the server-side OCR edge function.
 * Uses prepareImageForRemoteOcr() (from Task 2) for client-side preprocessing.
 * Returns null on failure (caller should fall back to on-device OCR).
 */
export async function recognizeLabelRemote(
  imageUri: string,
): Promise<RemoteOcrResult | null> {
  try {
    const { supabase } = await import("./supabase");
    const base64 = await prepareImageForRemoteOcr(imageUri);

    const { data, error } = await supabase.functions.invoke("ocr-label", {
      body: { image: base64 },
    });

    if (error || !data?.searchQuery) return null;
    return data as RemoteOcrResult;
  } catch {
    return null; // Fall back to on-device
  }
}
```

- [ ] **Step 2: Update the scanning flow to try remote first**

Find the component that calls `recognizeLabel()` + `parseWineLabel()` and update it to try remote OCR first with a 10s timeout, falling back to on-device:

```ts
// In the scanning handler (label-scanner-modal.tsx or similar):
import { recognizeLabelRemote, recognizeLabel, parseWineLabel } from "../lib/label-ocr";

// Try remote OCR first (better quality), fall back to on-device
let labelResult: LabelParseResult;

const remotePromise = recognizeLabelRemote(imageUri);
const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000));
const remoteResult = await Promise.race([remotePromise, timeoutPromise]);

if (remoteResult && remoteResult.searchQuery) {
  labelResult = {
    rawText: "",
    name: remoteResult.name,
    producer: remoteResult.producer,
    vintage: remoteResult.vintage,
    searchQuery: remoteResult.searchQuery,
    rawSearchQuery: remoteResult.rawSearchQuery,
  };
} else {
  // Fallback: on-device OCR
  const blocks = await recognizeLabel(imageUri);
  labelResult = parseWineLabel(blocks);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/label-ocr.ts src/components/label-scanner-modal.tsx
git commit -m "feat: integrate remote OCR with on-device fallback"
```

---

### Task 7: Test end-to-end and iterate

- [ ] **Step 1: Run remote test script on all 15 etiketter images**

```bash
cd mobile-app
node scripts/test-label-scan-remote.mjs
```

- [ ] **Step 2: Compare remote vs local results**

Run the existing local test as baseline:
```bash
node scripts/test-label-scan.mjs
```

Compare: confidence, name extraction accuracy, and response time.

- [ ] **Step 3: Tune if needed**

If results are worse than expected:
- Adjust preprocessing parameters (gamma, threshold, crop ratios)
- Try different Tesseract PSM modes (6 = single block, 4 = single column)
- Add more noise patterns if new garbage lines appear

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: tune server-side OCR preprocessing"
```
