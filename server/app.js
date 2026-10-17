import { amapDiagnostics } from "./amap-service.js";
import { getPlaceCatalog } from "./place-catalog.js";
import { serveCachedImage } from "./image-cache.js";
import { serveStaticSite } from "./static-site.js";
import { capabilities } from "./capabilities.js";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { handlers } from "./travel-api.js";
import { AppError, publicError } from "./errors.js";
import { flyaiConfigured, cliDiagnostics } from "./flyai.js";
import { closeMcpClients } from "./mcp.js";
export function createTravelServer(options = {}) {
  const serveDist = options.serveDist ?? process.env.TRAVEL_SERVE_DIST === "1";
  const serviceHandlers = options.handlers ?? handlers;
  const startedAt = new Date().toISOString();
  const config = loadConfig(),
    calls = new Map();
  let active = 0;
  const send = (res, status, data) => {
    if (res.destroyed) return;
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(data));
  };
  return http.createServer(async (req, res) => {
    const controller = new AbortController();
    let streaming = false;
    const event = (name, data) => {
      if (!res.destroyed)
        res.write(
          "event: " + name + "\ndata: " + JSON.stringify(data) + "\n\n",
        );
    };
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const allowedHosts = new Set([
        "127.0.0.1:" + config.port,
        "localhost:" + config.port,
        "127.0.0.1:" + req.socket.localPort,
        "localhost:" + req.socket.localPort,
        "127.0.0.1:5173",
        "localhost:5173",
        "127.0.0.1:4173",
        "localhost:4173",
      ]);
      if (!allowedHosts.has(req.headers.host))
        throw new AppError(
          "FORBIDDEN_HOST",
          "此服务只允许从本机网页访问。",
          403,
        );
      if (
        req.headers.origin &&
        ![
          "http://127.0.0.1:5173",
          "http://localhost:5173",
          "http://127.0.0.1:4173",
          "http://localhost:4173",
          "http://127.0.0.1:" + config.port,
        ].includes(req.headers.origin)
      )
        throw new AppError("FORBIDDEN_ORIGIN", "请求来源不受支持。", 403);
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new AppError("FORBIDDEN_ORIGIN", "请求来源不受支持。", 403);
      const pathname = new URL(req.url, "http://127.0.0.1").pathname;
      if (await serveCachedImage(req, res, pathname)) return;
      if (req.method === "GET" && pathname === "/api/travel/health") {
        send(res, 200, {
          app: "chuyou-plan",
          mode: "live",
          runtimeMode: serveDist ? "local" : "development",
          runtimeId: process.env.TRAVEL_RUNTIME_ID || null,
          startedAt,
          localService: "ready",
          providerStatusNote:
            "凭据配置状态不代表供应方当前可用；实际可用性以查询结果为准。",
          agent: {
            configured: config.configured,
            version: config.agentVersion,
          },
          amap: { configured: !!config.amapKey, ...amapDiagnostics },
          flyai: {
            configured: flyaiConfigured(),
            runtimeVersion: cliDiagnostics.runtimeVersion,
            queryCount: cliDiagnostics.queryCount,
            failedProcessCount: cliDiagnostics.failedProcessCount,
            cliExitWarning: cliDiagnostics.completeResponseAfterExitWarning,
          },
          rail: { provider: "12306 MCP" },
          readOnly: true,
        });
        return;
      }
      if (req.method === "GET" && pathname === "/api/travel/capabilities") {
        send(res, 200, capabilities);
        return;
      }
      if (
        serveDist &&
        (await serveStaticSite(req, res, pathname, options.staticRoot))
      )
        return;
      const service = pathname.replace(/^\/api\/travel\//, "");
      if (req.method !== "POST" || !serviceHandlers[service])
        throw new AppError("NOT_FOUND", "接口不存在。", 404);
      if (
        !String(req.headers["content-type"] || "").startsWith(
          "application/json",
        )
      )
        throw new AppError("INVALID_CONTENT_TYPE", "请求格式不正确。", 415);
      if (active >= 4)
        throw new AppError("BUSY", "当前查询较多，请稍后重试。", 429);
      const minute = Math.floor(Date.now() / 60000),
        count = calls.get(minute) || 0;
      if (count >= 24)
        throw new AppError("RATE_LIMITED", "查询过于频繁，请稍后再试。", 429);
      calls.clear();
      calls.set(minute, count + 1);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 256 * 1024)
          throw new AppError(
            "BODY_TOO_LARGE",
            "规划数据过大，请减少查询内容。",
            413,
          );
        chunks.push(chunk);
      }
      let payload;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new AppError("INVALID_JSON", "请求数据不是有效 JSON。", 400);
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new AppError("INVALID_PAYLOAD", "请求数据应为对象。", 400);
      active++;
      const began = Date.now();
      if (String(req.headers.accept || "").includes("text/event-stream")) {
        streaming = true;
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Accel-Buffering": "no",
        });
        res.flushHeaders();
      }
      const timingKey =
        service +
        (["area-recommendations", "amap/search-place"].includes(service)
          ? ":search"
          : "");

      let timingStore=null,estimate=null;
      // Progress estimates are optional; telemetry cannot mask provider errors.
      if(!options.handlers){try{timingStore=getPlaceCatalog();estimate=timingStore.estimate(timingKey);}catch{}}

      const progress = (value) => {
        if (streaming)
          event("progress", {
            ...value,
            elapsedMs: Date.now() - began,
            estimateRangeMs: estimate,
          });
      };
      const stage =
        service === "flyai/search-hotels"
          ? "正在查询酒店并整理候选"
          : service === "transport/compare"
            ? "正在查询铁路、航班并比较"
            : service === "parse-trip"
              ? "正在解析旅行信息"
              : "正在等待查询返回";
      progress({ stage });
      const heartbeat = setInterval(
        () => progress({ stage: currentStage }),
        5000,
      );
      let currentStage = stage;
      try {
        const result = await serviceHandlers[service](
          payload,
          AbortSignal.any([controller.signal, AbortSignal.timeout(240000)]),
          (value) => {
            currentStage = value.stage;
            progress(value);
          },
        );
        if (
          !payload.catalogOnly &&
          !(
            Array.isArray(result) &&
            result.length &&
            result.every((p) => p.loadedFrom === "catalog")
          )
        )
          try{timingStore?.timing(timingKey, Date.now() - began);}catch{}
        if (streaming) {
          event("result", result);
          res.end();
        } else send(res, 200, result);
      } finally {
        clearInterval(heartbeat);
        active--;
      }
    } catch (error) {
      const safe = publicError(error);
      if (safe.status >= 500)
        console.warn("查询未完成：" + safe.body.error.code);
      if (streaming) {
        event("error", safe.body);
        res.end();
      } else send(res, safe.status, safe.body);
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig(),
    server = createTravelServer();
  server.listen(config.port, "127.0.0.1", () =>
    console.log(
      "旅行服务已启动：http://127.0.0.1:" + config.port + "（真实数据模式）",
    ),
  );
  const close = () =>
    server.close(async () => {
      await closeMcpClients();
      process.exit(0);
    });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
