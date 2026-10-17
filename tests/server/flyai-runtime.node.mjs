import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFlyaiRuntime } from "../../server/flyai-runtime.js";
import { createFlyaiRunner } from "../../server/flyai.js";

test("FlyAI 使用独立配置的 Node，实际版本与固定版本一致", async () => {
  const runtime = await resolveFlyaiRuntime();
  assert.equal(runtime.version, "v24.20.0");
  assert.notEqual(
    runtime.executable.toLowerCase(),
    process.execPath.toLowerCase(),
  );
});
test("指定环境缺失或版本不匹配时不退回旧 Node", async () => {
  await assert.rejects(
    () =>
      resolveFlyaiRuntime({
        FLYAI_NODE_PATH: "D:/aaa飞猪/nonexistent/node.exe",
      }),
    { code: "FLYAI_RUNTIME_UNAVAILABLE" },
  );
  await assert.rejects(
    () => resolveFlyaiRuntime({ ...process.env, FLYAI_NODE_VERSION: "0.0.0" }),
    { code: "FLYAI_RUNTIME_VERSION_MISMATCH" },
  );
});
test("即使成功 JSON 已输出，异常退出仍报告失败", async () => {
  const run = createFlyaiRunner(async (_file, args) => {
    if (args[0] === "--version") return { stdout: "v24.20.0\n", stderr: "" };
    throw Object.assign(new Error("private upstream detail"), {
      code: 3221226505,
      stdout: JSON.stringify({ status: 0, data: { itemList: [] } }),
      stderr: "Assertion failed: UV_HANDLE_CLOSING",
    });
  });
  await assert.rejects(() => run("search-hotel", []), {
    code: "FLYAI_PROCESS_FAILED",
  });
});
test("正常退出也必须校验完整 JSON 与供应方状态", async () => {
  for (const [stdout, code] of [
    ['{"status":0,', "FLYAI_REQUEST_FAILED"],
    [
      JSON.stringify({ status: 1, message: "provider error" }),
      "FLYAI_PROVIDER_ERROR",
    ],
    [JSON.stringify({ status: 0, data: {} }), "FLYAI_INVALID_OUTPUT"],
  ]) {
    const run = createFlyaiRunner(async (_file, args) =>
      args[0] === "--version"
        ? { stdout: "v24.20.0\n", stderr: "" }
        : { stdout, stderr: "" },
    );
    await assert.rejects(() => run("search-hotel", []), { code });
  }
  const run = createFlyaiRunner(async (_file, args) => ({
    stdout:
      args[0] === "--version"
        ? "v24.20.0\n"
        : JSON.stringify({ status: 0, data: { itemList: [] } }),
    stderr: "",
  }));
  assert.deepEqual((await run("search-hotel", [])).data.itemList, []);
});
