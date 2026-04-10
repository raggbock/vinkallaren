import { createContext, useContext } from "react";
import type { WineRecord } from "../types/wine";
import type { StorageSpaceRow } from "../types/storage-space";

export type CellarContextValue = {
  userId: string;
  wines: WineRecord[];
  winesLoading: boolean;
  storageSpaces: StorageSpaceRow[];
  storageSpaceById: Map<string, StorageSpaceRow>;
  refreshWines: () => Promise<WineRecord[] | undefined>;
  fetchMoreWines: () => Promise<void>;
  hasMoreWines: boolean;
  setWines: React.Dispatch<React.SetStateAction<WineRecord[]>>;
  deleteWine: (id: string, imagePath?: string | null) => Promise<void>;
  storageSpaceBottleCounts: Map<string, number>;
  pairingOptions: string[];
  countryOptions: string[];
  regionOptions: string[];
  typeOptions: string[];
  vintageOptions: string[];
  cellarGrapeOptions: string[];
  stats: { total: number; countries: number; types: number; producers: number; grapes: number; oldestVintage: number | null; storageSpaces: number };
};

const CellarContext = createContext<CellarContextValue | null>(null);

export function useCellar(): CellarContextValue {
  const ctx = useContext(CellarContext);
  if (!ctx) throw new Error("useCellar must be used inside CellarProvider");
  return ctx;
}

export { CellarContext };
