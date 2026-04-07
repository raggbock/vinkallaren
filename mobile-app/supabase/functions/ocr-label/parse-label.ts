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
