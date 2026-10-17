import { decodeMcpResult, queryAmap } from "./amap-service.js";
import { getPlaceCatalog, sharePlaceQuery } from "./place-catalog.js";
import { placeImage } from "./image-sources.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
let amapPending, railPending;
export const placeDiagnostics = { searches: 0, details: 0, districts: 0 };
const poiCache = new Map();
async function connectAmap() {
  const config = loadConfig();
  if (!config.amapKey)
    throw new AppError(
      "AMAP_NOT_CONFIGURED",
      "高德 Web 服务 Key 尚未配置。",
      503,
    );
  const url = new URL("https://mcp.amap.com/mcp");
  url.searchParams.set("key", config.amapKey);
  const client = new Client({ name: "chuyou-travel-v2", version: "2.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(url), {
      timeout: 30000,
    });
    return client;
  } catch {
    await client.close().catch(() => {});
    throw new AppError(
      "AMAP_CONNECTION_FAILED",
      "高德 MCP 连接失败，请检查 Key 权限和网络。",
    );
  }
}
export async function amap(name, args, signal) {
  if (name === "maps_text_search") placeDiagnostics.searches++;
  if (name === "maps_search_detail") placeDiagnostics.details++;
  if (name === "maps_regeocode") placeDiagnostics.districts++;
  return queryAmap(
    name,
    args,
    signal,
    async () => {
      if (!amapPending)
        amapPending = connectAmap().catch((e) => {
          amapPending = null;
          throw e;
        });
      const client = await amapPending;
      if (signal?.aborted) throw signal.reason;
      try {
        return decodeMcpResult(
          await client.callTool({ name, arguments: args }, undefined, {
            timeout: 30000,
            signal,
          }),
        );
      } catch (e) {
        if (signal?.aborted) throw signal.reason;
        if (!(e instanceof AppError)) {
          // A closed/broken transport must not be reused by the next explicit retry.
          amapPending = null;
          await client.close().catch(() => {});
        }
        throw e;
      }
    },
    loadConfig(),
  );
}
export async function reverseDistrict(location, signal) {
  const result = await amap("maps_regeocode", { location }, signal);
  const component =
    result.addressComponent ||
    result.regeocode?.addressComponent ||
    result.address_component ||
    {};
  return typeof component.district === "string"
    ? component.district
    : typeof result.district === "string"
      ? result.district
      : "";
}
export async function getPlaceDetail(
  id,
  city,
  type = "景点",
  signal,
  photoHint,
  refresh = false,
) {
  if (!/^B[a-zA-Z0-9]{4,40}$/.test(id))
    throw new AppError("INVALID_PLACE", "地点标识无法识别。", 400);
  const stored = getPlaceCatalog().get(id);
  if (stored && !refresh) return stored;
  const cached = poiCache.get(id);
  if (!refresh && cached && cached.until > Date.now())
    return { ...cached.place, type };
  const detail = await amap("maps_search_detail", { id }, signal);
  const [lng, lat] = String(detail.location || "")
    .split(",")
    .map(Number);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new AppError(
      "PLACE_UNRESOLVED",
      "高德未返回可用坐标，请选择其他地点。",
    );
  const district = await reverseDistrict(lng + "," + lat, signal);
  if (!district)
    throw new AppError(
      "DISTRICT_UNRESOLVED",
      "高德未确认所属行政区，请稍后重试。",
    );
  const place = {
    id,
    name: String(detail.name || ""),
    city: String(detail.city || city),
    type,
    district,
    address: String(detail.address || ""),
    lat,
    lng,
    source: "live",
    provider: detail._provider || "高德地图MCP",
    description:
      type === "商圈" ? "高德地图已定位的城市商圈" : "高德地图已定位的景点",
  };
  Object.assign(place, await placeImage(place, photoHint, signal));
  getPlaceCatalog().put(place);
  poiCache.set(id, { place, until: Date.now() + 15 * 60000 });
  return place;
}
export async function searchPlaces(
  query,
  city,
  signal,
  type = "景点",
  limit = 3,
  refresh = false,
) {
  const cached = getPlaceCatalog().search(city, query);
  if (cached.length && !refresh) return cached;
  return sharePlaceQuery(
    city + ":" + query + ":" + type + (refresh ? ":refresh" : ""),
    signal,
    (sharedSignal) =>
      searchPlacesRemote(query, city, sharedSignal, type, limit, refresh),
  );
}
async function searchPlacesRemote(query, city, signal, type, limit, refresh) {
  if (
    typeof query !== "string" ||
    !query.trim() ||
    query.length > 100 ||
    typeof city !== "string" ||
    city.length > 40
  )
    throw new AppError("INVALID_PLACE_QUERY", "请填写有效地点和城市。", 400);
  const result = await amap(
    "maps_text_search",
    { keywords: query.trim(), city },
    signal,
  );
  const raw = Array.isArray(result.pois) ? result.pois : [];
  const choices = [];
  for (const item of raw.slice(0, limit)) {
    try {
      const p = await getPlaceDetail(
        item.id,
        city,
        type,
        signal,
        item.photo,
        refresh,
      );
      if (p.city.replace(/市$/, "") === city.replace(/市$/, ""))
        choices.push(p);
    } catch (e) {
      if (e.code !== "PLACE_UNRESOLVED" && e.code !== "DISTRICT_UNRESOLVED")
        throw e;
    }
  }
  getPlaceCatalog().remember(city, query, choices);
  return choices;
}
async function connectRail() {
  const client = new Client({ name: "chuyou-rail-v2", version: "2.0.0" });
  const env = Object.fromEntries(
    ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE"]
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["node_modules/12306-mcp/build/index.js"],
    cwd: process.cwd(),
    stderr: "ignore",
    env,
  });
  try {
    await client.connect(transport, { timeout: 45000 });
    return client;
  } catch {
    await client.close().catch(() => {});
    throw new AppError(
      "RAIL_CONNECTION_FAILED",
      "12306 MCP 连接失败，请检查网络。",
    );
  }
}
export async function queryRail(origin, destination, date, signal) {
  if (!railPending)
    railPending = connectRail().catch((e) => {
      railPending = null;
      throw e;
    });
  const client = await railPending;
  try {
    const result = decodeMcpResult(
      await client.callTool(
        {
          name: "get-tickets",
          arguments: {
            date,
            fromStation: origin,
            toStation: destination,
            trainFilterFlags: "GD",
            sortFlag: "duration",
            limitedNum: 8,
            format: "json",
          },
        },
        undefined,
        { timeout: 45000, signal },
      ),
      "RAIL",
    );
    if (!Array.isArray(result)) throw new Error("not array");
    return result;
  } catch (e) {
    if (e instanceof AppError)
      throw new AppError(
        "RAIL_QUERY_FAILED",
        "12306 暂未返回有效车次，请稍后重试。",
      );
    throw new AppError("RAIL_QUERY_FAILED", "12306 查询失败，请稍后重试。");
  }
}
export async function closeMcpClients() {
  const connections = [amapPending, railPending];
  amapPending = railPending = null;
  for (const connection of connections)
    if (connection) await connection.then((c) => c.close()).catch(() => {});
}
