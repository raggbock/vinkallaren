import { Platform, StyleSheet } from "react-native";
import { colors, serifFont, handFont } from "./tokens";

// Re-export tokens for backward compatibility
export { colors, handFont, serifFont };

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  scannerScreen: { flex: 1, backgroundColor: colors.bg, padding: 18, gap: 18 },
  catalogEditorContent: { gap: 14, paddingBottom: 24 },
  scannerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  scannerTitle: { fontFamily: serifFont, color: colors.text, fontSize: 28, lineHeight: 30, fontWeight: "700" },
  scannerFrame: { overflow: "hidden", borderRadius: 28, backgroundColor: colors.black, minHeight: 420 },
  camera: { flex: 1, minHeight: 420 },
  scannerHint: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  modalActionRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  scrollContent: { padding: 20, gap: 22, maxWidth: 560, width: "100%", alignSelf: "center" },
  eyebrow: { color: colors.accent, letterSpacing: 2, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },

  // Panel
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: "2px 3px 0px rgba(200, 60, 45, 0.08)" },
      default: {},
    }),
  },
  scrollFlex: { flex: 1 },

  // Bottom tab bar
  bottomTabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    paddingTop: 8,
  },
  bottomTab: { flex: 1, alignItems: "center", gap: 2, minHeight: 44, justifyContent: "center" },
  bottomTabIcon: { fontSize: 20, color: colors.textSecondary },
  bottomTabIconActive: { color: colors.accent },
  bottomTabLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  bottomTabLabelActive: { color: colors.accent },

  // Stats
  statsSummaryBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  statsSummaryText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  statsSummaryToggle: { color: colors.accent, fontSize: 12 },
  statsGrid: { gap: 8 },
  statsGridRow: { flexDirection: "row", gap: 8 },

  // Storage
  storageCard: { backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  storageCardHeader: { flexDirection: "row", alignItems: "center" },
  storageCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Input
  inputGroup: { gap: 6 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  input: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: colors.surface, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  autocompleteList: { marginTop: 6, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  autocompleteItem: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  autocompleteText: { color: colors.text, fontSize: 15 },
  textarea: { minHeight: 96, textAlignVertical: "top" },

  // Buttons
  primaryButton: { backgroundColor: colors.accent, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center" },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  imageButtonRow: { flexDirection: "row", gap: 8 },
  secondaryButton: { backgroundColor: "transparent", borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", flex: 1, borderWidth: 1.5, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontWeight: "700" },

  // Panel header
  panelHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontFamily: serifFont, color: colors.text, fontSize: 24, fontWeight: "700" },
  linkText: { color: colors.accent, fontWeight: "700" },

  // Metrics
  metricsRow: { flexDirection: "row", gap: 10 },
  metricCard: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 18, padding: 12, gap: 4 },
  metricValue: { fontFamily: serifFont, color: colors.text, fontSize: 22, fontWeight: "700" },
  metricLabel: { color: colors.textSecondary, fontSize: 12 },
  insightCard: { borderRadius: 18, backgroundColor: colors.surface, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  insightValue: { color: colors.text, fontSize: 18, fontWeight: "700" },

  // Import
  importSuggestionCard: { borderRadius: 18, backgroundColor: "#FFF8F0", padding: 14, gap: 8, borderWidth: 1, borderColor: colors.warm },
  importModeRow: { gap: 8 },
  quickImportButton: { backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  quickImportButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickImportText: { color: colors.accent, fontWeight: "700", textAlign: "center" },
  quickImportTextActive: { color: "#FFFFFF" },
  importOptionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surface },
  importOptionRowActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.accent },
  importOptionText: { color: colors.text, fontWeight: "600" },
  importOptionState: { color: colors.textSecondary, fontWeight: "700" },
  importOptionTextActive: { color: colors.accent },

  // Recommendation / storage space cards
  recommendationCard: { borderRadius: 18, backgroundColor: colors.surface, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  storageSpaceCard: { borderRadius: 18, backgroundColor: colors.surface, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  recommendationHeader: { flexDirection: "row", gap: 12 },
  storageSpaceHeader: { flexDirection: "row", gap: 12 },
  recommendationName: { fontFamily: serifFont, color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 2 },
  doubleRow: { flexDirection: "row", gap: 12 },

  // Wine card
  wineCard: { borderTopWidth: 2, borderTopColor: colors.border, paddingTop: 20, paddingBottom: 10, marginTop: 6, gap: 12 },
  wineCardHighlighted: { backgroundColor: "#FFF8F0", borderRadius: 16, padding: 12, borderWidth: 2, borderColor: colors.warm },
  wineImage: { width: "100%", height: 200, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  wineCardHeader: { flexDirection: "row", gap: 12 },
  wineType: { color: colors.accent, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2 },
  wineName: { fontFamily: serifFont, color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 2 },
  wineMeta: { color: colors.textSecondary, marginTop: 4 },
  locationText: { color: colors.accent, marginTop: 6, fontWeight: "600" },
  quantityBadge: { backgroundColor: colors.surfaceAlt, alignSelf: "flex-start", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 10 },
  ratingBadge: { alignSelf: "flex-start" },
  ratingBadgeText: { fontSize: 18, color: colors.warm, letterSpacing: 2 },
  quantityBadgeText: { color: colors.accent, fontWeight: "700" },

  // Tags
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  foodSection: { gap: 8 },
  tagPill: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  foodPill: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  foodPillActive: { backgroundColor: colors.accent },
  foodText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  foodTextActive: { color: "#FFFFFF" },

  // Food pairing
  foodPairingRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  foodPairingLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "500" },
  foodPairingTags: { flexDirection: "row", alignItems: "baseline", gap: 4, flexWrap: "wrap" },
  foodPairingText: { color: colors.textSecondary, fontSize: 12, fontWeight: "500", backgroundColor: colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
  foodPairingOverflow: { color: colors.textSecondary, fontSize: 11, fontWeight: "600", paddingHorizontal: 4 },

  // Food categories
  foodCategoryGroup: { gap: 6 },
  foodCategoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 2 },
  foodCategoryLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  foodCategoryLabelActive: { color: colors.accent },
  foodCategoryChevron: { color: colors.textSecondary, fontSize: 14 },
  mealSelectedLabel: { color: "#FFFFFF", fontWeight: "700", fontSize: 14, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },

  // Suggestions
  suggestionPill: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  suggestionPillActive: { backgroundColor: colors.accent },
  suggestionText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  suggestionTextActive: { color: "#FFFFFF" },

  // Misc
  notesText: { color: colors.textSecondary, lineHeight: 21 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  drinkAction: { backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  drinkActionText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  actionSpacer: { flex: 1 },
  dangerText: { color: "#C85050", fontSize: 13 },
  filterToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  filterToggleText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  emptyStateCard: { alignItems: "center" as const, padding: 28, gap: 10 },
  emptyStateTitle: { fontFamily: serifFont, color: colors.text, fontSize: 18, fontWeight: "700" as const },
  emptyState: { color: colors.textSecondary, lineHeight: 21, textAlign: "center" as const },
  loadingInline: { flexDirection: "row", alignItems: "center", gap: 10 },
  storageSpaceForm: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },

  // Vintage picker
  vintagePickerOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  vintagePickerCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, width: "85%", maxWidth: 400, maxHeight: "60%", borderWidth: 1, borderColor: colors.border },
  vintagePickerTitle: { fontFamily: serifFont, fontSize: 18, fontWeight: "600", color: colors.text, marginBottom: 12 },
  vintagePickerSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  vintagePickerItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 48, justifyContent: "center" },
  vintagePickerItemText: { fontSize: 16, color: colors.text },
  vintagePickerAddButton: { marginTop: 12, paddingVertical: 14, alignItems: "center", backgroundColor: "transparent", borderRadius: 12, minHeight: 48, justifyContent: "center", borderWidth: 1.5, borderColor: colors.accent },
  vintagePickerAddText: { fontSize: 16, color: colors.accent, fontWeight: "600" },

  // Footer
  footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingBottom: 8 },
  footerVersion: { color: colors.textSecondary, fontSize: 10, opacity: 0.6 },
  footerLink: { color: colors.textSecondary, fontSize: 10, textDecorationLine: "underline" },

  // Stat boxes
  statBox: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12, alignItems: "center" },
  statBoxValue: { fontFamily: serifFont, color: colors.accent, fontSize: 20, fontWeight: "800" },
  statBoxLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },

  // Info badges
  infoBadge: { backgroundColor: "transparent", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  infoBadgeText: { color: colors.accent, fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  wineThumbnail: { width: 64, height: 86, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  sectionChevron: { color: colors.textSecondary, fontSize: 16, fontWeight: "600" },
});
