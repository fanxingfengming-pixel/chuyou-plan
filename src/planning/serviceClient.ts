export interface QueryProgress {
  operation?: string;
  stage: string;
  completed?: number;
  total?: number;
  elapsedMs?: number;
  estimateRangeMs?: [number, number] | null;
}
export type ProgressCallback = (value: QueryProgress) => void;
export const progressSubscribers = new Set<ProgressCallback>();
export function publishProgress(value: QueryProgress) {
  progressSubscribers.forEach((fn) => fn(value));
}
import type { HotelCapabilities } from "./types";
export const isLiveMode =
  import.meta.env.MODE !== "test" &&
  import.meta.env.VITE_TRAVEL_DATA_MODE !== "mock";
export const apiBase = isLiveMode
  ? ((import.meta.env.VITE_TRAVEL_API_BASE || "/api/travel") as string)
  : undefined;
export class TravelServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "TravelServiceError";
  }
}
const offlineMessage =
  "本地查询服务暂不可用。请启动出游plan，待服务恢复后点击重试。";
export async function requestJSON<T>(
  service: string,
  payload?: unknown,
  signal?: AbortSignal,
  onProgress?: ProgressCallback,
): Promise<T> {
  if (!apiBase?.startsWith("/") || apiBase.startsWith("//"))
    throw new TravelServiceError(
      "INVALID_API_BASE",
      "查询服务地址配置不正确，请检查本地启动配置。",
    );
  const timeout = AbortSignal.timeout(payload === undefined ? 5000 : 240000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(apiBase + "/" + service, {
      method: payload === undefined ? "GET" : "POST",
      ...(payload === undefined
        ? {}
        : {
            headers: {
              "Content-Type": "application/json",
              ...(onProgress ? { Accept: "text/event-stream" } : {}),
            },
            body: JSON.stringify(payload),
          }),
      signal: combined,
    });
  } catch {
    if (signal?.aborted) throw new DOMException("查询已取消", "AbortError");
    if (timeout.aborted)
      throw new TravelServiceError(
        "REQUEST_TIMEOUT",
        "查询等待时间较长。信息已保留，请稍后主动重试。",
      );
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("travel-service-unreachable"));
    throw new TravelServiceError("SERVICE_UNREACHABLE", offlineMessage);
  }

  if (
    response.ok &&
    response.headers?.get("Content-Type")?.includes("text/event-stream")
  ) {
    if (!response.body)
      throw new TravelServiceError(
        "INVALID_RESPONSE",
        "查询进度连接不可用，请主动重试。",
      );
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      result: unknown,
      finished = false,
      streamError: TravelServiceError | undefined;
    const block = (value: string) => {
      let name = "message";
      const lines: string[] = [];
      for (const line of value.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
      }
      if (!lines.length) return;
      let data: unknown;
      try {
        data = JSON.parse(lines.join("\n"));
      } catch {
        throw new TravelServiceError(
          "INVALID_RESPONSE",
          "查询进度格式不正确，请主动重试。",
        );
      }
      if (name === "progress") {
        const p = data as QueryProgress;
        if (typeof p.stage === "string" && p.stage.length <= 200)
          onProgress?.(p);
      } else if (name === "result") {
        result = data;
        finished = true;
      } else if (name === "error") {
        const e = data as { error?: { code?: string; message?: string } };
        streamError = new TravelServiceError(
          e.error?.code || "QUERY_FAILED",
          e.error?.message || "查询未完成，请主动重试。",
        );
      }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder
          .decode(value, { stream: !done })
          .replace(/\r\n/g, "\n");
        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          block(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
        if (done) break;
        if (buffer.length > 2_000_000) throw new Error("too large");
      }
      if (buffer.trim()) block(buffer);
    } catch (error) {
      if (signal?.aborted) throw new DOMException("查询已取消", "AbortError");
      if (error instanceof TravelServiceError) throw error;
      throw new TravelServiceError(
        "PROGRESS_INTERRUPTED",
        "查询连接已中断，信息已保留，请主动重试。",
      );
    } finally {
      reader.releaseLock();
    }
    if (streamError) throw streamError;
    if (!finished)
      throw new TravelServiceError(
        "PROGRESS_INTERRUPTED",
        "查询连接已中断，信息已保留，请主动重试。",
      );
    return result as T;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new TravelServiceError(
      "INVALID_RESPONSE",
      response.ok
        ? "查询返回的信息格式不正确，请重试。"
        : "本地服务或查询接口暂不可用，请检查服务状态后重试。",
      response.status,
    );
  }
  if (!response.ok) {
    const error = (body as { error?: { code?: unknown; message?: unknown } })
      ?.error;
    const code =
      typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : "QUERY_FAILED";
    const message =
      typeof error?.message === "string" &&
      error.message.length <= 1000 &&
      /[\u4e00-\u9fff]/.test(error.message)
        ? error.message
        : response.status === 429
          ? "查询额度不足或请求过于频繁，请稍后重试。"
          : "查询服务暂未完成本次请求，请稍后重试。";
    throw new TravelServiceError(code, message, response.status);
  }
  return body as T;
}
export async function getServiceHealth(signal?: AbortSignal) {
  const data = await requestJSON<{
    app: string;
    localService: string;
    runtimeMode: string;
  }>("health", undefined, signal);
  if (data.app !== "chuyou-plan" || data.localService !== "ready")
    throw new TravelServiceError(
      "SERVICE_MISMATCH",
      "当前地址未连接到出游plan 查询服务。",
    );
  return data;
}
export async function getHotelCapabilities(
  signal?: AbortSignal,
): Promise<HotelCapabilities> {
  if (!isLiveMode)
    return {
      version: 1,
      provider: "模拟目录",
      hotelFilters: {
        priceRange: true,
        overallRating: true,
        minRenovationYear: true,
        userScore: true,
        selectedDistricts: true,
        brandPreference: true,
        starLevel: true,
        reviewCount: true,
        facilities: true,
      },
    };
  const data = await requestJSON<HotelCapabilities>(
    "capabilities",
    undefined,
    signal,
  );
  const keys = [
    "priceRange",
    "overallRating",
    "minRenovationYear",
    "userScore",
    "selectedDistricts",
    "brandPreference",
    "starLevel",
    "reviewCount",
    "facilities",
  ] as const;
  if (
    data?.version !== 1 ||
    !data.hotelFilters ||
    !keys.every((k) => typeof data.hotelFilters[k] === "boolean")
  )
    throw new TravelServiceError(
      "INVALID_CAPABILITIES",
      "暂未取得可用筛选范围，请检查服务后重试。",
    );
  return data;
}
export function serviceErrorMessage(error: unknown) {
  if (error instanceof TravelServiceError) return error.message;
  if (
    error instanceof Error &&
    /[\u4e00-\u9fff]/.test(error.message) &&
    error.message.length < 1000
  )
    return error.message;
  return "查询暂未完成，请检查服务状态后主动重试。";
}
