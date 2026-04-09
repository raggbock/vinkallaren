import { Platform } from "react-native";

// Typography
export const serifFont = Platform.select({
  web: '"Cormorant Garamond", "Georgia", serif',
  ios: "Georgia",
  default: "serif",
});

export const handFont = Platform.select({
  web: '"Caveat", cursive',
  ios: "Noteworthy-Bold",
  default: "serif",
});

// Haggan-inspired natural wine palette
export const colors = {
  bg: "#FDFAF6",
  surface: "#FFFFFF",
  surfaceAlt: "#F0EBE3",
  accent: "#C83C2D",
  accentDark: "#A62E22",
  warm: "#E8A87C",
  text: "#2A2A2A",
  textSecondary: "#6B6B6B",
  textLight: "#FDFAF6",
  border: "#E0D8CE",
  borderLight: "#F0EBE3",
  black: "#1A1A1A",
  logoPanel: "#2b1714",
} as const;

// Spacing scale (4px base)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// Border radii
export const radii = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;
