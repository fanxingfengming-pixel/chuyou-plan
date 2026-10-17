import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
export class RestartBudget {
  constructor({
    limit = 3,
    windowMs = 60000,
    delays = [1000, 3000, 5000],
  } = {}) {
    Object.assign(this, { limit, windowMs, delays });
    this.failures = [];
  }
  record(now = Date.now()) {
    this.failures = this.failures.filter((t) => now - t < this.windowMs);
    this.failures.push(now);
    return this.failures.length > this.limit
      ? null
      : this.delays[Math.min(this.failures.length - 1, this.delays.length - 1)];
  }
}
export function supervise(
  specs,
  {
    log = () => {},
    onState = () => {},
    onExhausted = () => {},
    spawnImpl = spawn,
    budgetOptions,
  } = {},
) {
  let stopping = false;
  const workers = specs.map((spec) => ({
    spec,
    child: null,
    timer: null,
    budget: new RestartBudget(budgetOptions),
  }));
  const state = () =>
    onState(
      workers.map((w) => ({
        name: w.spec.name,
        pid: w.child?.pid || null,
        restarting: !!w.timer,
      })),
    );
  const launch = (w) => {
    if (stopping) return;
    let child,
      finished = false;
    try {
      child = spawnImpl(w.spec.command, w.spec.args, {
        cwd: w.spec.cwd,
        env: w.spec.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      log(w.spec.name, "启动失败：" + (error.code || "SPAWN_ERROR"));
      return ended();
    }
    w.child = child;
    state();
    for (const stream of [child.stdout, child.stderr])
      if (stream)
        createInterface({ input: stream }).on("line", (line) =>
          log(w.spec.name, line),
        );
    function ended(code, signal) {
      if (finished) return;
      finished = true;
      w.child = null;
      state();
      if (stopping) return;
      const delay = w.budget.record();
      log(
        w.spec.name,
        "进程退出，代码 " + (code ?? "未知") + "，信号 " + (signal || "无"),
      );
      if (delay === null) {
        log(w.spec.name, "连续失败，已停止自动重启。");
        onExhausted(w.spec.name);
        return;
      }
      log(w.spec.name, "将在 " + delay + " 毫秒后重启，不重放任何查询。");
      w.timer = setTimeout(() => {
        w.timer = null;
        launch(w);
      }, delay);
      state();
    }
    child.once("error", (error) => ended(error.code || "SPAWN_ERROR", null));
    child.once("exit", ended);
  };
  for (const w of workers) launch(w);
  return {
    snapshot: () =>
      workers.map((w) => ({
        name: w.spec.name,
        pid: w.child?.pid || null,
        restarting: !!w.timer,
      })),
    stop: async () => {
      stopping = true;
      const running = [];
      for (const w of workers) {
        if (w.timer) {
          clearTimeout(w.timer);
          w.timer = null;
        }
        const child = w.child;
        if (!child) continue;
        running.push(
          new Promise((resolve) => {
            let complete = false;
            const done = () => {
              if (complete) return;
              complete = true;
              clearTimeout(force);
              clearTimeout(bound);
              resolve();
            };
            child.once("exit", done);
            const force = setTimeout(() => {
              if (child.exitCode === null) child.kill("SIGKILL");
            }, 5000);
            const bound = setTimeout(done, 7000);
            child.kill("SIGTERM");
          }),
        );
      }
      await Promise.all(running);
      state();
    },
  };
}
