import { AppError } from "./errors.js";
import { collectTurn } from "./sse.js";

export class ManagedAgentClient {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    let response;
    try {
      response = await this.fetch(this.config.baseUrl + path, {
        ...options,
        redirect: "error",
        headers: {
          Authorization: "Bearer " + this.config.apiKey,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new AppError(
        "UPSTREAM_UNREACHABLE",
        "无法连接百炼，请检查网络、地域和 Workspace 配置。",
      );
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const mapping = {
        401: [
          "UPSTREAM_AUTH_FAILED",
          "百炼认证失败，请检查服务端 API Key。",
          502,
        ],
        403: [
          "UPSTREAM_FORBIDDEN",
          "百炼拒绝访问，请检查工作空间与 Agent 权限。",
          502,
        ],
        404: [
          "UPSTREAM_NOT_FOUND",
          "百炼资源不存在，请核对 Agent、Environment 或 Workspace。",
          502,
        ],
        429: ["UPSTREAM_RATE_LIMITED", "百炼请求过于频繁，请稍后再试。", 429],
      };
      const [code, message, status] = mapping[response.status] || [
        "UPSTREAM_REQUEST_FAILED",
        "百炼请求失败，请检查控制台的 Agent 和运行环境状态。",
        502,
      ];
      // Upstream bodies may contain secrets, prompts, tool arguments, or internal URLs.
      throw new AppError(code, message, status);
    }
    return response;
  }

  async createSession(signal) {
    const agent = { type: "agent", id: this.config.agentId };
    if (this.config.agentVersion) agent.version = this.config.agentVersion;
    const response = await this.request("/sessions", {
      method: "POST",
      signal,
      body: JSON.stringify({
        agent,
        environment_id: this.config.environmentId,
        title: "AI 旅行决策助手",
      }),
    });
    let session;
    try {
      session = await response.json();
    } catch {
      throw new AppError("UPSTREAM_PROTOCOL", "百炼会话响应格式无法识别。");
    }
    if (!/^sesn_[a-zA-Z0-9_-]+$/.test(session.id || "")) {
      throw new AppError("UPSTREAM_PROTOCOL", "百炼没有返回有效的会话标识。");
    }
    return session.id;
  }

  async chat(sessionId, message, signal) {
    const controller = new AbortController();
    const combinedSignal = AbortSignal.any([signal, controller.signal]);
    const path = "/sessions/" + encodeURIComponent(sessionId) + "/events";
    let submitted = false;
    try {
      // Subscribe first: the stream is live, so posting first can lose a fast answer.
      const stream = await this.request(path + "/stream", {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: combinedSignal,
      });
      if (!stream.headers.get("content-type")?.includes("text/event-stream")) {
        await stream.body?.cancel().catch(() => {});
        throw new AppError(
          "UPSTREAM_PROTOCOL",
          "百炼未返回 SSE 事件流，请核对 Managed Agent 接口。",
        );
      }
      const turn = collectTurn(stream.body);
      turn.catch(() => {}); // Observe early stream failures while POST is in flight.
      submitted = true;
      const send = this.request(path, {
        method: "POST",
        signal: combinedSignal,
        body: JSON.stringify({
          input: [
            {
              role: "user",
              type: "message",
              content: [{ type: "text", text: message }],
            },
          ],
        }),
      }).then(async (response) => {
        await response.body?.cancel().catch(() => {});
      });
      const [, text] = await Promise.all([send, turn]);
      return text;
    } catch (error) {
      if (submitted) {
        // Best effort only. Never automatically resend a potentially accepted message.
        await this.request(path, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            input: [{ role: "user", type: "interrupt" }],
          }),
        })
          .then((response) => response.body?.cancel())
          .catch(() => {});
      }
      if (signal.aborted) {
        throw new AppError(
          "AGENT_TIMEOUT",
          "等待百炼超时或连接已断开。本轮可能已被受理，请稍后再试或开始新对话。",
          504,
        );
      }
      throw error;
    } finally {
      controller.abort();
    }
  }
}
