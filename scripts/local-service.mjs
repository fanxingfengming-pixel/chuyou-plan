import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { supervise } from "./supervisor.mjs";
import { loadConfig } from "../server/config.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const dir = path.join(root, "data", "runtime"),
  stateFile = path.join(dir, "local-service.json"),
  logFile = path.join(dir, "local-service.log");
const script = fileURLToPath(import.meta.url),
  url = "http://127.0.0.1:5173";
const action = process.argv[2] || "start";
const readState = async () => {
  try {
    return JSON.parse(await fs.readFile(stateFile, "utf8"));
  } catch {
    return null;
  }
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function health() {
  try {
    return await (
      await fetch(url + "/api/travel/health", {
        signal: AbortSignal.timeout(900),
      })
    ).json();
  } catch {
    return null;
  }
}
async function portBusy() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 5173 });
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(800, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}
async function control(state) {
  const token = createHash("sha256").update(root).digest("hex").slice(0, 14);
  const expected =
    process.platform === "win32"
      ? "\\\\.\\pipe\\chuyou-plan-" + token + "-" + state?.runtimeId
      : path.join(dir, "control-" + state?.runtimeId + ".sock");
  if (
    state?.app !== "chuyou-plan" ||
    state.root !== root ||
    state.pipe !== expected ||
    !/^[a-f0-9-]{36}$/.test(state.runtimeId || "")
  )
    throw new Error("没有找到可核验的本项目运行记录；不会结束其他进程。");
  return new Promise((resolve, reject) => {
    const socket = net.connect(state.pipe);
    let data = "";
    socket.setTimeout(3000, () =>
      socket.destroy(new Error("停止请求超时；没有结束其他进程。")),
    );
    socket.once("connect", () =>
      socket.write(
        JSON.stringify({ command: "stop", runtimeId: state.runtimeId }) + "\n",
      ),
    );
    socket.on("data", (chunk) => {
      data += chunk;
      if (data.includes("\n")) {
        socket.end();
        resolve();
      }
    });
    socket.once("error", reject);
  });
}
async function start() {
  await fs.access(path.join(root, "dist", "index.html")).catch(() => {
    throw new Error("尚未构建网页，请先运行 npm run build。");
  });
  await fs.mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, "start.lock");
  let lock;
  try {
    lock = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let holder;
    try {
      holder = JSON.parse(await fs.readFile(lockPath, "utf8"));
    } catch {
      throw new Error("存在未完成的启动记录，请检查 data/runtime/start.lock。");
    }
    try {
      process.kill(holder.pid, 0);
      throw new Error("已有启动任务正在进行，请稍后查看状态。");
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
    await fs.unlink(lockPath);
    lock = await fs.open(lockPath, "wx");
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid }));
  try {
    if (await portBusy()) {
      const [h, s] = await Promise.all([health(), readState()]);
      if (
        h?.app === "chuyou-plan" &&
        h.runtimeMode === "local" &&
        s?.runtimeId === h.runtimeId
      ) {
        console.log("出游plan 已在运行：" + url);
        return;
      }
      throw new Error(
        "5173 端口已被其他或开发服务占用。请先关闭原服务；本次不会换端口或结束其他进程。",
      );
    }
    const old = await readState();
    if (old && ["starting", "running"].includes(old.status)) {
      try {
        process.kill(old.supervisorPid, 0);
        throw new Error("本项目正在启动或恢复，请稍后查看 npm run status。");
      } catch (e) {
        if (e.code !== "ESRCH") throw e;
      }
    }
    const runtimeId = randomUUID();
    const child = spawn(process.execPath, [script, "supervise", runtimeId], {
      cwd: root,
      env: process.env,
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });
    const spawnError = new Promise((resolve) => child.once("error", resolve));
    child.unref();
    for (let i = 0; i < 30; i++) {
      const h = await health();
      if (h?.runtimeId === runtimeId) {
        console.log(
          "出游plan 已启动：" +
            url +
            "\n后台独立运行；关闭对话不会结束服务。\n停止：npm run stop",
        );
        return;
      }
      const s = await readState();
      if (s?.runtimeId === runtimeId && s.status === "failed")
        throw new Error("服务未能启动，诊断记录：" + logFile);
      const error = await Promise.race([spawnError, pause(400)]);
      if (error) throw new Error("后台服务启动失败。");
    }
    throw new Error(
      "服务尚未就绪，请查看 npm run status 和 " +
        logFile +
        "。不会自动重发查询。",
    );
  } finally {
    await lock.close();
    await fs.unlink(lockPath).catch(() => {});
  }
}
async function run() {
  await fs.mkdir(dir, { recursive: true });
  const runtimeId = process.argv[3];
  if (!/^[a-f0-9-]{36}$/.test(runtimeId || ""))
    throw new Error("运行标识无效。");
  const token = createHash("sha256").update(root).digest("hex").slice(0, 14);
  const pipe =
    process.platform === "win32"
      ? "\\\\.\\pipe\\chuyou-plan-" + token + "-" + runtimeId
      : path.join(dir, "control-" + runtimeId + ".sock");
  const config = loadConfig();
  const secrets = [config.apiKey, config.amapKey].filter(
    (x) => typeof x === "string" && x.length > 7,
  );
  const redact = (line) => {
    let s = String(line).replace(/\u001b\[[0-9;]*m/g, "");
    for (const key of secrets)
      s = s
        .split(key)
        .join("[已隐藏]")
        .split(encodeURIComponent(key))
        .join("[已隐藏]");
    return s
      .replace(/(Bearer\s+)\S+/gi, "$1[已隐藏]")
      .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[已隐藏]");
  };
  let logQueue = Promise.resolve(),
    writes = Promise.resolve(),
    closing = false,
    manager;
  const record = {
    app: "chuyou-plan",
    root,
    runtimeId,
    pipe,
    port: 5173,
    supervisorPid: process.pid,
    status: "starting",
    startedAt: new Date().toISOString(),
    workers: [],
  };
  const persist = () => {
    const snapshot = JSON.stringify(record, null, 2);
    writes = writes
      .catch(() => {})
      .then(async () => {
        await fs.writeFile(stateFile + ".tmp", snapshot);
        await fs.rename(stateFile + ".tmp", stateFile);
      });
    return writes;
  };
  const log = (name, line) => {
    const safe =
      new Date().toISOString() + " [" + name + "] " + redact(line) + "\n";
    logQueue = logQueue
      .catch(() => {})
      .then(() => fs.appendFile(logFile, safe));
  };
  const server = net.createServer((socket) => {
    let data = "";
    socket.setTimeout(3000, () => socket.destroy());
    socket.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024) {
        socket.destroy();
        return;
      }
      if (!data.includes("\n")) return;
      try {
        const command = JSON.parse(data);
        if (command.runtimeId !== runtimeId || command.command !== "stop") {
          socket.destroy();
          return;
        }
        socket.end("stopping\n");
        void finish("stopped");
      } catch {
        socket.destroy();
      }
    });
  });
  async function finish(status) {
    if (closing) return;
    closing = true;
    record.status = status;
    log("运行", "服务正在结束：" + status);
    server.close();
    await manager?.stop();
    record.status = status;
    record.workers = [];
    await persist();
    await logQueue;
    process.exitCode = status === "failed" ? 1 : 0;
  }
  server.once("error", () => {
    log("运行", "控制通道无法启动。");
    void finish("failed");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(pipe, resolve);
  });
  await persist();
  manager = supervise(
    [
      {
        name: "本机服务",
        command: process.execPath,
        args: [path.join(root, "server", "app.js")],
        cwd: root,
        env: {
          ...process.env,
          TRAVEL_API_PORT: "5173",
          TRAVEL_SERVE_DIST: "1",
          TRAVEL_RUNTIME_ID: runtimeId,
        },
      },
    ],
    {
      log,
      onState: (workers) => {
        record.workers = workers;
        if (!closing) record.status = "running";
        void persist();
      },
      onExhausted: () => void finish("failed"),
    },
  );
  log("运行", "已启动，仅监听本机 127.0.0.1:5173。");
  process.on("SIGINT", () => void finish("stopped"));
  process.on("SIGTERM", () => void finish("stopped"));
}
try {
  if (action === "supervise") await run();
  else if (action === "start") await start();
  else if (action === "stop") {
    const state = await readState();
    if (!state || ["stopped", "failed"].includes(state.status)) {
      console.log("本项目稳定服务未运行；没有结束其他进程。");
    } else {
      await control(state);
      let confirmedStopped = false;
      for (let i = 0; i < 30; i++) {
        const s = await readState();
        if (s?.runtimeId === state.runtimeId && s.status === "stopped") {
          confirmedStopped = true;
          console.log("出游plan 已停止，草稿与图片缓存保留。");
          break;
        }
        await pause(300);
      }
      if (!confirmedStopped) throw new Error("停止尚未确认，请运行 npm run status 并检查 data/runtime/local-service.log；没有结束其他进程。");
    }
  } else if (action === "status") {
    const [s, h] = await Promise.all([readState(), health()]);
    console.log(
      JSON.stringify(
        {
          app: "出游plan",
          url,
          localReady:
            h?.app === "chuyou-plan" &&
            h?.runtimeMode === "local" &&
            h?.runtimeId === s?.runtimeId,
          status: s?.status || "not_started",
          log: logFile,
        },
        null,
        2,
      ),
    );
  } else throw new Error("支持 start / stop / status。");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
