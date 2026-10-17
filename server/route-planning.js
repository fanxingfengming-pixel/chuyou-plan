import { amap, getPlaceDetail } from "./mcp.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
const clean = (v) => (typeof v === "string" ? v.trim() : "");
const num = (v) =>
  v !== null &&
  v !== undefined &&
  v !== "" &&
  Number.isFinite(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : null;
const validId = (v) => typeof v === "string" && /^B[a-zA-Z0-9]{4,40}$/.test(v);
const sameCity = (a, b) =>
  clean(a).replace(/市$/, "") === clean(b).replace(/市$/, "");
const location = (p) =>
  Number(p.lng).toFixed(6) + "," + Number(p.lat).toFixed(6);
export function parseLocation(value) {
  const parts = String(value || "").split(",");
  if (parts.length !== 2 || parts.some((v) => !v.trim())) return null;
  const [lng, lat] = parts.map(Number);
  return Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
    ? { lng, lat }
    : null;
}
export async function hotelPoi(id, city, signal) {
  if (!validId(id))
    throw new AppError("INVALID_PLACE", "酒店位置标识不正确。", 400);
  const d = await amap("maps_search_detail", { id }, signal),
    point = parseLocation(d.location);
  const resolvedCity = Array.isArray(d.city) ? d.city[0] : d.city;
  if (!point || !sameCity(resolvedCity || city, city))
    throw new AppError(
      "HOTEL_UNRESOLVED",
      "酒店位置不在目的地或坐标不可用。",
      422,
    );
  if (
    !String(d.typecode || "")
      .split("|")
      .some((v) => v.startsWith("10")) &&
    !/酒店|饭店|宾馆|住宿|旅馆|民宿|客栈/.test(d.type || d.name || "")
  )
    throw new AppError(
      "HOTEL_UNRESOLVED",
      "这个地点没有核实为住宿，请重新选择酒店。",
      422,
    );
  return {
    id,
    name: clean(d.name),
    city: resolvedCity || city,
    address: clean(d.address),
    district: clean(d.adname || d.district),
    ...point,
    source: "live",
    provider: d._provider || "高德地图MCP",
    coordinateSystem: "GCJ-02",
  };
}
export async function searchHotelPois(query, city, signal) {
  if (!clean(query) || query.length > 100 || !clean(city) || city.length > 40)
    throw new AppError("INVALID_QUERY", "请填写有效酒店名称和目的地。", 400);
  const result = await amap(
      "maps_text_search",
      { keywords: query.trim(), city, citylimit: true },
      signal,
    ),
    items = (result.pois || [])
      .filter(
        (p) =>
          String(p.typecode || "")
            .split("|")
            .some((v) => v.startsWith("10")) &&
          !/停车场|大堂|入口|出口|餐厅|公寓售楼/.test(p.name || ""),
      )
      .slice(0, 6);
  const hotels = [];
  for (const p of items) {
    if (signal?.aborted) throw signal.reason;
    try {
      const point = await hotelPoi(p.id, city, signal);
      hotels.push({
        id: "amap-hotel-" + p.id,
        amapPoiId: p.id,
        name: point.name,
        city: point.city,
        address: point.address,
        district: point.district,
        lat: point.lat,
        lng: point.lng,
        brand: "",
        price: null,
        overallRating: null,
        userScore: null,
        subwayDistance: null,
        renovationYear: null,
        starLevel: null,
        reviewCount: null,
        coreDistance: null,
        facilities: [],
        reason: "仅核实住宿位置，报价与酒店资料需另行核实。",
        source: "live",
        dataProvider: "amap",
        imageFallback: true,
        imageSource: "通用风景示意图 · 非实景",
        queriedAt: new Date().toISOString(),
      });
    } catch (e) {
      if (e.code !== "HOTEL_UNRESOLVED") throw e;
    }
  }
  return hotels;
}
const sum = (values) =>
  values.every((v) => v !== null) ? values.reduce((a, b) => a + b, 0) : null;
export function normalizeDirection(raw, mode) {
  const route = raw.route || raw;
  const path = (mode === "transit" ? route.transits : route.paths)?.[0];
  if (!path) return null;
  const segments = path.segments || [];
  let distance = num(path.distance);
  if (mode === "transit" && distance === null) {
    const parts = [];
    for (const s of segments) {
      if (s.walking && Object.keys(s.walking).length)
        parts.push(num(s.walking.distance));
      const bus = s.bus?.buslines?.[0];
      if (bus) parts.push(num(bus.distance));
      if (s.railway?.name) parts.push(num(s.railway.distance));
      if (s.taxi?.distance) parts.push(num(s.taxi.distance));
    }
    distance = parts.length ? sum(parts) : null;
  }
  const duration = num(path.duration ?? path.cost?.duration);
  if (distance === null || duration === null || distance <= 0 || duration <= 0)
    return null;
  const polylines = [];
  const collect = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.polyline === "string") {
      const points = value.polyline
        .split(";")
        .map(parseLocation)
        .filter(Boolean);
      if (points.length > 1) polylines.push(points);
    }
    for (const [key, v] of Object.entries(value))
      if (key !== "polyline" && typeof v === "object") {
        if (Array.isArray(v)) v.forEach(collect);
        else collect(v);
      }
  };
  collect(path);
  const instructions =
    mode === "transit"
      ? segments
          .flatMap((s) =>
            (s.bus?.buslines || []).slice(0, 1).map((b) => b.name),
          )
          .filter(Boolean)
      : (path.steps || [])
          .map((s) => s.instruction)
          .filter(Boolean)
          .slice(0, 30);
  return {
    mode,
    provider: raw._provider || "高德地图MCP",
    distanceMeters: distance,
    durationSeconds: duration,
    polylines,
    instructions,
    geometrySource: polylines.length ? raw._provider || "高德地图MCP" : null,
  };
}
export function recommendDirection(options, preference) {
  const walking = options.find((o) => o.mode === "walking"),
    transit = options.find((o) => o.mode === "transit"),
    driving = options.find((o) => o.mode === "driving");
  if (
    walking &&
    walking.distanceMeters <= 1500 &&
    walking.durationSeconds <= 1500
  )
    return { ...walking, recommendation: "实际步行距离较短，可直接步行。" };
  const preferred = preference === "打车" ? driving : transit;
  const selected = preferred || driving || walking || transit;
  return selected
    ? {
        ...selected,
        recommendation: preferred
          ? "结合已选偏好与高德查询结果推荐。"
          : "偏好方式暂无可用方案，采用已查到的交通备选。",
      }
    : null;
}
async function supplementGeometry(selected, from, to, city, signal) {
  if (selected.polylines.length) return selected;
  const config = loadConfig();
  if (!config.amapKey) return selected;
  const mode =
    selected.mode === "transit" ? "transit/integrated" : selected.mode;
  const url = new URL("https://restapi.amap.com/v3/direction/" + mode);
  for (const [k, v] of Object.entries({
    key: config.amapKey,
    origin: location(from),
    destination: location(to),
    extensions: "all",
    ...(mode === "transit/integrated" ? { city, cityd: city } : {}),
  }))
    url.searchParams.set(k, v);
  try {
    const r = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    });
    if (!r.ok) return selected;
    const data = await r.json();
    if (data.status !== "1") return selected;
    const enriched = normalizeDirection(data, selected.mode);
    if (
      !enriched?.polylines.length ||
      Math.abs(enriched.distanceMeters - selected.distanceMeters) >
        Math.max(5, selected.distanceMeters * 0.01)
    )
      return selected;
    return {
      ...selected,
      polylines: enriched.polylines,
      geometrySource: "高德官方路径服务（补充轨迹）",
    };
  } catch {
    if (signal?.aborted) throw signal.reason;
    return selected;
  }
}
const tools = {
  walking: "maps_direction_walking",
  transit: "maps_direction_transit_integrated",
  driving: "maps_direction_driving",
};
export async function queryLeg(
  from,
  to,
  city,
  preference,
  signal,
  call = amap,
  geometry = supplementGeometry,
) {
  if (
    ![from?.lat, from?.lng, to?.lat, to?.lng].every(
      (v) => typeof v === "number" && Number.isFinite(v),
    ) ||
    !parseLocation(location(from)) ||
    !parseLocation(location(to))
  )
    throw new AppError(
      "AMAP_INVALID_PARAMETERS",
      "路线经纬度无效，请重新核实地点。",
      422,
    );
  const results = await Promise.allSettled(
    Object.entries(tools).map(async ([mode, tool]) =>
      normalizeDirection(
        await call(
          tool,
          {
            origin: location(from),
            destination: location(to),
            ...(mode === "transit" ? { city, cityd: city } : {}),
          },
          signal,
        ),
        mode,
      ),
    ),
  );
  if (signal?.aborted) throw signal.reason;
  const options = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value),
    chosen = recommendDirection(options, preference);
  const common = {
    id: from.id + ">" + to.id,
    from,
    to,
    source: "live",
    provider: "高德地图MCP",
    queriedAt: new Date().toISOString(),
  };
  const failure = results.find(
    (r) => r.status === "rejected" && r.reason instanceof AppError,
  )?.reason;
  if (!chosen)
    return {
      ...common,
      status: "error",
      mode: null,
      distanceMeters: null,
      durationSeconds: null,
      polylines: [],
      instructions: [],
      error:
        failure?.message || "高德没有返回可用距离和耗时，请调整地点或重试。",
      errorCode: failure?.code || "AMAP_ROUTE_UNAVAILABLE",
      recommendation: "",
      geometrySource: null,
    };
  const detail = await geometry(chosen, from, to, city, signal);
  return {
    ...common,
    ...detail,
    status: "ready",
    error: "",
    alternatives: options.map((o) => ({
      mode: o.mode,
      distanceMeters: o.distanceMeters,
      durationSeconds: o.durationSeconds,
    })),
    tool: tools[chosen.mode],
  };
}
export function validateRoutePayload(p) {
  if (
    !p ||
    !clean(p.city) ||
    p.city.length > 40 ||
    !p.hotel ||
    !clean(p.hotel.name) ||
    p.hotel.name.length > 200 ||
    !Array.isArray(p.places) ||
    p.places.length > 200 ||
    !Array.isArray(p.days) ||
    !p.days.length ||
    p.days.length > 30 ||
    !["公共交通", "打车", "步行 + 公共交通"].includes(p.preference)
  )
    throw new AppError("INVALID_ROUTE", "请先确认酒店、景点和市内交通。", 400);
  const ids = new Set(p.places.map((v) => v?.id));
  if (ids.size !== p.places.length || p.places.some((v) => !validId(v?.id)))
    throw new AppError(
      "INVALID_ROUTE",
      "景点需要先由高德核实，不能使用模拟坐标。",
      422,
    );
  const seen = new Set();
  p.days.forEach((d, i) => {
    if (d.day !== i + 1 || !Array.isArray(d.stops) || d.stops.length > 300)
      throw new AppError("INVALID_ROUTE", "路线日期或地点数量不正确。", 400);
    for (const s of d.stops) {
      if (
        !s ||
        !["place", "meal"].includes(s.kind) ||
        !["早上", "中午", "下午", "晚上"].includes(s.period) ||
        !clean(s.id)
      )
        throw new AppError("INVALID_ROUTE", "路线内容不正确。", 400);
      if (s.kind === "place") {
        if (!ids.has(s.placeId) || seen.has(s.placeId))
          throw new AppError("INVALID_ROUTE", "路线存在重复或未选地点。", 400);
        seen.add(s.placeId);
      }
    }
  });
  if (seen.size !== ids.size || !seen.size)
    throw new AppError(
      "INVALID_ROUTE",
      "请至少加入一个景点，并将全部已选地点安排到行程。",
      422,
    );
}
export async function planRealRoute(
  p,
  signal,
  progress = () => {},
  dependencies = {},
) {
  const lookupHotel = dependencies.hotelPoi || hotelPoi,
    findHotels = dependencies.searchHotelPois || searchHotelPois,
    lookupPlace = dependencies.getPlaceDetail || getPlaceDetail,
    lookupLeg = dependencies.queryLeg || queryLeg;
  validateRoutePayload(p);
  progress({ stage: "正在核实酒店和景点位置" });
  let anchor;
  if (p.hotel.amapPoiId) {
    try {
      anchor = await lookupHotel(p.hotel.amapPoiId, p.city, signal);
    } catch (e) {
      if (signal?.aborted) throw signal.reason;
      if (!["HOTEL_UNRESOLVED", "AMAP_POI_NOT_FOUND"].includes(e.code)) throw e;
      progress({ stage: "原酒店位置标识已失效，正在按名称重新定位" });
    }
  }
  if (!anchor) {
    const choices = await findHotels(p.hotel.name, p.city, signal),
      normalize = (s) => s.replace(/[\s（）()·]/g, "");
    const exact = choices.filter(
      (h) => normalize(h.name) === normalize(p.hotel.name),
    );
    if (exact.length === 1)
      anchor = await lookupHotel(exact[0].amapPoiId, p.city, signal);
    else
      return {
        schemaVersion: 21,
        days: p.days.map((d) => ({ ...d, legs: [] })),
        needsOptimization: false,
        generatedAt: new Date().toISOString(),
        status: "needs-hotel",
        error: choices.length
          ? "请确认具体酒店分店和地址，再计算真实路线。"
          : "高德暂未定位该酒店，请更换酒店或核实名称后重试。",
        hotelChoices: choices,
        hotelAnchor: null,
      };
  }
  const places = new Map();
  for (const place of p.places) {
    if (signal.aborted) throw signal.reason;
    const point = await lookupPlace(place.id, p.city, "景点", signal);
    if (!sameCity(point.city, p.city))
      throw new AppError(
        "PLACE_UNRESOLVED",
        "景点不在目的地，请重新选择。",
        422,
      );
    places.set(place.id, {
      id: point.id,
      name: point.name,
      lat: point.lat,
      lng: point.lng,
      address: point.address,
      source: "live",
      provider: point.provider || "高德地图MCP",
      coordinateSystem: "GCJ-02",
    });
  }
  const total = p.days.reduce(
    (n, d) =>
      n +
      d.stops.filter((s) => s.kind === "place").length +
      (d.stops.some((s) => s.kind === "place") ? 1 : 0),
    0,
  );
  let completed = 0;
  const days = [];
  const legCache = new Map();
  for (const d of p.days) {
    const points = d.stops
        .filter((s) => s.kind === "place")
        .map((s) => places.get(s.placeId)),
      legs = [];
    if (points.length) {
      const nodes = [anchor, ...points, anchor];
      for (let i = 0; i < nodes.length - 1; i++) {
        progress({
          stage: "正在计算第" + d.day + "天路线（含返回酒店）",
          completed,
          total,
        });
        const key = nodes[i].id + ">" + nodes[i + 1].id;
        let leg = legCache.get(key);
        if (!leg) {
          leg = await lookupLeg(
            nodes[i],
            nodes[i + 1],
            p.city,
            p.preference,
            signal,
          );
          legCache.set(key, leg);
        }
        legs.push(leg);
        completed++;
      }
    }
    days.push({
      ...d,
      stops: d.stops.map((s) =>
        s.kind === "place" ? { ...s, name: places.get(s.placeId).name } : s,
      ),
      legs,
    });
  }
  const partial = days.some((d) => d.legs.some((l) => l.status !== "ready"));
  progress({
    stage: partial ? "部分路线未完成" : "路线已重新计算",
    completed,
    total,
  });
  return {
    schemaVersion: 21,
    days,
    hotelAnchor: anchor,
    needsOptimization: false,
    generatedAt: new Date().toISOString(),
    status: partial ? "partial" : "ready",
    error: partial ? "部分路段未取得高德结果，请调整地点或重试。" : "",
    hotelChoices: [],
  };
}
