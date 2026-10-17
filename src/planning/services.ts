import { stampHotels, transportContextSignature } from "./queryContext";
import { liveDateError } from "../../shared/trip-validation.js";
import { HOTEL_BRANDS, matchesHotelBrand } from "../../shared/hotel-brands.js";
import { priceBounds } from "../../shared/price-bounds.js";
import { validateServiceResult, safeMediaUrl } from "./contracts";
import { apiBase, requestJSON, publishProgress } from "./serviceClient";
export { isLiveMode } from "./serviceClient";
import { getHotelHighlights } from "../../shared/hotel-ranking.js";
import type {
  Catalog,
  Hotel,
  HotelSearchPayload,
  Place,
  RouteDraft,
  TransportOption,
  TripDraft,
} from "./types";
async function catalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch("/mock/v2/catalog.json", {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("模拟目录暂时无法读取，请重试。");
  const data = await response.json();
  if (!data.cities || typeof data.cities !== "object")
    throw new Error("目录格式不正确。");
  return data as Catalog;
}
async function remote<T>(
  service: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return validateServiceResult(
    service,
    await requestJSON(service, payload, signal, (p) =>
      publishProgress({ ...p, operation: service }),
    ),
  ) as T;
}

export function normalizeCity(city: string) {
  return city.trim().replace(/市$/, "");
}
const numberCN = (s: string) =>
  /^\d+$/.test(s)
    ? Number(s)
    : {
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
      }[s] || 0;
export async function parseTripPrompt(
  input: string,
): Promise<Partial<TripDraft>> {
  if (apiBase) return remote("parse-trip", { prompt: input });
  const text = input.trim(),
    data = await catalog(),
    cities = Object.keys(data.cities).concat([
      "武汉",
      "南京",
      "苏州",
      "西安",
      "重庆",
      "香港",
      "澳门",
      "伦敦",
      "巴黎",
      "新加坡",
      "大阪",
      "京都",
    ]);
  const origin = text.match(
    /从([\u4e00-\u9fa5A-Za-z]{2,12}?)(?:出发)?(?:去|到|飞往|前往)/,
  )?.[1];
  const destination = text.match(
    /(?:去|到|飞往|前往)([\u4e00-\u9fa5A-Za-z]{2,12}?)(?:玩|游玩|旅游|旅行|住|[，,。\s\d]|$)/,
  )?.[1];
  const city = destination
    ? cities.find((c) => destination.startsWith(c)) || destination
    : cities.find((c) => text.includes(c) && c !== origin);
  const days = text.match(/([\d一二两三四五六七八九十]+)\s*天/);
  const adults = text.match(
    /([\d一二两三四五六七八九十]+)\s*(?:个?成人|位成人|位大人|个?大人)/,
  );
  const children = text.match(
    /([\d一二两三四五六七八九十]+)\s*(?:个?儿童|个?孩子|个?小孩)/,
  );
  const people = text.match(/([\d一二两三四五六七八九十]+)\s*(?:个人|人)/);
  const dates = [
    ...text.matchAll(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})日?/g),
  ].map(
    (m) => m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0"),
  );
  const fuzzy =
    text.match(
      /(?:\d{1,2}月(?:上旬|中旬|下旬|初|底)?|国庆期间|国庆|春节|暑假|寒假|下个月|下周|周末)/,
    )?.[0] || "";
  const patch: Partial<TripDraft> = {
    rawPrompt: text,
    originCity: origin || "",
    destinationCity: city || "",
    tripDays: days ? numberCN(days[1]) : 0,
    adults: adults
      ? numberCN(adults[1])
      : people
        ? Math.max(
            1,
            numberCN(people[1]) - (children ? numberCN(children[1]) : 0),
          )
        : 1,
    children: children ? numberCN(children[1]) : 0,
    dateMode: dates.length > 1 ? "range" : dates.length ? "exact" : "fuzzy",
    departureDate: dates[0] || "",
    returnDate: dates[1] || "",
    fuzzyDateText: fuzzy,
  };
  if (dates.length > 1)
    patch.tripDays =
      Math.round((Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000) + 1;
  return patch;
}
export async function getCityCatalog(city: string, signal?: AbortSignal) {
  return (await catalog(signal)).cities[normalizeCity(city)];
}
export async function searchPlaceWithAmapMCP(
  query: string,
  city: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (apiBase) return remote("amap/search-place", { query, city }, signal);
  const config = await getCityCatalog(city, signal);
  // No invented coordinates for arbitrary input. A missing mock POI stays unresolved.
  return (
    config?.places.filter(
      (p) =>
        p.name.includes(query.trim()) || p.description.includes(query.trim()),
    ) || []
  );
}
export async function resolveDistrictWithAmapMCP(
  place: Place,
  signal?: AbortSignal,
): Promise<string[]> {
  if (apiBase) return remote("amap/resolve-district", { place }, signal);
  const known = (await getCityCatalog(place.city, signal))?.places.find(
    (p) => p.id === place.id,
  );
  return known ? [known.district] : [];
}
export async function getAreaRecommendations(
  city: string,
  signal?: AbortSignal,
  refresh = false,
): Promise<Place[]> {
  const known = readPrefetchedArea(city);
  if (known && !refresh) return known;
  if (apiBase) {
    const places = await remote<Place[]>(
      "area-recommendations",
      { city, refresh },
      signal,
    );
    if (!signal?.aborted && places.length)
      areaMemory.set(normalizeCity(city), places);
    return places;
  }
  return (await getCityCatalog(city, signal))?.places.slice(0, 6) || [];
}
export async function getHotelBrands(
  city: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (apiBase) return remote("hotel-brands", { city }, signal);
  return [...HOTEL_BRANDS];
}
export async function searchRailOptions(
  d: TripDraft,
  signal?: AbortSignal,
): Promise<TransportOption> {
  if (apiBase) return remote("rail/search", d, signal);
  const city = await getCityCatalog(d.destinationCity, signal);
  const domestic = city?.country === "CN";
  return {
    mode: "rail",
    title: "高铁 / 火车",
    duration: domestic ? "约 4–10 小时（模拟）" : "跨境铁路待查询",
    priceLabel: domestic ? "¥300–800 / 人（模拟）" : "待查询",
    reason: domestic
      ? "市区到市区，携带行李更从容；具体时长需按城市对查询。"
      : "当前模拟目录没有适用的跨境铁路方案。",
    available: domestic,
    source: "mock",
  };
}
export async function searchFlightOptions(
  d: TripDraft,
  signal?: AbortSignal,
): Promise<TransportOption> {
  if (apiBase) return remote("flight/search", d, signal);
  await catalog(signal);
  return {
    mode: "flight",
    title: "飞机",
    duration: "约 2–5 小时飞行（模拟）",
    priceLabel: "¥600–2,000 / 人（模拟）",
    reason: "长距离出行可优先比较，另需考虑机场往返和候机时间。",
    available: true,
    source: "mock",
  };
}
export async function compareTransportOptions(
  d: TripDraft,
  signal?: AbortSignal,
) {
  if (apiBase) {
    const error=liveDateError(d);if(error) throw new Error(error);
    const signature=transportContextSignature(d);
    const result=await remote<{options:TransportOption[];summary:string}>("transport/compare",d,signal);
    return {...result,options:result.options.map(o=>({...o,queryContextSignature:signature}))};
  }
  const [rail, flight, city] = await Promise.all([
    searchRailOptions(d, signal),
    searchFlightOptions(d, signal),
    getCityCatalog(d.destinationCity, signal),
  ]);
  const drive: TransportOption = {
    mode: "drive",
    title: "自驾",
    duration: "按实际距离确认",
    priceLabel: "油费、过路费待确认",
    reason: "适合途中停留与多人出行；跨境不适用此模拟方案。",
    available: city?.country === "CN",
    source: "mock",
  };
  return {
    options: [rail, flight, drive].map(o=>({...o,queryContextSignature:transportContextSignature(d),queriedAt:new Date().toISOString(),provider:"显式模拟目录"})),
    summary:
      d.intercityTransportPreference === "省时" || !rail.available
        ? "模拟比较：可先考虑飞机，再核对机场接驳与实际票价。"
        : "模拟比较：可先考虑高铁 / 火车，再核对两地真实班次和时长。",
  };
}
export function distanceKm(
  a: { lat: number | null; lng: number | null },
  b: { lat: number | null; lng: number | null },
) {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null)
    return null;
  const r = Math.PI / 180,
    lat = (b.lat - a.lat) * r,
    lng = (b.lng - a.lng) * r;
  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(lat / 2) ** 2 +
          Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(lng / 2) ** 2,
      ),
      Math.sqrt(
        1 -
          (Math.sin(lat / 2) ** 2 +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(lng / 2) ** 2),
      ),
    )
  );
}
export function filterHotelCatalog(hotels: Hotel[], p: HotelSearchPayload) {
  const bounds = priceBounds(p.priceRange);
  return hotels
    .filter(
      (h) =>
        (h.price ?? -1) >= bounds.min &&
        (h.price ?? Infinity) <= bounds.max &&
        (h.overallRating ?? -1) >= p.overallRating &&
        (h.renovationYear ?? -1) >= p.minRenovationYear &&
        (h.starLevel ?? -1) >= p.starLevel &&
        (h.reviewCount ?? -1) >= p.reviewCount &&
        (h.userScore ?? -1) >= p.userScore &&
        (!p.selectedDistricts.length ||
          p.selectedDistricts.includes(h.district)) &&
        matchesHotelBrand(h, p.brandPreference) &&
        p.facilities.every((f) => h.facilities.includes(f)),
    )
    .map((h) => ({
      ...h,
      coreDistance: p.primaryPlace
        ? Math.round((distanceKm(h, p.primaryPlace) ?? 0) * 10) / 10
        : null,
    }));
}
export async function searchHotelsWithFlyAI(
  payload: HotelSearchPayload,
  signal?: AbortSignal,
): Promise<Hotel[]> {
  if(apiBase){const error=liveDateError(payload);if(error)throw new Error(error);}
  const result:Hotel[]=apiBase ? await remote("flyai/search-hotels",payload,signal) : filterHotelCatalog((await getCityCatalog(payload.destinationCity,signal))?.hotels || [],payload);
  return stampHotels(result,payload);
}
export async function recommendTripPlaces(
  d: TripDraft,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (apiBase) return remote("recommend-places", d, signal);
  const places =
    (await getCityCatalog(d.destinationCity, signal))?.places || [];
  return places
    .filter((p) => !d.tripPlaces.some((x) => x.id === p.id))
    .sort((a, b) => {
      const preferred = (p: Place) =>
        (d.rawPrompt.includes("博物馆") && p.description.includes("博物")
          ? -100
          : 0) + (d.primaryPlace?.id === p.id ? -50 : 0);
      return (
        preferred(a) -
        preferred(b) +
        (d.selectedHotel
          ? (distanceKm(a, d.selectedHotel) ?? Infinity) -
            (distanceKm(b, d.selectedHotel) ?? Infinity)
          : 0)
      );
    })
    .slice(0, Math.max(2, Math.min(d.tripDays, 4)));
}
export function getBookingUrl(hotel: Hotel) {
  if (hotel.bookingUrl) {
    try {
      const u = new URL(hotel.bookingUrl);
      if (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        (u.hostname === "fliggy.com" ||
          u.hostname.endsWith(".fliggy.com") ||
          u.hostname === "feizhu.com" ||
          u.hostname.endsWith(".feizhu.com") ||
          u.hostname === "alitrip.com" ||
          u.hostname.endsWith(".alitrip.com"))
      )
        return u.href;
    } catch {
      /* safe fallback */
    }
  }
  return hotel.source === "mock" ? "https://www.fliggy.com/" : undefined;
}
export function selectHighlights(items: Hotel[]) {
  if (items.some((h) => h.source === "live"))
    return getHotelHighlights(
      items,
      items.find(
        (h) =>
          h.recommendationSource === "agent" && h.highlightLabel === "综合推荐",
      )?.id,
    );
  const used = new Set<string>(),
    result: { hotel: Hotel; label: string; reason: string }[] = [];
  const take = (sorted: Hotel[], label: string, reason: string) => {
    const hotel = sorted.find((h) => !used.has(h.id));
    if (hotel) {
      used.add(hotel.id);
      result.push({ hotel, label, reason });
    }
  };
  take(
    [...items].sort(
      (a, b) =>
        (b.overallRating ?? 0) +
        (b.userScore ?? 0) -
        (b.price ?? 0) / 2000 -
        ((a.overallRating ?? 0) + (a.userScore ?? 0) - (a.price ?? 0) / 2000),
    ),
    "最推荐",
    "综合评分、用户评价与价格之间更均衡。",
  );
  take(
    [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
    "最划算",
    "在符合当前条件的酒店中，每晚价格更低。",
  );
  take(
    [...items].sort(
      (a, b) =>
        (a.coreDistance ?? (a.subwayDistance ?? Infinity) / 1000) -
        (b.coreDistance ?? (b.subwayDistance ?? Infinity) / 1000),
    ),
    items.some((h) => h.coreDistance !== null || h.subwayDistance !== null)
      ? "位置最好"
      : "备选参考",
    items.some((h) => h.coreDistance !== null || h.subwayDistance !== null)
      ? "在剩余候选中，优先靠近核心地点或地铁。"
      : "位置资料尚不完整，可在飞猪进一步核对。",
  );
  return result;
}
export interface RouteEditIntent {
  operation: "move" | "delete" | "replace";
  placeId: string;
  day: number | null;
  replacementQuery: string;
}
export async function interpretRouteEdit(
  instruction: string,
  draft: TripDraft,
): Promise<RouteEditIntent> {
  return remote("route/edit-intent", { instruction, draft });
}
export async function getRelaxationAdvice(
  filters: TripDraft["hotelFilters"],
  signal?: AbortSignal,
): Promise<{ summary: string }> {
  return remote("hotels/relaxation-advice", { filters }, signal);
}

const areaMemory = new Map<string, Place[]>();
const areaPending = new Map<string, Promise<Place[]>>();
export function readPrefetchedArea(city: string) {
  return areaMemory.get(normalizeCity(city));
}
export async function prefetchKnownArea(city: string) {
  const key = normalizeCity(city);
  if (!key || areaMemory.has(key)) return;
  if (areaPending.has(key)) return areaPending.get(key);
  const task = (
    apiBase
      ? remote<Place[]>("area-recommendations", {
          city: key,
          catalogOnly: true,
        })
      : getAreaRecommendations(key)
  )
    .then((places) => {
      if (places.length) {
        areaMemory.set(key, places);
        preloadPlaceImages(places);
      }
      return places;
    })
    .finally(() => areaPending.delete(key));
  areaPending.set(key, task);
  return task;
}
export async function preloadPlaceImages(places: Place[]) {
  await Promise.all(
    places.map(
      (p) =>
        new Promise<void>((resolve) => {
          const src = safeMediaUrl(p.image);
          if (!src || typeof Image === "undefined") {
            resolve();
            return;
          }
          const img = new Image();
          const timer = setTimeout(resolve, 5000);
          const finish = () => {
            clearTimeout(timer);
            resolve();
          };
          img.onload = finish;
          img.onerror = finish;
          img.src = src;
        }),
    ),
  );
}

export async function searchNamedHotel(
  query: string,
  draft: TripDraft,
  signal?: AbortSignal,
  provider?: "amap",
): Promise<{ hotels: Hotel[]; provider: "flyai" | "amap"; notice: string }> {
  if(apiBase && provider!=="amap"){const error=liveDateError(draft);if(error)throw new Error(error);}
  const result:{hotels:Hotel[];provider:"flyai"|"amap";notice:string}=apiBase
    ? await remote("hotels/search-name",{query,trip:{destinationCity:draft.destinationCity,dateMode:draft.dateMode,departureDate:draft.departureDate,returnDate:draft.returnDate,tripDays:draft.tripDays,adults:draft.adults,children:draft.children},provider},signal)
    : {hotels:((await getCityCatalog(draft.destinationCity,signal))?.hotels || []).filter(h=>h.name.includes(query.trim())),provider:"flyai",notice:"显式模拟酒店搜索，非实时结果。"};
  return {...result,hotels:stampHotels(result.hotels,draft)};
}
export async function calculateRealRoute(
  draft: TripDraft,
  signal: AbortSignal,
): Promise<RouteDraft> {
  const route = draft.routeDraft!;
  if (apiBase)
    return remote(
      "amap/route",
      {
        city: draft.destinationCity,
        hotel: {
          id: draft.selectedHotel?.id,
          name: draft.selectedHotel?.name,
          amapPoiId: draft.selectedHotel?.amapPoiId,
        },
        places: draft.tripPlaces.map((p) => ({ id: p.id })),
        days: route.days.map((d) => ({ day: d.day, stops: d.stops })),
        preference: draft.localTransportPreference,
      },
      signal,
    );
  const anchor = {
    id: draft.selectedHotel!.id,
    name: draft.selectedHotel!.name,
    lat: draft.selectedHotel!.lat ?? 0,
    lng: draft.selectedHotel!.lng ?? 0,
    source: "mock" as const,
  };
  return {
    ...route,
    schemaVersion: 21,
    status: "ready",
    hotelAnchor: anchor,
    error: "",
    days: route.days.map((day) => {
      const points = day.stops
          .filter((s) => s.kind === "place")
          .map((s) => draft.tripPlaces.find((p) => p.id === s.placeId)!)
          .filter(Boolean),
        nodes = points.length ? [anchor, ...points, anchor] : [];
      return {
        ...day,
        legs: nodes
          .slice(0, -1)
          .map((from, i) => ({
            id: from.id + ">" + nodes[i + 1].id,
            from,
            to: nodes[i + 1],
            mode: "walking" as const,
            status: "ready" as const,
            distanceMeters: 800,
            durationSeconds: 600,
            polylines: [],
            instructions: ["显式模拟路线，不可用于实际出行"],
            source: "mock" as const,
            provider: "显式模拟",
            queriedAt: new Date().toISOString(),
            error: "",
            recommendation: "模拟结果",
            geometrySource: null,
          })),
      };
    }),
  };
}
