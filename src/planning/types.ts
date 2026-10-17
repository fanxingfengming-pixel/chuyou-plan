export interface HotelCapabilities {
  version: number;
  provider: string;
  hotelFilters: Record<
    | "priceRange"
    | "overallRating"
    | "minRenovationYear"
    | "userScore"
    | "selectedDistricts"
    | "brandPreference"
    | "starLevel"
    | "reviewCount"
    | "facilities",
    boolean
  >;
}
export type Source = "mock" | "live";
export type SearchStatus =
  "idle" | "loading" | "success" | "empty" | "error" | "timeout";
export type TransportMode = "rail" | "flight" | "drive";
export interface Place {
  id: string;
  name: string;
  city: string;
  type: "景点" | "商圈";
  description: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  source: Source;
  image?: string;
  imageFallback?: boolean;
  imageSource?: string;
  officialUrl?: string;
  loadedFrom?: "catalog" | "search";
  checkedAt?: string;
}
export interface Hotel {
  queryContextSignature?: string;
  id: string;
  name: string;
  city: string;
  district: string;
  brand: string;
  image?: string;
  imageFallback?: boolean;
  imageSource?: string;
  price: number | null;
  address?: string;
  amapPoiId?: string;
  dataProvider?: "flyai" | "amap";
  overallRating: number | null;
  subwayDistance: number | null;
  renovationYear: number | null;
  starLevel: number | null;
  reviewCount: number | null;
  userScore: number | null;
  facilities: string[];
  lat: number | null;
  lng: number | null;
  coreDistance: number | null;
  reason: string;
  source: Source;
  bookingUrl?: string;
  starLabel?: string;
  platformHint?: string | null;
  ratingNote?: string;
  highlightLabel?: string;
  recommendationSource?: "agent" | "rules";
  rankingNotice?: string;
  queriedAt?: string;
}
export interface HotelFilters {
  priceRange: [number, number];
  minRenovationYear: number;
  overallRating: number;
  selectedDistricts: string[];
  starLevel: number;
  reviewCount: number;
  userScore: number;
  facilities: string[];
}
export interface TransportOption {
  queryContextSignature?: string;
  provider?: string;
  queriedAt?: string;
  mode: TransportMode;
  title: string;
  duration: string;
  priceLabel: string;
  reason: string;
  available: boolean;
  source: Source;
}
export interface RouteStop {
  id: string;
  kind: "place" | "meal";
  placeId?: string;
  name: string;
  period: "早上" | "中午" | "下午" | "晚上";
}
export interface RoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  source: Source;
  provider?: string;
  coordinateSystem?: "GCJ-02";
}
export type LocalRouteMode = "walking" | "transit" | "driving";
export interface RouteLeg {
  id: string;
  from: RoutePoint;
  to: RoutePoint;
  status: "ready" | "error";
  mode: LocalRouteMode | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  polylines: { lat: number; lng: number }[][];
  instructions: string[];
  source: Source;
  provider: string;
  queriedAt: string;
  error: string;
  recommendation: string;
  geometrySource: string | null;
  tool?: string;
}
export interface RouteDay {
  day: number;
  stops: RouteStop[];
  legs?: RouteLeg[];
}
export interface RouteDraft {
  schemaVersion?: 21;
  querySignature?: string;
  status?: "idle" | "loading" | "ready" | "partial" | "error" | "needs-hotel";
  error?: string;
  hotelAnchor?: RoutePoint | null;
  hotelChoices?: Hotel[];
  days: RouteDay[];
  needsOptimization: boolean;
  generatedAt: string;
}
export interface PackingItem {
  id: string;
  name: string;
  note: string;
  packed: boolean;
  customized?: boolean;
  origin: "suggested" | "custom";
}
export interface TripDraft {
  version: 2;
  parsedPrompt: string;
  rawPrompt: string;
  parseSource?: "mock" | "live";
  originCity: string;
  destinationCity: string;
  dateMode: "exact" | "fuzzy" | "range";
  departureDate: string;
  returnDate: string;
  fuzzyDateText: string;
  tripDays: number;
  adults: number;
  children: number;
  planningMode: "area" | "hotel" | null;
  selectedPlaces: Place[];
  primaryPlace: Place | null;
  recommendedDistricts: string[];
  brandPreference: string[];
  intercityTransportPreference: string;
  selectedTransportMode: TransportMode | null;
  transportOptions: TransportOption[];
  hotelFilters: HotelFilters;
  hotelSearchStatus: SearchStatus;
  hotelSearchError: string;
  hotelResults: Hotel[];
  hotelCandidateIds: string[];
  memoCompletedAt: string;
  compareHotelIds: string[];
  selectedHotel: Hotel | null;
  tripPlaces: Place[];
  corePlaceDecisions: Record<string, "included" | "excluded">;
  packingItems: PackingItem[];
  suppressedPackingIds: string[];
  localTransportPreference: string;
  routeDraft: RouteDraft | null;
  lastUpdatedAt: string;
  lastRoute: string;
}
export interface HotelSearchPayload extends HotelFilters {
  destinationCity: string;
  originCity: string;
  dateMode: TripDraft["dateMode"];
  departureDate: string;
  returnDate: string;
  fuzzyDateText: string;
  tripDays: number;
  adults: number;
  children: number;
  selectedPlaces: Place[];
  primaryPlace: Place | null;
  recommendedDistricts: string[];
  brandPreference: string[];
  selectedTransportMode: TransportMode | null;
}
export interface Catalog {
  cities: Record<
    string,
    {
      country: string;
      priceRange: [number, number];
      brands: string[];
      places: Place[];
      hotels: Hotel[];
    }
  >;
}
