import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import "./config.js";
import { AppError } from "./errors.js";
const execute = promisify(execFile);

export async function resolveFlyaiRuntime(env = process.env, run = execute) {
  const configured = env.FLYAI_NODE_PATH?.trim();
  const executable = configured || process.execPath;
  if (
    !path.isAbsolute(executable) ||
    !["node", "node.exe"].includes(path.basename(executable).toLowerCase())
  ) {
    throw new AppError(
      "FLYAI_RUNTIME_INVALID",
      "FlyAI 运行环境路径不正确，请检查服务端配置。",
      503,
    );
  }
  try {
    if (!fs.statSync(executable).isFile()) throw new Error("not a file");
  } catch {
    throw new AppError(
      "FLYAI_RUNTIME_UNAVAILABLE",
      "FlyAI 指定的运行环境不存在，请检查服务端配置。",
      503,
    );
  }
  const versionEnv = Object.fromEntries(
    ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP"]
      .filter((k) => env[k])
      .map((k) => [k, env[k]]),
  );
  let version;
  try {
    const { stdout } = await run(executable, ["--version"], {
      timeout: 5000,
      windowsHide: true,
      env: versionEnv,
    });
    version = stdout.trim();
    if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error("invalid version");
  } catch {
    throw new AppError(
      "FLYAI_RUNTIME_UNAVAILABLE",
      "无法启动 FlyAI 指定的运行环境，请检查服务端配置。",
      503,
    );
  }
  const expected = env.FLYAI_NODE_VERSION?.trim().replace(/^v/, "");
  if (expected && version !== "v" + expected) {
    throw new AppError(
      "FLYAI_RUNTIME_VERSION_MISMATCH",
      "FlyAI 运行版本与固定版本不一致，请检查服务端配置并重启。",
      503,
    );
  }
  return { executable, version };
}
