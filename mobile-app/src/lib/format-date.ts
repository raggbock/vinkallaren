/** "3 apr. 2026" */
export function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

/** "3 april 2026" */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}

/** "3 apr." */
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

/** "2026-04-03" */
export function formatDateISO(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("sv-SE");
}
