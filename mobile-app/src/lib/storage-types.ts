export const SPACE_TYPE_OPTIONS = ["Vinkyl", "Vinställ", "Källare", "Övrigt"];
export const SPACE_TYPE_VALUES: Record<string, string> = { "Vinkyl": "vinkyl", "Vinställ": "vinstall", "Källare": "kallare", "Övrigt": "ovrigt" };
export const SPACE_TYPE_LABELS: Record<string, string> = Object.fromEntries(Object.entries(SPACE_TYPE_VALUES).map(([k, v]) => [v, k]));
