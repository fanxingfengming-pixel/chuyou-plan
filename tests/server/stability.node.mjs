import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createTravelServer } from "../../server/app.js";
import { AppError } from "../../server/errors.js";
import { RestartBudget, supervise } from "../../scripts/supervisor.mjs";
import {
  getHotelHighlights,
  factHotelReason,
} from "../../shared/hotel-ranking.js";
import { assertSupportedFilters } from "../../server/capabilities.js";
const base = path.resolve("artifacts/stability");
await fs.mkdir(base, { recursive: true });
const root = await fs.mkdtemp(path.join(base, "static-test-"));
await fs.mkdir(path.join(root, "assets"));
await fs.writeFile(
  path.join(root, "index.html"),
  "<!doctype html><title>stable fixture</title>",
);
await fs.writeFile(
  path.join(root, "assets", "test.js"),
  "console.log('safe');",
);
after(async () => {
  assert.ok(root.startsWith(base + path.sep + "static-test-"));
  await fs.rm(root, { recursive: true, force: true });
});
test("稳定模式提供独立路由与 API，私密路径及未知 API 不能回退成 HTML", async () => {
  const server = createTravelServer({ serveDist: true, staticRoot: root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const page = await fetch(url + "/plan/places");
    assert.equal(page.status, 200);
    assert.match(await page.text(), /stable fixture/);
    const script = await fetch(url + "/assets/test.js");
    assert.match(script.headers.get("cache-control"), /immutable/);
    const head = await fetch(url + "/plan/route", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const health = await (await fetch(url + "/api/travel/health")).json();
    assert.equal(health.runtimeMode, "local");
    assert.equal(health.localService, "ready");
    assert.match(health.providerStatusNote, /不代表/);
    const caps = await (await fetch(url + "/api/travel/capabilities")).json();
    assert.equal("subwayDistance" in caps.hotelFilters, false);
    assert.equal(caps.hotelFilters.overallRating, true);
    for (const route of [
      "/.env.server",
      "/data/image-cache/index.json",
      "/server/app.js",
      "/assets/%2e%2e%2f.env.server",
    ])
      assert.equal((await fetch(url + route)).status, 403);
    assert.equal((await fetch(url + "/api/travel/unknown")).status, 404);
    assert.equal((await fetch(url + "/assets/missing.js")).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("不支持筛选在调用供应方之前明确拒绝，不能静默放宽", () => {
  assert.throws(
    () =>
      assertSupportedFilters({
        starLevel: 0,
        reviewCount: 500,
        facilities: [],
      }),
    (e) => e.code === "UNSUPPORTED_FILTERS" && e.status === 422,
  );
  assert.doesNotThrow(() =>
    assertSupportedFilters({
      starLevel: 0,
      reviewCount: 0,
      facilities: [],
    }),
  );
});
test("真实查询错误保留分类，未知异常不泄漏上游信息", async () => {
  const server = createTravelServer({
    handlers: {
      "test-quota": async () => {
        throw new AppError(
          "FLYAI_QUOTA_EXCEEDED",
          "供应方查询额度不足，请稍后重试。",
          429,
        );
      },
      "test-unknown": async () => {
        throw new Error("private-key must not appear");
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    const quota = await fetch(url + "/api/travel/test-quota", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(quota.status, 429);
    assert.equal((await quota.json()).error.code, "FLYAI_QUOTA_EXCEEDED");
    const unknown = await fetch(url + "/api/travel/test-unknown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unknown.status, 500);
    assert.doesNotMatch(await unknown.text(), /private-key/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("酒店事实比较忽略旧 AI 文案，价格及位置只比较真实候选", () => {
  const items = [
    {
      id: "a",
      price: 500,
      overallRating: 9,
      coreDistance: 8,
      renovationYear: 2023,
      reason: "免费早餐，交通最便利",
    },
    {
      id: "b",
      price: 200,
      overallRating: 8,
      coreDistance: 6,
      renovationYear: null,
    },
    {
      id: "c",
      price: 300,
      overallRating: 8,
      coreDistance: 2,
      renovationYear: 2022,
    },
    {
      id: "d",
      price: 250,
      overallRating: null,
      coreDistance: null,
      renovationYear: null,
    },
  ];
  const picks = getHotelHighlights(items, "a");
  assert.deepEqual(
    picks.map((p) => p.hotel.id),
    ["a", "b", "c"],
  );
  assert.equal(new Set(picks.map((p) => p.hotel.id)).size, 3);
  const text = picks.map((p) => p.reason).join("");
  assert.doesNotMatch(text, /免费早餐|最便利|品质出色/);
  assert.match(text, /直线/);
  assert.match(text, /本次候选/);
  assert.equal(getHotelHighlights(items, "invented")[0].hotel.id, "a");
  const missing = factHotelReason(items[3]);
  assert.doesNotMatch(missing, /距离.*0|装修|评分/);
  assert.match(missing, /床位/);
});
test("有限重启预算耗尽后停止，时间窗口过后可重新计算", () => {
  const budget = new RestartBudget({ delays: [1, 2, 3], windowMs: 100 });
  assert.equal(budget.record(0), 1);
  assert.equal(budget.record(1), 2);
  assert.equal(budget.record(2), 3);
  assert.equal(budget.record(3), null);
  assert.equal(budget.record(103), 1);
});
test("单个开发进程失败不立即关闭其他进程，错误与退出事件只计一次", async () => {
  const children = [];
  let pid = 100;
  const spawnImpl = () => {
    const child = new EventEmitter();
    Object.assign(child, {
      pid: ++pid,
      stdout: null,
      stderr: null,
      exitCode: null,
      kills: [],
      kill(signal) {
        this.kills.push(signal);
        this.exitCode = 0;
        this.emit("exit", 0, signal);
      },
    });
    children.push(child);
    return child;
  };
  const manager = supervise(
    [
      { name: "api", command: "node", args: [] },
      { name: "web", command: "node", args: [] },
    ],
    { spawnImpl, budgetOptions: { delays: [1], limit: 3 } },
  );
  children[1].emit("error", { code: "EBUSY" });
  children[1].emit("exit", 1, null);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(children[0].kills.length, 0);
  assert.equal(children.length, 3);
  await manager.stop();
  assert.deepEqual(children[0].kills, ["SIGTERM"]);
});

test("真实 Node 子进程崩溃后有限重启，健康进程继续运行", async () => {
  let exhausted;
  const done = new Promise((resolve) => {
    exhausted = resolve;
  });
  const logs = [];
  const manager = supervise(
    [
      {
        name: "broken",
        command: process.execPath,
        args: ["-e", "process.exit(17)"],
      },
      {
        name: "healthy",
        command: process.execPath,
        args: ["-e", "setInterval(()=>{},1000)"],
      },
    ],
    {
      budgetOptions: { limit: 1, delays: [10] },
      log: (name, line) => logs.push({ name, line }),
      onExhausted: (name) => exhausted(name),
    },
  );
  let deadline;
  try {
    const outcome = await Promise.race([
      done,
      new Promise((_, reject) => {
        deadline = setTimeout(
          () => reject(new Error("restart test deadline")),
          4000,
        );
      }),
    ]);
    assert.equal(outcome, "broken");
    assert.equal(
      logs.filter((x) => x.name === "broken" && x.line.includes("进程退出"))
        .length,
      2,
    );
    const healthy = manager.snapshot().find((w) => w.name === "healthy");
    assert.ok(healthy.pid);
    assert.doesNotThrow(() => process.kill(healthy.pid, 0));
  } finally {
    clearTimeout(deadline);
    await manager.stop();
  }
});

test("Agent失败或返回虚构ID时保留真实候选，明确标注规则整理", async () => {
  const { rankHotelCandidates } = await import("../../server/travel-api.js");
  const preferences = {
    destinationCity: "杭州",
    primaryPlace: null,
    priceRange: [0, 2000],
    brandPreference: [],
  };
  for (const recommend of [
    async () => {
      throw new AppError("AGENT_RATE_LIMITED", "额度不足", 429);
    },
    async () => ({ recommendedId: "invented" }),
  ]) {
    const hotels = [
        {
          id: "supplier-1",
          name: "真实候选",
          price: 300,
          source: "live",
          overallRating: null,
          coreDistance: null,
          renovationYear: null,
          reason: "未知设施不能保留",
        },
      ],
      metadata = {};
    const result = await rankHotelCandidates(
      hotels,
      preferences,
      metadata,
      undefined,
      recommend,
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "supplier-1");
    assert.equal(result[0].price, 300);
    assert.equal(result[0].source, "live");
    assert.equal(metadata.rankingStatus, "unavailable");
    assert.equal(result[0].recommendationSource, "rules");
    assert.match(result[0].rankingNotice, /AI 推荐暂未生成/);
    assert.doesNotMatch(result[0].reason, /未知设施/);
  }
});
