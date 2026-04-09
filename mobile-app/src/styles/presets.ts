import { Platform, StyleSheet } from "react-native";
import { colors, radii, serifFont, spacing } from "./tokens";

/**
 * Composable base styles — shared patterns used across many components.
 * Import individual presets and spread/compose rather than one giant sheet.
 */
export const presets = StyleSheet.create({
  // Layout
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },

  // Panel / card bases
  panelBase: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: "2px 3px 0px rgba(200, 60, 45, 0.08)" },
      default: {},
    }),
  },
  cardBase: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.md + 2,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xxl,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontWeight: "700",
  },

  // Inputs
  inputBase: {
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 13,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Typography
  eyebrowText: {
    color: colors.accent,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  serifTitle: {
    fontFamily: serifFont,
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  labelText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
