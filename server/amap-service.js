import { AppError } from "./errors.js";
export const amapDiagnostics = {
  mcpFailures: 0,
  restFallbacks: 0,
  restSuccesses: 0,
  lastFailureCode: null,
  lastFailureTool: null,
};
export function amapError(value, fallback = "AMAP_QUERY_FAILED") {
  const raw = typeof value === "string" ? value : JSON.stringify(value || {});
  const rules = [
    [
      /INVALID_USER_KEY|USERKEY_PLAT_NOMATCH|\b(?:10001|10009)\b/,
      "AMAP_KEY_INVALID",
      "高德 Key 无效或类型不匹配，请检查服务端 Web 服务 Key。",
      503,
    ],
    [
      /INSUFFICIENT_PRIVILEGES|INVALID_USER_IP|INVALID_USER_DOMAIN|\b(?:10005|10006|10012)\b/,
      "AMAP_PERMISSION_DENIED",
      "高德 Key 权限或访问白名单不允许本次查询，请检查服务端配置。",
      503,
    ],
    [
      /DAILY_QUERY_OVER_LIMIT|ACCESS_TOO_FREQUENT|CUQPS_HAS_EXCEEDED|QPS|\b(?:10003|10004|10014|10019|10020|10021|10044)\b/,
      "AMAP_RATE_LIMITED",
      "高德查询额度或频率已达限制，请稍后主动重试。",
      429,
    ],
    [
      /INVALID_PARAMS|MISSING_REQUIRED_PARAMS|ILLEGAL_REQUEST|\b(?:20000|20001|20002)\b/,
      "AMAP_INVALID_PARAMETERS",
      "高德请求参数无效，请重新核实城市和经纬度。",
      422,
    ],
    [
      /POI_NOT_FOUND|INVALID_POI|不存在|未找到/,
      "AMAP_POI_NOT_FOUND",
      "高德地点标识已失效，请按名称重新定位。",
      422,
    ],
    [
      /timeout|timed out|超时/i,
      "AMAP_TIMEOUT",
      "高德查询超时，请检查网络后重试。",
      504,
    ],
  ];
  const match = rules.find(([pattern]) => pattern.test(raw));
  return match
    ? new AppError(match[1], match[2], match[3])
    : new AppError(fallback, "高德地图查询未完成，请检查网络后重试。");
}
export function decodeMcpResult(result, provider = "AMAP") {
  const raw = (result?.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  if (result?.isError || /^Error:/i.test(raw)) {
    if (provider === "RAIL")
      throw new AppError(
        "RAIL_QUERY_FAILED",
        "12306 铁路查询未完成，请稍后重试。",
      );
    throw amapError(raw);
  }
  let data = result?.structuredContent;
  if (data == null) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new AppError(
        provider + "_INVALID_OUTPUT",
        provider === "RAIL"
          ? "12306 返回的数据不是有效 JSON，请重试。"
          : "高德返回的数据不是有效 JSON，请重试。",
      );
    }
  }
  if (data === null || typeof data !== "object")
    throw new AppError(
      provider + "_INVALID_OUTPUT",
      "查询返回的数据结构无法识别，请重试。",
    );
  if (
    provider === "AMAP" &&
    (String(data.status) === "0" ||
      (data.infocode && String(data.infocode) !== "10000"))
  )
    throw amapError(data);
  return data;
}
const endpoints = {
  maps_text_search: "place/text",
  maps_search_detail: "place/detail",
  maps_regeocode: "geocode/regeo",
  maps_direction_walking: "direction/walking",
  maps_direction_driving: "direction/driving",
  maps_direction_transit_integrated: "direction/transit/integrated",
};
const retryable = new Set([
  "AMAP_QUERY_FAILED",
  "AMAP_CONNECTION_FAILED",
  "AMAP_INVALID_OUTPUT",
  "AMAP_TIMEOUT",
]);
// Both transports query official Amap with the same server-only Web Service key.
export async function queryAmap(
  name,
  args,
  signal,
  mcp,
  config,
  request = fetch,
) {
  if (signal?.aborted) throw signal.reason;
  try {
    return await mcp();
  } catch (cause) {
    if (signal?.aborted) throw signal.reason;
    const error =
      cause instanceof AppError
        ? cause
        : amapError(String(cause?.message || ""));
    amapDiagnostics.mcpFailures++;
    amapDiagnostics.lastFailureCode = error.code;
    amapDiagnostics.lastFailureTool = name;
    if (!config.amapKey || !endpoints[name] || !retryable.has(error.code))
      throw error;
    amapDiagnostics.restFallbacks++;
    const url = new URL("https://restapi.amap.com/v3/" + endpoints[name]);
    url.searchParams.set("key", config.amapKey);
    url.searchParams.set("output", "JSON");
    const params =
      name === "maps_search_detail" ? { id: args.id } : { ...args };
    if (name.startsWith("maps_direction")) params.extensions = "all";
    for (const [key, value] of Object.entries(params))
      if (value != null) url.searchParams.set(key, String(value));
    try {
      const response = await request(url, {
        signal: AbortSignal.any([
          ...(signal ? [signal] : []),
          AbortSignal.timeout(12000),
        ]),
      });
      if (!response.ok)
        throw new AppError(
          response.status === 429 ? "AMAP_RATE_LIMITED" : "AMAP_HTTP_ERROR",
          response.status === 429
            ? "高德查询过于频繁，请稍后重试。"
            : "高德官方接口暂不可用，请稍后重试。",
          response.status === 429 ? 429 : 502,
        );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new AppError(
          "AMAP_INVALID_OUTPUT",
          "高德官方接口返回的数据不是有效 JSON，请重试。",
        );
      }
      if (!data || String(data.status) !== "1") throw amapError(data);
      amapDiagnostics.restSuccesses++;
      if (name === "maps_search_detail") {
        const poi = data.pois?.[0];
        return poi
          ? {
              _provider: "高德官方Web服务",
              ...poi,
              city: poi.city || poi.cityname,
              district: poi.district || poi.adname,
            }
          : {};
      }
      return { ...data, _provider: "高德官方Web服务" };
    } catch (e) {
      if (signal?.aborted) throw signal.reason;
      const safe =
        e instanceof AppError
          ? e
          : amapError(String(e?.name || "") + " " + String(e?.message || ""));
      amapDiagnostics.lastFailureCode = safe.code;
      throw safe;
    }
  }
}
