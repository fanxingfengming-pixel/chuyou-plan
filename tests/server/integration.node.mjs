import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validBookingUrl,
  normalizeHotel,
  filterLiveHotels,
} from "../../server/flyai.js";
import { parseJsonObject } from "../../server/agent-tasks.js";
import { createTravelServer } from "../../server/app.js";
import { publicError } from "../../server/errors.js";
const filters = {
  priceRange: [0, 2000],
  overallRating: 0,
  minRenovationYear: 0,
  starLevel: 0,
  reviewCount: 0,
  userScore: 0,
  selectedDistricts: [],
  brandPreference: [],
  facilities: [],
};
test("飞猪官方直链允许，伪装域名和危险协议拒绝", () => {
  assert.ok(validBookingUrl("https://router.feizhu.com/ws/hotel"));
  for (const url of [
    "javascript:alert(1)",
    "https://feizhu.com.evil.example/a",
    "https://evil.example",
    "https://user:password@router.feizhu.com/",
  ])
    assert.equal(validBookingUrl(url), undefined);
});
test("供应方未知字段保持 null，评分换算可追踪", () => {
  const h = normalizeHotel(
    { shId: "1", name: "供应酒店", price: "400", rate: "4.5", star: "舒适型" },
    "北京",
    "now",
  );
  assert.equal(h.overallRating, 9);
  assert.equal(h.userScore, 4.5);
  for (const k of [
    "subwayDistance",
    "reviewCount",
    "renovationYear",
    "lat",
    "lng",
    "starLevel",
  ])
    assert.equal(h[k], null);
  assert.ok(h.ratingNote);
});
test("未知参数不满足硬性筛选，不能自动放宽", () => {
  const h = normalizeHotel(
    { shId: "1", name: "酒店", price: 400 },
    "北京",
    "now",
  );
  assert.equal(filterLiveHotels([h], filters).length, 1);
  for (const patch of [
    { reviewCount: 500 },
    { facilities: ["早餐"] },
    { starLevel: 4 },
    { overallRating: 9 },
  ])
    assert.equal(filterLiveHotels([h], { ...filters, ...patch }).length, 0);
});
test("结构化结果拒绝无效 JSON", () => {
  assert.deepEqual(parseJsonObject('说明 {"a":1}'), { a: 1 });
  assert.throws(() => parseJsonObject("not json"));
});
test("上游意外错误不向页面泄漏凭据", () => {
  const result = publicError(new Error("Bearer secret-key https://internal"));
  assert.equal(result.status, 500);
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("本地接口只开放指定查询，拒绝跨站和无效输入", async () => {
  const server = createTravelServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { Host: "127.0.0.1:3001" };
  try {
    assert.equal(
      (await fetch(base + "/api/travel/health", { headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/travel/health", {
          headers: { ...headers, Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/travel/booking", { method: "POST", headers }))
        .status,
      404,
    );
    assert.equal(
      (
        await fetch(base + "/api/travel/parse-trip", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "null",
        })
      ).status,
      400,
    );
    const fuzzy = await fetch(base + "/api/travel/transport/compare", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ destinationCity: "北京", dateMode: "fuzzy" }),
    });
    assert.equal(fuzzy.status, 422);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("已完成但格式无效的 Agent 输出只纠正一次", async () => {
  const { structuredAgentTurn } = await import("../../server/agent-tasks.js");
  let calls = 0;
  const client = {
    chat: async () =>
      ++calls === 1
        ? "请提供更多信息。"
        : '{"operation":"delete","placeId":"p"}',
  };
  assert.equal(
    (await structuredAgentTurn(client, "session", "input", "task")).operation,
    "delete",
  );
  assert.equal(calls, 2);
});
test("网络失败或中断不会自动重复提交 Agent 请求", async () => {
  const { structuredAgentTurn } = await import("../../server/agent-tasks.js");
  let calls = 0;
  const client = {
    chat: async () => {
      calls++;
      throw new Error("network failure");
    },
  };
  await assert.rejects(() =>
    structuredAgentTurn(client, "session", "input", "task"),
  );
  assert.equal(calls, 1);
});

test("真实酒店过滤的低档为最高200元，高档不截断2000以上", () => {
  const hotels = [100, 200, 201, 2500].map((price) => ({
    id: String(price),
    price,
  }));
  assert.deepEqual(
    filterLiveHotels(hotels, { ...filters, priceRange: [0, 0] }).map(
      (h) => h.price,
    ),
    [100, 200],
  );
  assert.deepEqual(
    filterLiveHotels(hotels, { ...filters, priceRange: [2000, 2000] }).map(
      (h) => h.price,
    ),
    [2500],
  );
});

test("已删除的旧地铁筛选不能阻挡酒店候选", () => {
  const h = normalizeHotel(
    { shId: "retired-filter", name: "测试酒店", price: 400 },
    "杭州",
    "now",
  );
  assert.equal(
    filterLiveHotels([h], { ...filters, subwayDistance: 300 }).length,
    1,
  );
});
