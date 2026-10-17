// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MODE", "development");
  vi.stubEnv("VITE_TRAVEL_DATA_MODE", "live");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("查询进度协议", () => {
  it("拆分UTF8字符仍只交付一次最终结果", async () => {
    const bytes = new TextEncoder().encode(
      'event: progress\ndata: {"stage":"正在核实地点"}\n\nevent: result\ndata: {"ok":true}\n\n',
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3)
          controller.enqueue(bytes.slice(i, i + 3));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    const { requestJSON } = await import("../src/planning/serviceClient");
    const callback = vi.fn();
    expect(await requestJSON("test", {}, undefined, callback)).toEqual({
      ok: true,
    });
    expect(callback).toHaveBeenCalledWith({ stage: "正在核实地点" });
  });
  it("断流没有最终结果时报错，不自动重放", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('event: progress\ndata: {"stage":"等待中"}\n\n', {
          headers: { "Content-Type": "text/event-stream" },
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const { requestJSON } = await import("../src/planning/serviceClient");
    await expect(
      requestJSON("test", {}, undefined, () => {}),
    ).rejects.toMatchObject({ code: "PROGRESS_INTERRUPTED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
