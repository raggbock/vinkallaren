import { Platform, StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: "#2b1714",
  },
  screenCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2b1714",
    gap: 12,
  },
  scannerScreen: {
    flex: 1,
    backgroundColor: "#2b1714",
    padding: 18,
    gap: 18,
  },
  catalogEditorContent: {
    gap: 14,
    paddingBottom: 24,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  scannerTitle: {
    color: "#fff6ee",
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "700",
  },
  scannerFrame: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#120907",
    minHeight: 420,
  },
  camera: {
    flex: 1,
    minHeight: 420,
  },
  scannerHint: {
    color: "#ead8ca",
    fontSize: 15,
    lineHeight: 22,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  scrollContent: {
    padding: 18,
    gap: 18,
  },
  heroPanel: {
    backgroundColor: "#5c1d1b",
    borderRadius: 28,
    padding: 22,
    gap: 12,
  },
  eyebrow: {
    color: "#f4c38c",
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff6ee",
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
  },
  heroText: {
    color: "#ead8ca",
    fontSize: 15,
    lineHeight: 23,
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#fff6ee",
  },
  infoBox: {
    marginTop: 6,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    gap: 6,
  },
  infoLabel: {
    color: "#f4c38c",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  infoValue: {
    color: "#fff6ee",
    fontSize: 14,
  },
  loadingText: {
    color: "#fff6ee",
    fontSize: 16,
  },
  panel: {
    backgroundColor: "#f8f1e8",
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#6f1d1b",
  },
  segmentText: {
    color: "#6f6259",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#fffaf5",
  },
  scrollFlex: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: "row",
    backgroundColor: "#f8f1e8",
    borderTopWidth: 1,
    borderTopColor: "#e6d7c8",
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    paddingTop: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  bottomTabIcon: {
    fontSize: 20,
    color: "#a0928a",
  },
  bottomTabIconActive: {
    color: "#6f1d1b",
  },
  bottomTabLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a0928a",
  },
  bottomTabLabelActive: {
    color: "#6f1d1b",
  },
  statsSummaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ead8ca",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statsSummaryText: {
    color: "#6f1d1b",
    fontWeight: "600",
    fontSize: 14,
  },
  statsSummaryToggle: {
    color: "#6f1d1b",
    fontSize: 12,
  },
  statsGrid: {
    gap: 8,
  },
  statsGridRow: {
    flexDirection: "row",
    gap: 8,
  },
  storageCard: {
    backgroundColor: "#ead8ca",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  storageCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  storageCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputGroup: {
    gap: 6,
    flex: 1,
  },
  inputLabel: {
    color: "#6f6259",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fffaf5",
    color: "#231815",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  autocompleteList: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#e6d7c8",
    overflow: "hidden",
  },
  autocompleteItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f2e7db",
  },
  autocompleteText: {
    color: "#231815",
    fontSize: 15,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#6f1d1b",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fffaf5",
    fontWeight: "700",
    fontSize: 15,
  },
  imageButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    flex: 1,
  },
  secondaryButtonText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  authNotice: {
    color: "#6f1d1b",
    lineHeight: 21,
  },
  authFootnote: {
    color: "#6f6259",
    lineHeight: 21,
    fontSize: 13,
  },
  inlineLinkButton: {
    alignSelf: "flex-start",
  },
  panelHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
  },
  linkText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: "#fffaf5",
    fontSize: 22,
    fontWeight: "700",
  },
  metricLabel: {
    color: "#ead8ca",
    fontSize: 12,
  },
  insightCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 6,
  },
  importSuggestionCard: {
    borderRadius: 18,
    backgroundColor: "#fff6e7",
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#f4c38c",
  },
  importModeRow: {
    gap: 8,
  },
  quickImportButton: {
    backgroundColor: "#fffaf5",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  quickImportButtonActive: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  quickImportText: {
    color: "#6f1d1b",
    fontWeight: "700",
    textAlign: "center",
  },
  quickImportTextActive: {
    color: "#fffaf5",
  },
  importOptionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fffaf5",
  },
  importOptionRowActive: {
    backgroundColor: "#f4c38c",
  },
  importOptionText: {
    color: "#231815",
    fontWeight: "600",
  },
  importOptionState: {
    color: "#6f6259",
    fontWeight: "700",
  },
  importOptionTextActive: {
    color: "#5c1d1b",
  },
  insightValue: {
    color: "#231815",
    fontSize: 18,
    fontWeight: "700",
  },
  recommendationCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 10,
  },
  storageSpaceCard: {
    borderRadius: 18,
    backgroundColor: "#fffaf5",
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ead8ca",
  },
  recommendationHeader: {
    flexDirection: "row",
    gap: 12,
  },
  storageSpaceHeader: {
    flexDirection: "row",
    gap: 12,
  },
  recommendationName: {
    color: "#231815",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 2,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 12,
  },
  wineCard: {
    borderTopWidth: 1,
    borderTopColor: "#ead8ca",
    paddingTop: 16,
    gap: 12,
  },
  wineCardHighlighted: {
    backgroundColor: "#fff3e0",
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    borderColor: "#f4c38c",
  },
  wineImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 20,
    backgroundColor: "#ead8ca",
  },
  wineCardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  wineType: {
    color: "#6f1d1b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  wineName: {
    color: "#231815",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  wineMeta: {
    color: "#6f6259",
    marginTop: 4,
  },
  locationText: {
    color: "#6f1d1b",
    marginTop: 6,
    fontWeight: "600",
  },
  quantityBadge: {
    backgroundColor: "#ead8ca",
    alignSelf: "flex-start",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ratingBadge: {
    alignSelf: "flex-start",
  },
  ratingBadgeText: {
    fontSize: 18,
    color: "#f4c38c",
    letterSpacing: 2,
  },
  quantityBadgeText: {
    color: "#6f1d1b",
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  foodSection: {
    gap: 8,
  },
  tagPill: {
    backgroundColor: "#ead8ca",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  foodPill: {
    backgroundColor: "#f4c38c",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  foodPillActive: {
    backgroundColor: "#6f1d1b",
  },
  foodText: {
    color: "#5c1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  foodTextActive: {
    color: "#fffaf5",
  },
  foodCategoryGroup: {
    gap: 6,
  },
  foodCategoryLabel: {
    color: "#6f6259",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  mealSelectedLabel: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 14,
    backgroundColor: "#f4c38c",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  suggestionPill: {
    backgroundColor: "#fffaf5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e6d7c8",
  },
  suggestionPillActive: {
    backgroundColor: "#6f1d1b",
    borderColor: "#6f1d1b",
  },
  suggestionText: {
    color: "#6f1d1b",
    fontWeight: "700",
    fontSize: 12,
  },
  suggestionTextActive: {
    color: "#fffaf5",
  },
  notesText: {
    color: "#6f6259",
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dangerText: {
    color: "#9c3d31",
    fontWeight: "700",
  },
  emptyState: {
    color: "#6f6259",
    lineHeight: 21,
  },
  loadingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
