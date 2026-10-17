import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MODE", "development");
  vi.stubEnv("VITE_TRAVEL_DATA_MODE", "live");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("网络失败转换为中文错误且不自动重复提交", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetch);
  const { requestJSON } = await import("../src/planning/serviceClient");
  await expect(
    requestJSON("recommend-places", { destinationCity: "杭州" }),
  ).rejects.toMatchObject({
    code: "SERVICE_UNREACHABLE",
    message: expect.stringContaining("本地查询服务"),
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("供应方额度错误保留分类与中文恢复提示", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "FLYAI_QUOTA_EXCEEDED",
              message: "供应方额度不足，请稍后重试。",
            },
          }),
          { status: 429 },
        ),
      ),
  );
  const { requestJSON } = await import("../src/planning/serviceClient");
  await expect(requestJSON("flyai/search-hotels", {})).rejects.toMatchObject({
    code: "FLYAI_QUOTA_EXCEEDED",
    status: 429,
  });
});
it("超时与用户主动取消分开处理，不伪装成供应方空结果", async () => {
  const timer = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(timer.signal);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      timer.abort();
      return Promise.reject(new Error("timeout"));
    }),
  );
  const { requestJSON } = await import("../src/planning/serviceClient");
  await expect(requestJSON("recommend-places", {})).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  const user = new AbortController();
  user.abort();
  await expect(
    requestJSON("recommend-places", {}, user.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
});
it("代理返回非 JSON 错误时给出中文提示，能力声明拒绝无效结构", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("proxy failed", { status: 500 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ version: 1, hotelFilters: {} })),
    );
  vi.stubGlobal("fetch", fetch);
  const { requestJSON, getHotelCapabilities } =
    await import("../src/planning/serviceClient");
  await expect(requestJSON("recommend-places", {})).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
    status: 500,
  });
  await expect(getHotelCapabilities()).rejects.toMatchObject({
    code: "INVALID_CAPABILITIES",
  });
});
