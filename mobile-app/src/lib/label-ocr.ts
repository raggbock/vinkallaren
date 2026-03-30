import { Platform } from "react-native";

// ML Kit is native-only — use dynamic import to avoid crashing web builds
type TextBlock = { lines: { text: string }[] };

export type LabelParseResult = {
  rawText: string;
  name: string | null;
  producer: string | null;
  vintage: string | null;
  searchQuery: string;
};

/**
 * Run on-device OCR on a photo URI.
 * Returns the raw TextBlock array from ML Kit.
 * Throws on web — callers should guard with Platform.OS !== "web".
 */
export async function recognizeLabel(imageUri: string): Promise<TextBlock[]> {
  if (Platform.OS === "web") {
    throw new Error("Label scanning is not available on web");
  }
  const TextRecognition = (await import("@react-native-ml-kit/text-recognition")).default;
  const result = await TextRecognition.recognize(imageUri);
  return result.blocks;
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

  return { rawText, name, producer, vintage, searchQuery };
}
