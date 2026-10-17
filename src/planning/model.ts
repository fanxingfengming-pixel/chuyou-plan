import { detailsIssue } from "../../shared/trip-validation.js";
import { hotelContextSignature, transportContextSignature } from "./queryContext";
import { validateServiceResult } from "./contracts";
import type { HotelFilters, TripDraft } from "./types";
export const STORAGE_KEY = "tripDraft";
export const defaultHotelFilters = (city = ""): HotelFilters => ({
  priceRange: /东京|大阪|京都|巴黎|伦敦|新加坡/.test(city)
    ? [600, 1800]
    : /北京|上海|深圳/.test(city)
      ? [400, 1000]
      : [400, 800],
  minRenovationYear: 0,
  overallRating: 0,
  selectedDistricts: [],
  starLevel: 0,
  reviewCount: 0,
  userScore: 0,
  facilities: [],
});
// D-12: retire the filter while preserving optional Hotel location facts.
export function withoutSubwayFilter(filters: HotelFilters): HotelFilters {
  const { subwayDistance: _retired, ...active } = filters as HotelFilters & {
    subwayDistance?: unknown;
  };
  return active;
}
export const initialDraft = (): TripDraft => ({
  version: 2,
  parsedPrompt: "",
  rawPrompt: "",
  originCity: "",
  destinationCity: "",
  dateMode: "fuzzy",
  departureDate: "",
  returnDate: "",
  fuzzyDateText: "",
  tripDays: 0,
  adults: 1,
  children: 0,
  planningMode: null,
  selectedPlaces: [],
  primaryPlace: null,
  recommendedDistricts: [],
  brandPreference: [],
  intercityTransportPreference: "均衡",
  selectedTransportMode: null,
  transportOptions: [],
  hotelFilters: defaultHotelFilters(),
  hotelSearchStatus: "idle",
  hotelSearchError: "",
  hotelResults: [],
  hotelCandidateIds: [],
  memoCompletedAt: "",
  compareHotelIds: [],
  selectedHotel: null,
  tripPlaces: [],
  corePlaceDecisions: {},
  packingItems: [],
  suppressedPackingIds: [],
  localTransportPreference: "",
  routeDraft: null,
  lastUpdatedAt: "",
  lastRoute: "/plan/details",
});
export function updateDraft(
  state: TripDraft,
  patch: Partial<TripDraft>,
): TripDraft {
  let next = { ...state, ...patch };
  if ("subwayDistance" in next.hotelFilters)
    next.hotelFilters = withoutSubwayFilter(next.hotelFilters);
  const bookingDetailsChanged = (
    [
      "originCity",
      "dateMode",
      "departureDate",
      "returnDate",
      "fuzzyDateText",
      "tripDays",
      "adults",
      "children",
    ] as const
  ).some((key) => patch[key] !== undefined && patch[key] !== state[key]);
  if (transportContextSignature(next) !== transportContextSignature(state)) next.transportOptions = [];
  if (bookingDetailsChanged) {
    next.hotelSearchStatus = "idle";
    next.hotelSearchError = "";
    next.hotelResults = [];
    next.hotelCandidateIds = [];
    next.compareHotelIds = [];
  }
  if (
    patch.destinationCity !== undefined &&
    patch.destinationCity.trim() !== state.destinationCity
  ) {
    next = {
      ...next,
      destinationCity: patch.destinationCity.trim(),
      selectedPlaces: [],
      primaryPlace: null,
      recommendedDistricts: [],
      brandPreference: [],
      transportOptions: [],
      selectedTransportMode: null,
      intercityTransportPreference: "均衡",
      hotelFilters: defaultHotelFilters(patch.destinationCity),
      hotelSearchStatus: "idle",
      hotelSearchError: "",
      hotelResults: [],
      hotelCandidateIds: [],
      memoCompletedAt: "",
      compareHotelIds: [],
      selectedHotel: null,
      tripPlaces: [],
      corePlaceDecisions: {},
      packingItems: state.packingItems,
      localTransportPreference: "",
      routeDraft: null,
    };
  } else {
    if (patch.planningMode && patch.planningMode !== state.planningMode) {
      next = {
        ...next,
        selectedPlaces: [],
        primaryPlace: null,
        recommendedDistricts: [],
        brandPreference: [],
        hotelFilters: { ...state.hotelFilters, selectedDistricts: [] },
        hotelResults: [],
        hotelCandidateIds: [],
        compareHotelIds: [],
        hotelSearchStatus: "idle",
      };
    }
    if (
      patch.hotelFilters ||
      patch.brandPreference ||
      patch.primaryPlace !== undefined ||
      patch.selectedPlaces ||
      patch.selectedTransportMode !== undefined
    ) {
      next.hotelSearchStatus = "idle";
      next.hotelResults = [];
      next.compareHotelIds = [];
    }
    if (
      (patch.selectedHotel !== undefined &&
        patch.selectedHotel?.id !== state.selectedHotel?.id) ||
      patch.tripPlaces ||
      patch.localTransportPreference !== undefined ||
      patch.tripDays !== undefined
    )
      if (!("routeDraft" in patch)) next.routeDraft = null;
    if (
      patch.originCity !== undefined &&
      patch.originCity !== state.originCity
    ) {
      next.transportOptions = [];
      // The selected travel mode remains a user choice; only query references expire.
    }
  }

  if (patch.tripPlaces && next.destinationCity === state.destinationCity) {
    next.corePlaceDecisions = { ...next.corePlaceDecisions };
    for (const id of Object.keys(next.corePlaceDecisions)) {
      if (
        state.tripPlaces.some((p) => p.id === id) &&
        !next.tripPlaces.some((p) => p.id === id)
      )
        next.corePlaceDecisions[id] = "excluded";
      if (next.tripPlaces.some((p) => p.id === id))
        next.corePlaceDecisions[id] = "included";
    }
  }
  if (
    patch.routeDraft !== undefined ||
    next.routeDraft !== state.routeDraft ||
    bookingDetailsChanged
  )
    next.memoCompletedAt = "";
  if (patch.hotelResults && !patch.hotelCandidateIds)
    next.hotelCandidateIds = patch.hotelResults.slice(0, 6).map((h) => h.id);
  next.hotelCandidateIds = [...new Set(next.hotelCandidateIds || [])]
    .filter((id) => next.hotelResults.some((h) => h.id === id))
    .slice(0, 6);
  next.selectedPlaces = next.selectedPlaces.slice(0, 3);
  if (
    next.primaryPlace &&
    !next.selectedPlaces.some((p) => p.id === next.primaryPlace?.id)
  )
    next.primaryPlace = null;
  next.compareHotelIds = [...new Set(next.compareHotelIds)]
    .filter((id) => next.hotelResults.some((h) => h.id === id))
    .slice(0, 3);
  return { ...next, lastUpdatedAt: new Date().toISOString() };
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export function restoreDraft(raw: string | null): TripDraft {
  const base = initialDraft();
  try {
    const saved: unknown = JSON.parse(raw || "null");
    if (!record(saved) || saved.version !== 2) return base;
    // Reject malformed stored data rather than let it crash the UI. Storage is untrusted input.
    const strings = [
      "rawPrompt",
      "originCity",
      "destinationCity",
      "departureDate",
      "returnDate",
      "fuzzyDateText",
      "lastRoute",
      "localTransportPreference",
      "hotelSearchError",
      "intercityTransportPreference",
      "lastUpdatedAt",
    ];
    if (strings.some((k) => typeof saved[k] !== "string")) return base;
    if (
      !["exact", "fuzzy", "range"].includes(String(saved.dateMode)) ||
      ![null, "area", "hotel"].includes(saved.planningMode as string | null) ||
      ![null, "rail", "flight", "drive"].includes(
        saved.selectedTransportMode as string | null,
      )
    )
      return base;
    if (
      ["tripDays", "adults", "children"].some(
        (k) =>
          !Number.isInteger(saved[k]) ||
          Number(saved[k]) < 0 ||
          Number(saved[k]) > 60,
      )
    )
      return base;
    const placesValid = (v: unknown) =>
      Array.isArray(v) &&
      v.every(
        (p) =>
          record(p) &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.district === "string" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      );
    const hotelsValid = (v: unknown) =>
      Array.isArray(v) &&
      v.every(
        (h) =>
          record(h) &&
          typeof h.id === "string" &&
          typeof h.name === "string" &&
          typeof h.city === "string" &&
          [
            "price",
            "overallRating",
            "subwayDistance",
            "renovationYear",
            "starLevel",
            "reviewCount",
            "userScore",
            "lat",
            "lng",
          ].every((k) =>
            k === "price"
              ? h[k] === null || Number.isFinite(h[k])
              : h[k] === null || Number.isFinite(h[k]),
          ) &&
          Array.isArray(h.facilities) &&
          h.facilities.every((x) => typeof x === "string"),
      );
    if (
      !placesValid(saved.selectedPlaces) ||
      !placesValid(saved.tripPlaces) ||
      !hotelsValid(saved.hotelResults)
    )
      return base;
    if (saved.selectedHotel !== null && !hotelsValid([saved.selectedHotel]))
      return base;
    if (saved.primaryPlace !== null && !placesValid([saved.primaryPlace]))
      return base;
    if (
      ["brandPreference", "recommendedDistricts", "compareHotelIds"].some(
        (k) =>
          !Array.isArray(saved[k]) ||
          !(saved[k] as unknown[]).every((x) => typeof x === "string"),
      )
    )
      return base;
    if (
      !Array.isArray(saved.transportOptions) ||
      !saved.transportOptions.every(
        (o) =>
          record(o) &&
          ["rail", "flight", "drive"].includes(String(o.mode)) &&
          typeof o.title === "string" &&
          typeof o.reason === "string",
      ) ||
      !record(saved.hotelFilters)
    )
      return base;
    if (
      !["idle", "loading", "success", "empty", "error", "timeout"].includes(
        String(saved.hotelSearchStatus),
      )
    )
      return base;
    const f = saved.hotelFilters;
    if (
      !Array.isArray(f.priceRange) ||
      f.priceRange.length !== 2 ||
      !f.priceRange.every(Number.isFinite) ||
      !Array.isArray(f.facilities) ||
      !Array.isArray(f.selectedDistricts) ||
      [
        "minRenovationYear",
        "overallRating",
        "starLevel",
        "reviewCount",
        "userScore",
      ].some((k) => !Number.isFinite(f[k]))
    )
      return base;
    if (
      saved.routeDraft !== null &&
      (!record(saved.routeDraft) ||
        !Array.isArray(saved.routeDraft.days) ||
        !saved.routeDraft.days.every(
          (d) =>
            record(d) &&
            Number.isInteger(d.day) &&
            Array.isArray(d.stops) &&
            d.stops.every(
              (s) =>
                record(s) &&
                typeof s.id === "string" &&
                typeof s.name === "string" &&
                ["早上", "中午", "下午", "晚上"].includes(String(s.period)),
            ),
        ))
    )
      return base;
    const result = { ...base, ...saved } as TripDraft;
    result.hotelFilters = withoutSubwayFilter(result.hotelFilters);
    result.hotelResults = result.hotelResults.filter(h => h.queryContextSignature === hotelContextSignature(result));
    result.compareHotelIds = result.compareHotelIds.filter(id => result.hotelResults.some(h => h.id === id));
    result.transportOptions = result.transportOptions.filter(o => o.queryContextSignature === transportContextSignature(result));
    if (!result.hotelResults.length && result.hotelSearchStatus === "success") result.hotelSearchStatus = "idle";

    result.corePlaceDecisions = record(saved.corePlaceDecisions)
      ? (Object.fromEntries(
          Object.entries(saved.corePlaceDecisions).filter(
            ([key, v]) =>
              key.length < 100 && ["included", "excluded"].includes(String(v)),
          ),
        ) as TripDraft["corePlaceDecisions"])
      : {};
    result.packingItems = Array.isArray(saved.packingItems)
      ? saved.packingItems
          .filter(
            (p): p is TripDraft["packingItems"][number] =>
              record(p) &&
              typeof p.id === "string" &&
              typeof p.name === "string" &&
              p.name.length <= 80 &&
              typeof p.note === "string" &&
              p.note.length <= 300 &&
              typeof p.packed === "boolean" &&
              ["suggested", "custom"].includes(String(p.origin)),
          )
          .slice(0, 300)
      : [];
    result.suppressedPackingIds = Array.isArray(saved.suppressedPackingIds)
      ? saved.suppressedPackingIds
          .filter((x): x is string => typeof x === "string" && x.length < 100)
          .slice(0, 300)
      : [];
    result.hotelCandidateIds = Array.isArray(saved.hotelCandidateIds)
      ? [...new Set(saved.hotelCandidateIds)]
          .filter(
            (id): id is string =>
              typeof id === "string" &&
              result.hotelResults.some((h) => h.id === id),
          )
          .slice(0, 6)
      : result.hotelResults.slice(0, 6).map((h) => h.id);
    result.memoCompletedAt =
      typeof saved.memoCompletedAt === "string" ? saved.memoCompletedAt : "";
    if (result.routeDraft) {
      const route = result.routeDraft;
      if (
        route.schemaVersion !== 21 ||
        !["idle", "ready", "partial", "error", "needs-hotel"].includes(
          route.status || "",
        )
      ) {
        result.routeDraft = {
          ...route,
          schemaVersion: 21,
          status: "idle",
          error: "旧路线或中断请求需要重新通过高德核实。",
          days: route.days.map((d) => ({ ...d, legs: [] })),
        };
        result.memoCompletedAt = "";
      } else {
        try {
          validateServiceResult("amap/route", route);
        } catch {
          result.routeDraft = {
            ...route,
            status: "idle",
            days: route.days.map((d) => ({ ...d, legs: [] })),
          };
          result.memoCompletedAt = "";
        }
      }
    }
    result.selectedPlaces = result.selectedPlaces.slice(0, 3);
    result.compareHotelIds = [...new Set(result.compareHotelIds)]
      .filter((id) => result.hotelResults.some((h) => h.id === id))
      .slice(0, 3);
    if (
      !/^\/plan\/(?:details|mode|transport|area|hotel-preference|hotels|results|compare|places|local-transport|route|memo)$/.test(
        result.lastRoute,
      )
    )
      result.lastRoute = "/plan/details";
    if (["loading", "timeout"].includes(result.hotelSearchStatus)) {
      result.hotelSearchStatus = "idle";
      result.hotelSearchError = "上次搜索已中断，请重新搜索。";
    }
    return result;
  } catch {
    return base;
  }
}
export function validateDetails(d: TripDraft): string { return detailsIssue(d)?.message || ""; }

export function ensureCorePlace(d: TripDraft): Partial<TripDraft> | null {
  const core = d.primaryPlace;
  if (!core || d.corePlaceDecisions[core.id] === "excluded") return null;
  const exists = d.tripPlaces.some((p) => p.id === core.id);
  if (exists && d.corePlaceDecisions[core.id] === "included") return null;
  return {
    ...(!exists ? { tripPlaces: [core, ...d.tripPlaces] } : {}),
    corePlaceDecisions: { ...d.corePlaceDecisions, [core.id]: "included" },
  };
}
