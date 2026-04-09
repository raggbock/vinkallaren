import { useState } from "react";
import { Alert, Platform } from "react-native";
import { showError } from "../lib/show-error";
import { useCameraPermissions } from "expo-camera";
import { cacheCatalogEntry, type ProductCatalogEntry } from "../lib/product-catalog";
import { mergeDraftWithCatalogSuggestion } from "../lib/wine-helpers";
import { defaultImportSelection, type WineDraft } from "../types/cellar-drafts";
import type { WineRecord } from "../types/wine";

type BarcodeScannerDeps = {
  sessionUserId: string;
  wines: WineRecord[];
  maybeSuggestCatalogMatch: (draft: WineDraft) => Promise<ProductCatalogEntry | null>;
};

export function useBarcodeScanner(deps: BarcodeScannerDeps) {
  const { sessionUserId, wines, maybeSuggestCatalogMatch } = deps;

  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  async function startBarcodeScanner() {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.protocol !== "https:") {
      showError("Skanning kräver säker anslutning", "På mobilwebb behöver kameraskanning vanligtvis https eller localhost.");
      return;
    }
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        showError("Behörighet saknas", "Ge appen kameratillgång för att kunna skanna streckkoder.");
        return;
      }
    }
    setScannerVisible(true);
  }

  async function handleBarcodeScanned(
    scannedData: string,
    draft: WineDraft,
    setDraft: React.Dispatch<React.SetStateAction<WineDraft>>,
  ) {
    setScannerVisible(false);
    const matchedWine = wines.find((wine) => wine.barcode === scannedData);
    setDraft((current) => {
      const nextDraft = { ...current, barcode: scannedData };
      if (!matchedWine) return nextDraft;
      return {
        ...nextDraft,
        name: current.name || matchedWine.name,
        producer: current.producer || matchedWine.producer || "",
        country: current.country || matchedWine.country || "",
        region: current.region || matchedWine.region || "",
        grape: current.grape || matchedWine.grape || "",
        type: current.type || matchedWine.type || "Rött",
        foodPairings: current.foodPairings || matchedWine.food_pairings.join(", "),
        systembolagetProductId: current.systembolagetProductId || matchedWine.systembolaget_product_id || "",
      };
    });
    const match = await maybeSuggestCatalogMatch({ ...draft, barcode: scannedData });
    if (matchedWine) {
      Alert.alert("Förifyllt från din källare", `Jag hittade ${matchedWine.name} med samma streckkod och fyllde i det som gick.`);
      return;
    }
    if (match) {
      await cacheCatalogEntry(match, sessionUserId);
      setDraft((current) => mergeDraftWithCatalogSuggestion(current, match, "empty", defaultImportSelection));
      Alert.alert("Produkt hittad", `Jag hittade ${match.name} från ${match.sourceLabel} och fyllde i tomma fält automatiskt.`);
      return;
    }
    Alert.alert("Ingen produktträff", "Streckkoden sparades. Fyll i vinets namn och detaljer nedan.");
  }

  return {
    scannerVisible, setScannerVisible,
    startBarcodeScanner, handleBarcodeScanned,
  };
}
