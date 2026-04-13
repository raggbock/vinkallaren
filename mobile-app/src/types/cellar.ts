export type CellarSection = "cellar" | "add" | "tasting" | "discover" | "history";

export const CELLAR_SECTIONS: Array<{ key: CellarSection; label: string }> = [
  { key: "cellar", label: "Min källare" },
  { key: "add", label: "Lägg till" },
  { key: "tasting", label: "Provning" },
  { key: "discover", label: "Upptäck" },
  { key: "history", label: "Historik" },
];
