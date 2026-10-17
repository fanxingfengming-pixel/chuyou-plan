import { AppError } from "./errors.js";

// UTF-8 decoder is incremental: Chinese characters and SSE frames may span chunks.
export async function* readSse(body) {
  if (!body)
    throw new AppError("UPSTREAM_PROTOCOL", "百炼未返回可读取的事件流。");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data = [];
  let bytes = 0;
  const parse = () => {
    if (!data.length) return null;
    const raw = data.join("\n");
    data = [];
    if (raw === "[DONE]") return null;
    try {
      return JSON.parse(raw);
    } catch {
      throw new AppError(
        "UPSTREAM_PROTOCOL",
        "百炼事件格式无法识别，请核对接口配置。",
      );
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        bytes += value.byteLength;
        if (bytes > 8 * 1024 * 1024)
          throw new AppError("OUTPUT_LIMIT", "本轮结果过长，请缩小问题范围。");
      }
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) {
          const event = parse();
          if (event) yield event;
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (done) {
        if (buffer.startsWith("data:"))
          data.push(buffer.slice(5).replace(/^ /, ""));
        const event = parse();
        if (event) yield event;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function collectTurn(body) {
  const messages = [];
  const seen = new Set();
  let running = false;
  for await (const event of readSse(body)) {
    if (event.id && seen.has(event.id)) continue;
    if (event.id) seen.add(event.id);
    if (event.type === "error") {
      throw new AppError(
        "AGENT_RUN_FAILED",
        "百炼处理失败，请检查 Agent 状态或稍后重试。",
      );
    }
    if (
      event.type === "tool_approval_request" ||
      event.type === "function_call"
    ) {
      throw new AppError(
        "AGENT_REQUIRES_ACTION",
        "Agent 正在等待工具审批或外部函数结果，请在百炼控制台处理后开始新对话。",
        409,
      );
    }
    if (event.type === "message" && event.role === "assistant") {
      const text = (event.content || [])
        .map((block) =>
          block.type === "text"
            ? block.text
            : block.type === "refusal"
              ? block.refusal
              : "",
        )
        .filter((value) => typeof value === "string" && value)
        .join("\n");
      if (text) messages.push(text);
      if (messages.join("").length > 100000)
        throw new AppError("OUTPUT_LIMIT", "本轮结果过长，请缩小问题范围。");
    }
    if (event.type !== "session_status") continue;
    const state =
      event.content?.find((block) => block.type === "data")?.data || {};
    if (state.session_status === "running") running = true;
    if (state.session_status === "terminated")
      throw new AppError(
        "SESSION_TERMINATED",
        "百炼会话已结束，请开始新对话。",
        409,
      );
    if (state.session_status !== "idle") continue;
    if (state.stop_reason?.type === "requires_action") {
      throw new AppError(
        "AGENT_REQUIRES_ACTION",
        "Agent 需要工具审批或外部函数结果，请在百炼控制台处理后开始新对话。",
        409,
      );
    }
    if (state.stop_reason?.type === "retries_exhausted")
      throw new AppError(
        "AGENT_RUN_FAILED",
        "百炼本轮重试已耗尽，请稍后再试。",
      );
    // Ignore initial idle notifications. Completion must belong to an observed turn.
    if (
      (running || messages.length) &&
      state.stop_reason?.type === "end_turn"
    ) {
      if (!messages.length)
        throw new AppError(
          "EMPTY_AGENT_RESPONSE",
          "Agent 本轮没有返回文字，请调整问题后重试。",
        );
      return messages.join("\n\n");
    }
  }
  throw new AppError(
    "UPSTREAM_INTERRUPTED",
    "百炼事件流提前结束，本轮结果未确认完成。请稍后再试或开始新对话。",
  );
}
