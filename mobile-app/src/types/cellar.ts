export type CellarSection = "cellar" | "add" | "tasting" | "history";

export const CELLAR_SECTIONS: Array<{ key: CellarSection; label: string }> = [
  { key: "cellar", label: "Min källare" },
  { key: "add", label: "Lägg till" },
  { key: "tasting", label: "Provning" },
  { key: "history", label: "Historik" },
];
