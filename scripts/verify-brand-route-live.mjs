import fs from "node:fs";
import assert from "node:assert/strict";
import { queryAmap } from "../server/amap-service.js";
import { loadConfig } from "../server/config.js";
import { AppError } from "../server/errors.js";
const directory = "artifacts/brand-route";
fs.mkdirSync(directory, { recursive: true });
const evidence = {
  checkedAt: new Date().toISOString(),
  checks: [],
  source: "real provider via local server",
};
const save = () =>
  fs.writeFileSync(
    directory + "/live-verification.json",
    JSON.stringify(evidence, null, 2),
  );
const post = async (service, p) => {
  const response = await fetch("http://127.0.0.1:5173/api/travel/" + service, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    signal: AbortSignal.timeout(180000),
  });
  return { http: response.status, data: await response.json() };
};
try {
  const brand = await post("hotel-brands", { city: "杭州" });
  assert.deepEqual(brand.data, [
    "华住会",
    "希尔顿",
    "万豪",
    "洲际",
    "凯悦",
    "雅高",
    "首旅",
  ]);
  evidence.checks.push({ name: "品牌白名单同源接口", ok: true, ...brand });
  save();
  const rail = await post("rail/search", {
    originCity: "长沙",
    destinationCity: "杭州",
    dateMode: "exact",
    departureDate: "2026-12-31",
  });
  assert.ok(rail.http !== 200 || rail.data.available === false);
  evidence.checks.push({
    name: "真实12306超出售票期查询失败/无方案",
    ok: true,
    http: rail.http,
    error: rail.data.error,
  });
  save();
  const fixture = JSON.parse(
    fs.readFileSync("artifacts/v21/live-fixture.json", "utf8"),
  );
  const payload = {
    city: "杭州",
    hotel: { name: "杭州友好饭店", amapPoiId: "B000000000" },
    places: fixture.places.map((p) => ({ id: p.id })),
    days: fixture.route.days.map((d) => ({ day: d.day, stops: d.stops })),
    preference: "公共交通",
  };
  const route = await post("amap/route", payload);
  assert.equal(route.http, 200);
  assert.equal(route.data.status, "ready");
  for (const day of route.data.days) {
    const ids = day.stops
      .filter((s) => s.kind === "place")
      .map((s) => s.placeId);
    assert.deepEqual(
      day.legs.slice(0, -1).map((l) => l.to.id),
      ids,
    );
    assert.equal(day.legs[0].from.id, route.data.hotelAnchor.id);
    assert.equal(day.legs.at(-1).to.id, route.data.hotelAnchor.id);
    assert.ok(
      day.legs.every(
        (l) =>
          l.distanceMeters > 0 && l.durationSeconds > 0 && l.source === "live",
      ),
    );
  }
  evidence.checks.push({
    name: "铁路失败后市内路线成功；失效酒店标识恢复；两日五段实际路线",
    ok: true,
    route: route.data,
  });
  save();
  const recovered = await queryAmap(
    "maps_direction_walking",
    { origin: "120.166521,30.253702", destination: "120.155070,30.247934" },
    AbortSignal.timeout(20000),
    async () => {
      throw new AppError("AMAP_CONNECTION_FAILED", "显式模拟MCP断连");
    },
    loadConfig(),
  );
  assert.ok(Number(recovered.route.paths[0].distance) > 0);
  evidence.checks.push({
    name: "显式模拟MCP断连+真实高德HTTP恢复",
    ok: true,
    source: "fault injection + real Amap HTTP",
    distance: recovered.route.paths[0].distance,
    duration: recovered.route.paths[0].duration,
  });
  save();
  console.log(
    JSON.stringify({
      ok: true,
      checks: evidence.checks.map((c) => ({ name: c.name, ok: c.ok })),
      days: route.data.days.length,
      legs: route.data.days.reduce((n, d) => n + d.legs.length, 0),
    }),
  );
} catch (e) {
  evidence.failure = {
    code: e.code || e.name,
    message: e instanceof AppError ? e.message : "验证断言未通过",
  };
  save();
  console.log(JSON.stringify(evidence.failure));
  process.exitCode = 1;
}
