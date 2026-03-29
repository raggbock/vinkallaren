export type CellarSection = "cellar" | "add" | "meal" | "history";

export const CELLAR_SECTIONS: Array<{ key: CellarSection; label: string }> = [
  { key: "cellar", label: "Min källare" },
  { key: "add", label: "Lägg till" },
  { key: "meal", label: "Mat" },
  { key: "history", label: "Historik" },
];
