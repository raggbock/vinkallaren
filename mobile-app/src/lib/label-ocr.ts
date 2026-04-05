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
  const { data } = await Tesseract.recognize(imageUri, "swe+eng");
  // Map Tesseract blocks → TextBlock format expected by parseWineLabel
  return (data.blocks ?? []).map((b) => ({
    lines: (b.paragraphs ?? []).flatMap((p) =>
      (p.lines ?? []).map((l) => ({ text: l.text }))
    ),
  }));
}

/**
 * Parse OCR text blocks into wine label candidates.
 *
 * Strategy:
 * 1. Vintage: 4-digit year in range 1700–2030, pick latest if multiple.
 * 2. Wine name: longest text line (labels put the name largest; ML Kit returns blocks roughly by size).
 * 3. Producer: second longest line if sufficiently different from name.
 * 4. Search query: name + producer combined for trigram matching.
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

  // --- Filter lines: remove pure-year lines and very short lines ---
  const candidateLines = lines
    .filter((l) => !/^\d{4}$/.test(l.trim()))
    .filter((l) => l.length >= 3)
    .sort((a, b) => b.length - a.length);

  const name = candidateLines[0] ?? null;
  const producer =
    candidateLines[1] && candidateLines[1] !== name
      ? candidateLines[1]
      : null;

  const searchQuery = [name, producer].filter(Boolean).join(" ");

  // Build a broader search query from all significant OCR lines
  const rawSearchQuery = candidateLines
    .slice(0, 4)
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
