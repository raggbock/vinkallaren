import { Platform } from "react-native";

// ML Kit is native-only; Tesseract.js is used for web OCR
type TextBlock = { lines: { text: string }[] };

export type LabelParseResult = {
  rawText: string;
  name: string | null;
  producer: string | null;
  vintage: string | null;
  searchQuery: string;
  rawSearchQuery: string;
};

/**
 * Run OCR on a photo URI.
 * Native: ML Kit text recognition.
 * Web: Tesseract.js with Swedish + English language packs.
 */
export async function recognizeLabel(imageUri: string): Promise<TextBlock[]> {
  if (Platform.OS === "web") {
    return recognizeLabelWeb(imageUri);
  }
  const TextRecognition = (await import("@react-native-ml-kit/text-recognition")).default;
  const result = await TextRecognition.recognize(imageUri);
  return result.blocks;
}

async function recognizeLabelWeb(imageUri: string): Promise<TextBlock[]> {
  const Tesseract = await import("tesseract.js");

  const variants: PreprocessOptions[] = [
    { mode: "global", contrast: 1.4, threshold: 160, sharpen: false },
    { mode: "global", contrast: 1.2, threshold: 145, sharpen: false },
    { mode: "global", contrast: 1.4, threshold: 155, sharpen: true },
  ];

  // Preprocess all variants in parallel, then run OCR in parallel
  const processed = await Promise.all(
    variants.map((opts) => preprocessImageForOcr(imageUri, opts))
  );
  const ocrOpts = {
    tessedit_pageseg_mode: "3",
    preserve_interword_spaces: "1",
  } as Record<string, string>;
  const results = await Promise.all(
    processed.map((img) => Tesseract.recognize(img, "swe+eng", ocrOpts))
  );

  // Pick the result with highest confidence
  let best = results[0];
  for (let i = 1; i < results.length; i++) {
    if (results[i].data.confidence > best.data.confidence) best = results[i];
  }
  return (best.data.blocks ?? []).map((b) => ({
    lines: (b.paragraphs ?? []).flatMap((p) =>
      (p.lines ?? []).map((l) => ({ text: l.text }))
    ),
  }));
}

export type PreprocessOptions = {
  mode: "global" | "adaptive";
  contrast?: number;
  threshold?: number;
  blockSize?: number;  // For adaptive mode: local window size
  sharpen?: boolean;
};

/**
 * Preprocess image for OCR. Two modes:
 * - "global": grayscale → contrast → fixed threshold (good for clean labels)
 * - "adaptive": grayscale → sharpen → local mean threshold (good for uneven lighting/curved surfaces)
 */
export async function preprocessImageForOcr(
  imageUri: string,
  options?: PreprocessOptions,
): Promise<string> {
  const mode = options?.mode ?? "adaptive";
  const contrast = options?.contrast ?? 1.8;
  const threshold = options?.threshold ?? 140;
  const blockSize = options?.blockSize ?? 15;
  const doSharpen = options?.sharpen ?? true;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(imageUri); return; }

      // Downscale large images — Tesseract doesn't benefit from >1500px
      const maxDim = 1500;
      if (img.width > maxDim || img.height > maxDim) {
        const scale = maxDim / Math.max(img.width, img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Step 1: Convert to grayscale array
      const gray = new Float32Array(w * h);
      for (let i = 0; i < gray.length; i++) {
        const p = i * 4;
        gray[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
      }

      // Step 2: Optional sharpening (unsharp mask)
      let sharpened = gray;
      if (doSharpen) {
        sharpened = unsharpMask(gray, w, h, 1.5);
      }

      // Step 3: Binarize
      let binary: Uint8Array;
      if (mode === "adaptive") {
        binary = adaptiveThreshold(sharpened, w, h, blockSize, -8);
      } else {
        binary = globalThreshold(sharpened, w, h, contrast, threshold);
      }

      // Write back
      for (let i = 0; i < binary.length; i++) {
        const p = i * 4;
        d[p] = d[p + 1] = d[p + 2] = binary[i];
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for preprocessing"));
    img.src = imageUri;
  });
}

function globalThreshold(
  gray: Float32Array, w: number, h: number, contrast: number, thresh: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) {
    let v = ((gray[i] / 255 - 0.5) * contrast + 0.5) * 255;
    v = Math.max(0, Math.min(255, v));
    out[i] = v > thresh ? 255 : 0;
  }
  return out;
}

/** Adaptive mean threshold — compares each pixel to the local average */
function adaptiveThreshold(
  gray: Float32Array, w: number, h: number, blockSize: number, c: number,
): Uint8Array {
  const half = Math.floor(blockSize / 2);
  const out = new Uint8Array(w * h);

  // Build integral image for fast local mean computation
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] =
        rowSum + integral[y * (w + 1) + (x + 1)];
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      const localMean = sum / area;
      out[y * w + x] = gray[y * w + x] > localMean + c ? 255 : 0;
    }
  }
  return out;
}

/** Simple 3x3 unsharp mask for edge enhancement */
function unsharpMask(gray: Float32Array<ArrayBuffer>, w: number, h: number, amount: number): Float32Array<ArrayBuffer> {
  const blurred = new Float32Array(w * h);
  // 3x3 box blur
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += gray[(y + dy) * w + (x + dx)];
        }
      }
      blurred[y * w + x] = sum / 9;
    }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(0, Math.min(255, gray[i] + (gray[i] - blurred[i]) * amount));
  }
  return out;
}

/**
 * Score how "word-like" a line is: fraction of characters that belong
 * to real words (3+ consecutive letters). Noise lines score near 0,
 * "JOSETTA SAFFIRIO" scores near 1.
 */
export function lineQuality(line: string): number {
  const wordChars = (line.match(/[a-zA-ZÀ-ÿ]{3,}/g) ?? [])
    .reduce((sum, w) => sum + w.length, 0);
  return line.length > 0 ? wordChars / line.length : 0;
}

/**
 * Parse OCR text blocks into wine label candidates.
 *
 * Strategy:
 * 1. Score each line by "word quality" — real words vs noise characters.
 * 2. Keep only lines where ≥40% of characters form real words.
 * 3. Vintage: 4-digit year in range 1700–2030, pick latest if multiple.
 * 4. Rank remaining lines by quality × length (rewards real text).
 * 5. Wine name: highest-scoring line. Producer: second highest.
 */
export function parseWineLabel(blocks: TextBlock[]): LabelParseResult {
  const lines: string[] = [];
  for (const block of blocks) {
    for (const line of block.lines) {
      const trimmed = line.text.trim();
      if (trimmed.length > 0) lines.push(trimmed);
    }
  }

  const rawText = lines.join("\n");

  // --- Vintage ---
  const vintageRegex = /\b(1[7-9]\d{2}|20[0-2]\d|2030)\b/g;
  const years: number[] = [];
  for (const line of lines) {
    let match: RegExpExecArray | null;
    while ((match = vintageRegex.exec(line)) !== null) {
      years.push(parseInt(match[1], 10));
    }
  }
  const vintage = years.length > 0 ? String(Math.max(...years)) : null;

  // --- Score and filter lines ---
  const scored = lines
    .filter((l) => !/^\d{4}$/.test(l.trim()))
    .map((l) => ({ text: l, quality: lineQuality(l) }))
    .filter((l) => l.quality >= 0.4 && l.text.length >= 3);

  // Sort by quality × sqrt(length) — balances quality and size
  scored.sort((a, b) =>
    b.quality * Math.sqrt(b.text.length) - a.quality * Math.sqrt(a.text.length)
  );

  const candidateLines = scored.map((s) => s.text);

  const name = candidateLines[0] ?? null;
  const producer =
    candidateLines[1] && candidateLines[1] !== name
      ? candidateLines[1]
      : null;

  const searchQuery = [name, producer].filter(Boolean).join(" ");

  // Build a broader search query from all significant OCR lines
  const rawSearchQuery = candidateLines
    .slice(0, 6)
    .map(normalizeOcrText)
    .filter((l) => l.length >= 3)
    .join(" ");

  return { rawText, name, producer, vintage, searchQuery, rawSearchQuery };
}

// Common OCR misreads on wine labels
const OCR_REPLACEMENTS: [RegExp, string][] = [
  [/[|]/g, "l"],          // pipe → l
  [/(?<=[a-z])0/g, "o"],  // zero after letter → o
  [/(?<=[A-Z])0/g, "O"],  // zero after uppercase → O
  [/1(?=[a-z])/g, "l"],   // 1 before lowercase → l
  [/(?<=[b-df-hj-np-tv-z])rn(?=[b-df-hj-np-tv-z])/gi, "m"], // rn→m between consonants where rn is unlikely
];

/**
 * Normalize OCR text to improve fuzzy matching.
 * Strips accents, fixes common Tesseract misreads,
 * and removes noise characters.
 */
export function normalizeOcrText(text: string): string {
  // Strip diacritics (é→e, ö→o, â→a, etc.)
  let normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Apply common OCR error corrections
  for (const [pattern, replacement] of OCR_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Remove non-alphanumeric noise except spaces
  normalized = normalized.replace(/[^\w\s]/g, " ");

  // Collapse whitespace
  return normalized.replace(/\s+/g, " ").trim();
}
