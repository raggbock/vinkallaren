export type CellarSection = "overview" | "storage" | "catalog" | "meal" | "add" | "cellar" | "history";

export const CELLAR_SECTIONS: Array<{ key: CellarSection; label: string }> = [
  { key: "cellar", label: "Min källare" },
  { key: "history", label: "Historik" },
  { key: "storage", label: "Platser" },
  { key: "catalog", label: "Katalog" },
  { key: "meal", label: "Mat" },
  { key: "add", label: "Lägg till" },
  { key: "overview", label: "Översikt" },
];
