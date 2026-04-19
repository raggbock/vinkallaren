export type CellarStats = {
  totalBottles: number;
  totalLabels: number;
  averageVintage: string;
  topCountry: string;
  topType: string;
  topPairing: string;
};

export type CellarFilterOptions = {
  countries: string[];
  regions: string[];
  types: string[];
  vintages: string[];
  grapes: string[];
  pairings: string[];
};

export type CellarAggregate = {
  stats: CellarStats;
  bottleCountsBySpaceId: Record<string, number>;
  unplacedCount: number;
  filterOptions: CellarFilterOptions;
};

// Filter state as sent to the RPC. Keys are omitted when "Alla".
export type CellarFilterState = {
  country?: string;
  region?: string;
  type?: string;
  grape?: string;
  vintage?: string;
  pairing?: string;
  storage_space_id?: string;
};

export const EMPTY_AGGREGATE: CellarAggregate = {
  stats: {
    totalBottles: 0,
    totalLabels: 0,
    averageVintage: "-",
    topCountry: "Ingen data",
    topType: "Ingen data",
    topPairing: "Ingen data",
  },
  bottleCountsBySpaceId: {},
  unplacedCount: 0,
  filterOptions: {
    countries: [], regions: [], types: [], vintages: [], grapes: [], pairings: [],
  },
};
