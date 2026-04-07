# Server-Side OCR Edge Function

**Date:** 2026-04-07
**Status:** Draft

## Problem

On-device Tesseract.js achieves ~43% average confidence on wine label photos. Many labels use decorative fonts, curved surfaces, low contrast, and multiple languages (French, Italian, German) that Tesseract with `swe+eng` handles poorly. This results in weak catalog matches for roughly half of scanned labels.

## Goal

Move OCR processing to a Supabase Edge Function where we can run heavier preprocessing and multi-language Tesseract, improving text extraction quality. The app keeps its existing catalog matching logic unchanged.

Success criteria: useful catalog suggestions for most label photos (>80% of scans should produce a recognizable name/producer).

## Architecture

```
App (camera) → base64 image → POST /functions/v1/ocr-label
                                    │
                                    ├─ sharp preprocessing (multiple variants)
                                    ├─ Tesseract WASM (eng+fra+ita+deu+swe)
                                    ├─ Pick best confidence result
                                    └─ Parse → structured response
                                    │
App ← { name, producer, vintage, searchQuery, rawSearchQuery, confidence }
    │
    └─ Existing catalog matching (match_catalog_by_text RPC)
```

### Fallback

If the Edge Function fails or times out (10s), the app falls back to on-device OCR (ML Kit on native, Tesseract.js on web) — the current behavior.

## Edge Function: `ocr-label`

### Endpoint

`POST /functions/v1/ocr-label`

### Request

```json
{
  "image": "<base64-encoded JPEG/PNG>"
}
```

Max image size: 5MB (after base64 encoding ~6.7MB payload).

### Response

```json
{
  "name": "Crémant de Bourgogne",
  "producer": "Caves de Bailly",
  "vintage": "2021",
  "searchQuery": "Crémant de Bourgogne Caves de Bailly",
  "rawSearchQuery": "CREMANT DE BOURGOGNE EXTRA BRUT Caves de Bailly",
  "confidence": 62
}
```

### Error Response

```json
{
  "error": "OCR failed",
  "confidence": 0
}
```

## Preprocessing Pipeline

Run multiple preprocessing variants in parallel, OCR each, pick highest confidence:

### Variant 1: Full image, grayscale + normalize
- Auto-rotate (EXIF)
- Downscale to max 1500px wide
- Grayscale
- Normalize (stretch histogram)
- Sharpen (unsharp mask)

### Variant 2: Center crop (70% width, 80% height)
- Same processing as variant 1 but on cropped region
- Targets the label area, excludes bottle edges

### Variant 3: Full image, adaptive threshold
- Same base processing as variant 1
- Apply adaptive thresholding (local mean, block size 15)
- Better for uneven lighting and curved surfaces

### Variant 4: High contrast
- Grayscale + aggressive normalize
- Increase contrast via gamma correction (gamma 0.5)
- Targets low-contrast labels (light text on light backgrounds)

Pick the variant with highest Tesseract confidence. If multiple variants tie (within 5%), prefer the one with more recognized word-like tokens.

## Language Support

Tesseract trained data: `eng+fra+ita+deu+swe`

Covers the vast majority of wine labels:
- English (New World wines, back labels)
- French (Bordeaux, Burgundy, Champagne, Loire, Rhône, Alsace)
- Italian (Barolo, Chianti, Brunello, Prosecco)
- German (Riesling, Grüner Veltliner, Austrian wines)
- Swedish (Systembolaget labels, user's local language)

## Text Parsing

Reuse existing `parseOcrText()` logic from the test script, with the same:
- Noise filtering (DENOMINAZIONE, BOTTLED BY, etc.)
- Wine term boosting (CABERNET, MERLOT, etc.)
- Vintage extraction
- Line quality scoring
- OCR error normalization (accent stripping, common misreads)

This logic is already proven and shared between the test script and `src/lib/label-ocr.ts`.

## Performance

- Target: <5s total including network latency
- Tesseract WASM on Deno runs ~2-4s per image variant
- Running 4 variants in parallel should stay within budget on Edge Function
- Image transfer: ~200-500ms for a compressed JPEG

## App Integration

Minimal changes to existing flow:

1. `src/lib/label-ocr.ts` — add `recognizeLabelRemote(imageBase64)` that calls the Edge Function
2. `src/lib/catalog-search.ts` — no changes, receives same data shape
3. Scanning flow — try remote first, fall back to on-device on failure/timeout

## Future: Claude Vision Upgrade Path

If server-side Tesseract still underperforms, the Edge Function can be upgraded to call Claude Vision API instead of (or in addition to) Tesseract. The interface stays the same — the app doesn't need to change. This requires an Anthropic API key with billing, which is not set up yet.
