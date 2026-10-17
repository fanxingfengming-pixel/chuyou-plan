import { matchesHotelBrand } from "../shared/hotel-brands.js";
import { priceBounds } from "../shared/price-bounds.js";
import { hotelImage } from "./image-sources.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "./errors.js";
import { resolveFlyaiRuntime } from "./flyai-runtime.js";
const exec = promisify(execFile),
  bin = path.resolve("node_modules/@fly-ai/flyai-cli/dist/flyai-bundle.cjs");
export const cliDiagnostics = {
  lastExitCode: 0,
  runtimeVersion: null,
  queryCount: 0,
  failedProcessCount: 0,
  lastStderrHadAssertion: false,
  completeResponseAfterExitWarning: false,
};
const safeEnv = () =>
  Object.fromEntries(
    [
      "PATH",
      "Path",
      "SystemRoot",
      "WINDIR",
      "TEMP",
      "TMP",
      "USERPROFILE",
      "APPDATA",
      "LOCALAPPDATA",
      "FLYAI_API_KEY",
      "FLYAI_SIGN_SECRET",
    ]
      .filter((k) => process.env[k])
      .map((k) => [k, process.env[k]]),
  );
export function flyaiConfigured() {
  try {
    return (
      !!process.env.FLYAI_API_KEY ||
      !!JSON.parse(
        fs.readFileSync(
          process.env.USERPROFILE + "/.flyai/config.json",
          "utf8",
        ),
      ).FLYAI_API_KEY
    );
  } catch {
    return !!process.env.FLYAI_API_KEY;
  }
}
export function createFlyaiRunner(execute = exec) {
  return async function runFlyai(command, argumentsList, signal) {
    if (
      !["search-hotel", "search-flight", "search-poi", "search-train"].includes(
        command,
      )
    )
      throw new AppError("TOOL_NOT_ALLOWED", "此查询工具未开放。", 400);
    const runtime = await resolveFlyaiRuntime(process.env, execute);
    cliDiagnostics.runtimeVersion = runtime.version;
    let stdout = "",
      stderr = "",
      exitCode = 0;
    cliDiagnostics.queryCount++;
    try {
      ({ stdout, stderr } = await execute(
        runtime.executable,
        [bin, command, ...argumentsList],
        {
          cwd: process.cwd(),
          env: safeEnv(),
          timeout: 65000,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
          signal,
        },
      ));
    } catch (error) {
      stdout = error.stdout || "";
      stderr = error.stderr || "";
      cliDiagnostics.failedProcessCount++;
      exitCode = error.code;
      cliDiagnostics.lastExitCode = exitCode;
      cliDiagnostics.lastStderrHadAssertion =
        /Assertion failed|UV_HANDLE_CLOSING/i.test(stderr);
      cliDiagnostics.completeResponseAfterExitWarning = false;
      try {
        cliDiagnostics.completeResponseAfterExitWarning =
          JSON.parse(stdout.trim()).status === 0;
      } catch {}
      if (error.killed || signal?.aborted)
        throw new AppError(
          "FLYAI_TIMEOUT",
          "FlyAI 查询超时，请稍后重新搜索。",
          504,
        );
      throw new AppError(
        "FLYAI_PROCESS_FAILED",
        "FlyAI 查询进程异常退出，请重试；持续发生时请检查运行环境。",
      );
    }
    cliDiagnostics.lastExitCode = 0;
    cliDiagnostics.completeResponseAfterExitWarning = false;
    cliDiagnostics.lastStderrHadAssertion =
      /Assertion failed|UV_HANDLE_CLOSING/i.test(stderr);
    if (cliDiagnostics.lastStderrHadAssertion)
      throw new AppError(
        "FLYAI_PROCESS_FAILED",
        "FlyAI 运行环境报告异常，请检查服务端配置。",
      );
    let result;
    try {
      result = JSON.parse(stdout.trim());
    } catch {
      throw new AppError(
        "FLYAI_REQUEST_FAILED",
        "FlyAI 未返回完整结果，请稍后重试。",
      );
    }
    if (result.status !== 0) {
      const hint =
        String(result.message || "") + " " + String(result.systemMessage || "");
      if (/429|trial|quota|limit|额度|限流/i.test(hint))
        throw new AppError(
          "FLYAI_QUOTA_EXCEEDED",
          "FlyAI 查询额度不足或被限流，请核对正式 Key 和额度。",
          429,
        );
      throw new AppError(
        "FLYAI_PROVIDER_ERROR",
        "FlyAI 拒绝了本次查询，请检查查询条件与凭据。",
      );
    }
    if (!result.data || !Array.isArray(result.data.itemList))
      throw new AppError(
        "FLYAI_INVALID_OUTPUT",
        "FlyAI 返回的候选数据格式不正确。",
      );
    cliDiagnostics.lastExitCode = exitCode;
    cliDiagnostics.completeResponseAfterExitWarning = exitCode !== 0;
    return result;
  };
}
export const runFlyai = createFlyaiRunner();
export const parseNumber = (value) => {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) &&
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
    ? n
    : null;
};
export const validBookingUrl = (value) => {
  if (typeof value !== "string") return undefined;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      ["fliggy.com", "alitrip.com", "feizhu.com"].some(
        (host) => u.hostname === host || u.hostname.endsWith("." + host),
      )
    )
      return u.href;
  } catch {}
  return undefined;
};
export function normalizeHotel(item, city, queriedAt) {
  const price = parseNumber(item.price),
    rate = parseNumber(item.rate ?? item.score),
    year = String(item.decorationTime || "").match(/20\d{2}/)?.[0];
  if (
    price === null ||
    price < 0 ||
    !item.shId ||
    !item.name ||
    /计时|钟点|休息室|小时房|时租/.test(item.name)
  )
    return null;
  return {
    id: "flyai-" + item.shId,
    name: String(item.name),
    city,
    district: "",
    brand: String(item.brandName || ""),
    image:
      typeof item.mainPic === "string" && item.mainPic.startsWith("https://")
        ? item.mainPic
        : undefined,
    price,
    address: typeof item.address === "string" ? item.address : "",
    dataProvider: "flyai",
    overallRating: rate && rate <= 5 ? Math.round(rate * 20) / 10 : null,
    userScore: rate && rate <= 5 ? rate : null,
    subwayDistance: null,
    renovationYear: year ? Number(year) : null,
    starLevel: null,
    starLabel: String(item.star || ""),
    reviewCount: null,
    facilities: [],
    facilitiesKnown: false,
    lat: parseNumber(item.latitude),
    lng: parseNumber(item.longitude),
    coreDistance: null,
    reason: "来自 FlyAI 的实时候选。未返回的参数保留待核实。",
    source: "live",
    bookingUrl: validBookingUrl(item.detailUrl),
    queriedAt,
    missingFields: ["subwayDistance", "reviewCount", "facilities", "starLevel"],
    ratingNote: "供应方用户评分按 5 分制展示，综合展示为等比例 10 分换算。",
  };
}
export function distanceKm(a, b) {
  if (
    ![a?.lat, a?.lng, b?.lat, b?.lng].every(
      (x) => typeof x === "number" && Number.isFinite(x),
    )
  )
    return null;
  const r = Math.PI / 180,
    x = (b.lat - a.lat) * r,
    y = (b.lng - a.lng) * r,
    z =
      Math.sin(x / 2) ** 2 +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(z), Math.sqrt(1 - z));
}
export function filterLiveHotels(items, p) {
  const f = p,
    bounds = priceBounds(f.priceRange),
    known = (v, min) => !min || (v !== null && v !== undefined && v >= min);
  return items.filter(
    (h) =>
      h.price >= bounds.min &&
      h.price <= bounds.max &&
      known(h.overallRating, f.overallRating) &&
      known(h.renovationYear, f.minRenovationYear) &&
      known(h.starLevel, f.starLevel) &&
      known(h.reviewCount, f.reviewCount) &&
      known(h.userScore, f.userScore) &&
      (!f.selectedDistricts.length ||
        f.selectedDistricts.includes(h.district)) &&
      matchesHotelBrand(h, f.brandPreference) &&
      f.facilities.every((x) => h.facilities.includes(x)),
  );
}
export async function searchLiveHotels(p, signal, keyword) {
  if (!Number.isInteger(p.tripDays) || p.tripDays < 1 || p.tripDays > 30)
    throw new AppError("INVALID_TRIP_DAYS", "游玩天数应为 1–30 天。", 400);
  if (p.tripDays === 1 && !p.returnDate)
    throw new AppError(
      "HOTEL_STAY_REQUIRED",
      "一天行程暂未包含住宿日期，请先补齐晚于入住日的离店日期。",
      422,
    );
  if (!p.departureDate || p.dateMode === "fuzzy")
    throw new AppError(
      "EXACT_DATE_REQUIRED",
      "查询实时酒店价格需要精确入住日期，请先修改旅行信息。",
      422,
    );
  if (
    p.returnDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(p.returnDate) ||
      !Number.isFinite(Date.parse(p.returnDate)) ||
      new Date(p.returnDate).toISOString().slice(0, 10) !== p.returnDate)
  )
    throw new AppError("INVALID_RETURN_DATE", "请填写有效离店日期。", 422);
  const out =
    p.returnDate ||
    new Date(
      Date.parse(p.departureDate) + Math.max(1, p.tripDays - 1) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
  if (out <= p.departureDate)
    throw new AppError(
      "HOTEL_STAY_REQUIRED",
      "酒店离店日期应晚于入住日期；一天行程请补齐住宿日期。",
      422,
    );
  const args = [
    "--dest-name",
    p.destinationCity,
    "--check-in-date",
    p.departureDate,
    "--check-out-date",
    out,
    "--sort",
    "rate_desc",
  ];
  if (keyword) args.push("--key-words", keyword);
  if (p.primaryPlace?.name) args.push("--poi-name", p.primaryPlace.name);
  const bounds = priceBounds(p.priceRange);
  if (Number.isFinite(bounds.max)) args.push("--max-price", String(bounds.max));
  // Brand selections are an OR filter over returned candidates. The provider
  // keyword field has no documented OR semantics; never join groups into it.
  const result = await runFlyai("search-hotel", args, signal),
    queriedAt = new Date().toISOString();
  let hotels = result.data.itemList
    .map((item) => normalizeHotel(item, p.destinationCity, queriedAt))
    .filter(Boolean);
  if (p.primaryPlace)
    hotels = hotels.map((h) => {
      const d = distanceKm(h, p.primaryPlace);
      return {
        ...h,
        coreDistance: d === null ? null : Math.round(d * 10) / 10,
      };
    });
  if (process.env.AMAP_MAPS_API_KEY) {
    const { reverseDistrict } = await import("./mcp.js");
    // Limit concurrent MCP lookups; failed optional enrichment stays unknown.
    for (let i = 0; i < hotels.length; i += 3)
      await Promise.all(
        hotels.slice(i, i + 3).map(async (h) => {
          if (h.lat !== null && h.lng !== null) {
            try {
              h.district = await reverseDistrict(h.lng + "," + h.lat, signal);
            } catch (e) {
              if (p.selectedDistricts.length || signal?.aborted) throw e;
            }
          }
        }),
      );
  }
  for (let i = 0; i < hotels.length; i += 3)
    await Promise.all(
      hotels
        .slice(i, i + 3)
        .map(async (hotel) =>
          Object.assign(hotel, await hotelImage(hotel, signal)),
        ),
    );
  return {
    hotels: filterLiveHotels(hotels, p),
    metadata: {
      provider: "FlyAI",
      queriedAt,
      returnedCount: hotels.length,
      filteredCount: filterLiveHotels(hotels, p).length,
      platformHint:
        typeof result.systemMessage === "string" ? result.systemMessage : null,
      cliExitWarning: cliDiagnostics.completeResponseAfterExitWarning,
    },
  };
}
