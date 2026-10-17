import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDirection,
  recommendDirection,
  queryLeg,
  validateRoutePayload,
  parseLocation,
} from "../../server/route-planning.js";
const point = (id, lng) => ({ id, name: id, lat: 30, lng, source: "live" });
const route = (distance = 900, duration = 700) => ({
  route: {
    paths: [{ distance, duration, steps: [{ instruction: "沿实际道路前行" }] }],
  },
});
test("高德距离/秒数原样使用；缺字段绝不以平均速度或直线距离补值", () => {
  assert.equal(normalizeDirection(route(), "walking").distanceMeters, 900);
  assert.equal(normalizeDirection(route(), "walking").durationSeconds, 700);
  assert.equal(
    normalizeDirection({ paths: [{ distance: 900 }] }, "walking"),
    null,
  );
  assert.equal(
    normalizeDirection({ paths: [{ distance: "", duration: 1 }] }, "driving"),
    null,
  );
  assert.equal(parseLocation(","), null);
  assert.equal(parseLocation("200,91"), null);
});
test("公交总路程只由同方案各段实测距离求和，不用顶层步行距离冒充", () => {
  const raw = {
    distance: "1000",
    transits: [
      {
        duration: "1200",
        segments: [
          {
            walking: { distance: "200" },
            bus: { buslines: [{ name: "地铁1号线", distance: "3000" }] },
          },
          { walking: { distance: "100" }, bus: { buslines: [] } },
        ],
      },
    ],
  };
  const result = normalizeDirection(raw, "transit");
  assert.equal(result.distanceMeters, 3300);
  assert.equal(result.durationSeconds, 1200);
  assert.deepEqual(result.instructions, ["地铁1号线"]);
});
test("步行阈值基于真实结果，较远路段尊重交通偏好", () => {
  const walk = { mode: "walking", distanceMeters: 900, durationSeconds: 700 },
    transit = { mode: "transit", distanceMeters: 800, durationSeconds: 600 },
    drive = { mode: "driving", distanceMeters: 1300, durationSeconds: 500 };
  assert.equal(
    recommendDirection([walk, transit, drive], "公共交通").mode,
    "walking",
  );
  assert.equal(
    recommendDirection(
      [{ ...walk, distanceMeters: 3000 }, transit, drive],
      "打车",
    ).mode,
    "driving",
  );
});
test("三种方式都失败时保留失败，未返回轨迹不能造道路", async () => {
  const failed = await queryLeg(
    point("a", 120),
    point("b", 121),
    "杭州",
    "公共交通",
    new AbortController().signal,
    async () => {
      throw Error("模拟服务故障");
    },
  );
  assert.equal(failed.status, "error");
  assert.equal(failed.distanceMeters, null);
  assert.deepEqual(failed.polylines, []);
  const success = await queryLeg(
    point("a", 120),
    point("b", 121),
    "杭州",
    "公共交通",
    new AbortController().signal,
    async () => route(),
    async (s) => s,
  );
  assert.equal(success.status, "ready");
  assert.equal(success.provider, "高德地图MCP");
  assert.equal(success.tool, "maps_direction_walking");
  assert.deepEqual(success.polylines, []);
});
test("伪造坐标ID、跨天重复和丢失地点被拒绝", () => {
  const p = {
    city: "杭州",
    hotel: { name: "酒店" },
    preference: "公共交通",
    places: [{ id: "B0123456" }],
    days: [
      {
        day: 1,
        stops: [
          {
            id: "B0123456",
            placeId: "B0123456",
            kind: "place",
            period: "早上",
          },
        ],
      },
    ],
  };
  validateRoutePayload(p);
  assert.throws(() =>
    validateRoutePayload({ ...p, places: [{ id: "made-up" }] }),
  );
  assert.throws(() =>
    validateRoutePayload({ ...p, days: [...p.days, { ...p.days[0], day: 2 }] }),
  );
  assert.throws(() =>
    validateRoutePayload({ ...p, days: [{ day: 1, stops: [] }] }),
  );
});
