/**
 * Strip the producer name from the start of a wine name.
 * E.g. "Penfolds Grange" with producer "Penfolds" → "Grange"
 */
export function stripProducerPrefix(name, producer) {
  if (!name || !producer) return name;
  if (name.toLowerCase().startsWith(producer.toLowerCase() + " ")) {
    const stripped = name.slice(producer.length).trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
}

/**
 * Replace runs of whitespace with a single space.
 */
export function collapseSpaces(str) {
  return str ? str.replace(/\s{2,}/g, " ").trim() : str;
}

/**
 * Normalize curly/backtick apostrophes to a plain ASCII apostrophe.
 */
export function normalizeApostrophes(str) {
  return str ? str.replace(/[\u2018\u2019\u201A\u201B\u00B4\u0060]/g, "'") : str;
}

/**
 * Map free-text wine type strings to canonical Swedish type labels.
 */
export function normalizeType(value) {
  if (!value) return null;
  const t = String(value).trim();
  if (/^rött/i.test(t) || /rött vin/i.test(t)) return "Rött";
  if (/^vitt/i.test(t) || /vitt vin/i.test(t)) return "Vitt";
  if (/mousserande/i.test(t)) return "Mousserande";
  if (/^sött/i.test(t) || /dessert/i.test(t)) return "Sött";
  if (/rosé|rose/i.test(t)) return "Rosé";
  if (/orange/i.test(t)) return "Orange";
  return t;
}
