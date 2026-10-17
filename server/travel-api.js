import { HOTEL_BRANDS } from "../shared/hotel-brands.js";
import { planRealRoute, searchHotelPois } from "./route-planning.js";
import { getPlaceCatalog, sharePlaceQuery } from "./place-catalog.js";
import { AppError } from "./errors.js";
import { assertSupportedFilters } from "./capabilities.js";
import {
  getHotelHighlights,
  factHotelReason,
} from "../shared/hotel-ranking.js";
import { parseTripWithAgent, runAgentTask } from "./agent-tasks.js";
import { searchPlaces, getPlaceDetail } from "./mcp.js";
import { runFlyai, searchLiveHotels, parseNumber } from "./flyai.js";
import { queryRail } from "./mcp.js";
const text = (v, max = 100) =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
function requireTrip(d, exact = false) {
  if (!d || !text(d.destinationCity, 40))
    throw new AppError("INVALID_TRIP", "请先填写目的地。", 400);
  if (
    exact &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(d.departureDate || "") ||
      !Number.isFinite(Date.parse(d.departureDate)) ||
      new Date(d.departureDate).toISOString().slice(0, 10) !==
        d.departureDate ||
      d.dateMode === "fuzzy")
  )
    throw new AppError(
      "EXACT_DATE_REQUIRED",
      "实时交通和酒店报价需要精确出发日期，请先修改旅行信息。",
      422,
    );
}
export async function railOption(d, signal) {
  requireTrip(d, true);
  if (!text(d.originCity, 40))
    throw new AppError("ORIGIN_REQUIRED", "请补齐出发地。", 422);
  const tickets = await queryRail(
    d.originCity,
    d.destinationCity,
    d.departureDate,
    signal,
  );
  const prices = tickets
    .flatMap((t) => t.prices || [])
    .filter((p) => p.seat_name === "二等座" && Number.isFinite(p.price))
    .map((p) => p.price);
  const availableSeats = tickets.some((t) =>
    (t.prices || []).some(
      (p) => p.num && !["无", "0", "--"].includes(String(p.num)),
    ),
  );
  return {
    mode: "rail",
    title: "高铁 / 火车",
    duration: tickets[0]?.lishi
      ? tickets[0].lishi.replace(":", " 小时 ") + " 分"
      : "暂无直达方案",
    priceLabel: prices.length
      ? "¥" + Math.min(...prices) + " 起 / 人"
      : "票价待确认",
    reason: tickets.length
      ? "12306 实查 " +
        tickets.length +
        " 条线路；" +
        (availableSeats
          ? "部分车次有余票，具体班次以后续查询为准。"
          : "当前返回车次余票不足，请留意后续放票。")
      : "未找到适用的直达高铁 / 动车，可考虑中转。",
    available: tickets.length > 0,
    source: "live",
    provider: "12306 MCP",
    queriedAt: new Date().toISOString(),
  };
}
export async function flightOption(d, signal) {
  requireTrip(d, true);
  if (!text(d.originCity, 40))
    throw new AppError("ORIGIN_REQUIRED", "请补齐出发地。", 422);
  const result = await runFlyai(
    "search-flight",
    [
      "--origin",
      d.originCity,
      "--destination",
      d.destinationCity,
      "--dep-date",
      d.departureDate,
      "--sort-type",
      "4",
    ],
    signal,
  );
  const items = result.data.itemList,
    prices = items
      .map((i) => parseNumber(i.ticketPrice ?? i.adultPrice))
      .filter((n) => n !== null && n > 0);
  return {
    mode: "flight",
    title: "飞机",
    duration:
      parseNumber(items[0]?.totalDuration) > 0
        ? Math.floor(Number(items[0].totalDuration) / 60) +
          " 小时 " +
          (Number(items[0].totalDuration) % 60) +
          " 分"
        : "暂无航班方案",
    priceLabel: prices.length
      ? "¥" + Math.min(...prices) + " 起 / 人"
      : "票价待确认",
    reason:
      "FlyAI 实查 " +
      items.length +
      " 条航班候选，尚未选择具体航班；请另考虑机场接驳与候机时间。",
    available: items.length > 0,
    source: "live",
    provider: "FlyAI",
    queriedAt: new Date().toISOString(),
  };
}
export async function compareTransport(d, signal) {
  requireTrip(d, true);
  const results = await Promise.allSettled([
    railOption(d, signal),
    flightOption(d, signal),
  ]);
  const modes = ["rail", "flight"],
    titles = ["高铁 / 火车", "飞机"];
  const options = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          mode: modes[i],
          title: titles[i],
          duration: "查询暂不可用",
          priceLabel: "暂无实时报价",
          reason:
            r.reason instanceof AppError
              ? r.reason.message
              : "查询服务暂不可用。",
          available: false,
          source: "live",
          errorCode: r.reason?.code || "QUERY_FAILED",
        },
  );
  if (!options.some((o) => o.available))
    throw new AppError(
      "TRANSPORT_QUERY_FAILED",
      "铁路和航班均未取得可用方案，请检查日期并重试。",
    );
  options.push({
    mode: "drive",
    title: "自驾",
    duration: "路线条件待核实",
    priceLabel: "油费与过路费待核实",
    reason: "当前未查询实际自驾路线，暂不能据此推荐。",
    available: false,
    source: "live",
  });
  const advice = await runAgentTask(
    "根据提供的真实交通查询摘要和用户偏好，给出简洁比较结论，输出 {summary:string}。不能编造其他时长、价格或班次。只比较查询到的在途时长和价格，不可推断门到门耗时、准点率或机场接驳情况，不把不同班次的最低价与最短时长当作同一班次。明确说明地面接驳和候机尚未计入。",
    {
      originCity: d.originCity,
      destinationCity: d.destinationCity,
      preference: d.intercityTransportPreference,
      options,
    },
    signal,
  );
  return {
    options,
    summary:
      typeof advice.summary === "string"
        ? advice.summary.slice(0, 500)
        : "请选择更适合你的交通方式。",
  };
}
const areaCache = new Map();
export async function areaRecommendations(
  city,
  signal,
  progress = () => {},
  catalogOnly = false,
  refresh = false,
) {
  requireTrip({ destinationCity: city });
  progress({ stage: "正在读取已收录资料" });
  const stored = getPlaceCatalog().areas(city);
  if ((!refresh && stored.length) || catalogOnly) return stored;
  progress({ stage: "正在搜索目的地景点和商圈" });
  return sharePlaceQuery(
    "areas:" + city + (refresh ? ":refresh" : ""),
    signal,
    (sharedSignal) =>
      queryAreaRecommendations(city, sharedSignal, progress, refresh),
  );
}
async function queryAreaRecommendations(city, signal, progress, refresh) {
  requireTrip({ destinationCity: city });
  if (!refresh && areaCache.get(city)?.until > Date.now())
    return areaCache.get(city).places;
  const names = await runAgentTask(
    "为目的地各推荐3个热门景点和商圈，只返回 {attractions:string[3],shopping:string[3]}，只写可用于高德地图查询的完整地点名称。",
    { city },
    signal,
  );
  const list = [];
  for (const [key, type] of [
    ["attractions", "景点"],
    ["shopping", "商圈"],
  ]) {
    if (!Array.isArray(names[key]))
      throw new AppError("AGENT_INVALID_OUTPUT", "区域推荐格式不正确。");
    for (const name of names[key].slice(0, 3)) {
      if (!text(name)) continue;
      progress({
        stage: "正在核实地点与准备图片",
        completed: list.length,
        total: 6,
      });
      const matches = await searchPlaces(name, city, signal, type, 1, refresh);
      const p = matches.find((x) => x.name === name) || matches[0];
      if (p && !list.some((x) => x.id === p.id)) list.push(p);
    }
  }
  getPlaceCatalog().setAreas(city, list);
  areaCache.set(city, { places: list, until: Date.now() + 30 * 60000 });
  progress({
    stage: "地点资料已准备完成",
    completed: list.length,
    total: list.length,
  });
  return list;
}
export async function recommendPlaces(d, signal) {
  requireTrip(d);
  const result = await runAgentTask(
    "结合酒店、核心地点、天数、偏好与已经加入的景点，推荐最多4个未加入的景点名称，输出 {names:string[]}，不要加入行程。",
    {
      city: d.destinationCity,
      hotel: d.selectedHotel
        ? {
            name: d.selectedHotel.name,
            lat: d.selectedHotel.lat,
            lng: d.selectedHotel.lng,
          }
        : null,
      core: d.primaryPlace?.name,
      days: d.tripDays,
      preferences: d.rawPrompt,
      selected: d.tripPlaces?.map((p) => p.name) || [],
    },
    signal,
  );
  if (!Array.isArray(result.names))
    throw new AppError("AGENT_INVALID_OUTPUT", "推荐格式不正确。");
  const places = [];
  for (const name of result.names.slice(0, 4)) {
    if (!text(name)) continue;
    const found = await searchPlaces(name, d.destinationCity, signal);
    const p = found.find((p) => p.name === name) || found[0];
    if (
      p &&
      !d.tripPlaces?.some((x) => x.id === p.id) &&
      !places.some((x) => x.id === p.id)
    )
      places.push(p);
  }
  return places;
}
export async function searchHotels(p, signal) {
  requireTrip(p, true);
  if (
    !Array.isArray(p.priceRange) ||
    p.priceRange.length !== 2 ||
    !p.priceRange.every(Number.isFinite) ||
    p.priceRange[0] < 0 ||
    p.priceRange[1] > 2000 ||
    p.priceRange[0] > p.priceRange[1]
  )
    throw new AppError("INVALID_FILTERS", "价格范围不正确。", 400);
  for (const key of ["selectedDistricts", "brandPreference", "facilities"])
    if (
      !Array.isArray(p[key]) ||
      p[key].length > 20 ||
      !p[key].every((x) => text(x, 100))
    )
      throw new AppError("INVALID_FILTERS", "酒店筛选条件不正确。", 400);
  if (p.brandPreference.some(b => !HOTEL_BRANDS.includes(b)))
    throw new AppError("INVALID_BRAND_PREFERENCE", "原品牌偏好已移出本次范围，请重新选择品牌或不限品牌。", 422);
  for (const key of [
    "minRenovationYear",
    "overallRating",
    "starLevel",
    "reviewCount",
    "userScore",
  ])
    if (!Number.isFinite(p[key]) || p[key] < 0)
      throw new AppError("INVALID_FILTERS", "酒店筛选数值不正确。", 400);
  assertSupportedFilters(p);
  const { hotels, metadata } = await searchLiveHotels(p, signal);
  return rankHotelCandidates(hotels, p, metadata, signal);
}
// Dependency injection stays inside the server for recommendation failure tests.
export async function rankHotelCandidates(
  hotels,
  p,
  metadata,
  signal,
  recommend = runAgentTask,
) {
  let recommendedId;
  metadata.rankingStatus = "rules";
  if (hotels.length) {
    try {
      const result = await recommend(
        "结合用户已有筛选偏好，仅从提供的真实候选中选择一家综合推荐酒店，输出 {recommendedId:string}。ID必须存在，不生成酒店品质、设施、房型或距离描述。",
        {
          preferences: {
            city: p.destinationCity,
            core: p.primaryPlace?.name,
            priceRange: p.priceRange,
            brandPreference: p.brandPreference,
          },
          hotels: hotels.slice(0, 25).map((h) => ({
            id: h.id,
            name: h.name,
            price: h.price,
            rating: h.overallRating,
            coreDistance: h.coreDistance,
            renovationYear: h.renovationYear,
          })),
        },
        signal,
      );
      if (!hotels.some((h) => h.id === result.recommendedId))
        throw new AppError("AGENT_INVALID_OUTPUT", "推荐未返回有效候选。");
      recommendedId = result.recommendedId;
      metadata.rankingStatus = "agent";
    } catch (e) {
      metadata.rankingStatus = "unavailable";
      metadata.rankingError =
        e instanceof AppError ? e.code : "AGENT_UNAVAILABLE";
    }
  }
  for (const hotel of hotels) {
    hotel.reason = factHotelReason(hotel);
    hotel.recommendationSource =
      metadata.rankingStatus === "agent" ? "agent" : "rules";
    hotel.rankingNotice =
      metadata.rankingStatus === "agent"
        ? ""
        : "AI 推荐暂未生成，当前按已知评分、价格与直线距离整理候选。";
  }
  for (const pick of getHotelHighlights(hotels, recommendedId)) {
    pick.hotel.highlightLabel = pick.label;
    pick.hotel.reason = pick.reason;
  }
  for (const hotel of hotels) {
    hotel.platformHint = metadata.platformHint;
    hotel.searchMetadata = metadata;
  }
  return hotels;
}
export async function hotelBrands(city) {
  requireTrip({ destinationCity: city });
  return [...HOTEL_BRANDS];
}
export const handlers = {
  "amap/route": planRealRoute,
  "hotels/search-name": searchHotelByName,
  "route/edit-intent": routeEdit,
  "hotels/relaxation-advice": relaxationAdvice,
  "parse-trip": (p, s) => parseTripWithAgent(p.prompt, s),
  "amap/search-place": (p, s) => searchPlaces(p.query, p.city, s),
  "amap/resolve-district": async (p, s) => [
    (await getPlaceDetail(p.place?.id, p.place?.city, p.place?.type, s))
      .district,
  ],
  "area-recommendations": (p, s, progress) =>
    areaRecommendations(
      p.city,
      s,
      progress,
      p.catalogOnly === true,
      p.refresh === true,
    ),
  "hotel-brands": (p, s) => hotelBrands(p.city, s),
  "rail/search": railOption,
  "flight/search": flightOption,
  "transport/compare": compareTransport,
  "flyai/search-hotels": searchHotels,
  "recommend-places": recommendPlaces,
};
export async function routeEdit(p, signal) {
  const d = p.draft;
  requireTrip(d);
  if (
    !text(p.instruction, 300) ||
    !Array.isArray(d.tripPlaces) ||
    d.tripPlaces.length > 100
  )
    throw new AppError("INVALID_ROUTE_EDIT", "请填写有效的路线修改要求。", 400);
  const result = await runAgentTask(
    '理解用户对已选景点的修改，只允许 move/delete/replace。输出 {operation:"move"|"delete"|"replace",placeId:string,day:number|null,replacementQuery:string}。placeId 必须来自已选列表，移动天数必须在旅行天数内；替换须提取明确目标或附近景点。不能确定时返回 {operation:"unknown"}。',
    {
      instruction: p.instruction,
      days: d.tripDays,
      places: d.tripPlaces.map((x) => ({ id: x.id, name: x.name })),
    },
    signal,
  );
  const old = d.tripPlaces.find((x) => x.id === result.placeId);
  if (!old || !["move", "delete", "replace"].includes(result.operation))
    throw new AppError(
      "AMBIGUOUS_EDIT",
      "请说明要修改的景点和移动、删除或替换操作。",
      422,
    );
  if (
    result.operation === "move" &&
    (!Number.isInteger(result.day) || result.day < 1 || result.day > d.tripDays)
  )
    throw new AppError(
      "INVALID_ROUTE_DAY",
      "请指定这趟旅行内的有效天数。",
      422,
    );
  if (result.operation === "replace" && !text(result.replacementQuery, 100))
    throw new AppError(
      "INVALID_REPLACEMENT",
      "请说明替换目标，或要求换成附近景点。",
      422,
    );
  return {
    operation: result.operation,
    placeId: old.id,
    day: result.operation === "move" ? result.day : null,
    replacementQuery:
      result.operation === "replace" ? result.replacementQuery : "",
  };
}
export async function relaxationAdvice(p, signal) {
  const f = p.filters;
  if (!f || !Array.isArray(f.priceRange))
    throw new AppError("INVALID_FILTERS", "请先设置酒店条件。", 400);
  const advice = await runAgentTask(
    "根据筛选条件解释为什么可能无结果，并简要比较三个由用户选择的放宽方向：预算、位置与评分、装修与设施。供应方未返回评论数、设施和数字星级，这些条件严格过滤时会排除未知酒店。不可断言无房、不可保证放宽后有结果、不可修改条件。给普通旅行用户写，不出现英文变量名和技术术语，总共不超过180字。已是不限的条件不建议继续降低，优先指出实际生效的限制。输出 {summary:string}。",
    { filters: f },
    signal,
  );
  if (typeof advice.summary !== "string")
    throw new AppError("AGENT_INVALID_OUTPUT", "放宽建议暂未生成。");
  return { summary: advice.summary.slice(0, 700) };
}

export async function searchHotelByName(p, signal) {
  requireTrip(p.trip, p.provider !== "amap");
  if (!text(p.query, 100))
    throw new AppError("INVALID_QUERY", "请填写酒店名称。", 400);
  if (p.provider === "amap")
    return {
      hotels: await searchHotelPois(p.query, p.trip.destinationCity, signal),
      provider: "amap",
      notice: "高德地图位置 · 非飞猪酒店数据；报价和酒店资料待核实。",
    };
  const neutral = {
    ...p.trip,
    priceRange: [0, 2000],
    brandPreference: [],
    selectedDistricts: [],
    primaryPlace: null,
    minRenovationYear: 0,
    overallRating: 0,
    starLevel: 0,
    reviewCount: 0,
    userScore: 0,
    facilities: [],
  };
  const { hotels, metadata } = await searchLiveHotels(neutral, signal, p.query);
  if (hotels.length)
    return {
      hotels,
      provider: "flyai",
      notice: "指定名称搜索独立于推荐筛选。" + (metadata.platformHint || ""),
    };
  return {
    hotels: await searchHotelPois(p.query, p.trip.destinationCity, signal),
    provider: "amap",
    notice:
      "飞猪未返回该名称的可用候选，以下为高德地图位置 · 非飞猪酒店数据；不代表酒店无房。",
  };
}
