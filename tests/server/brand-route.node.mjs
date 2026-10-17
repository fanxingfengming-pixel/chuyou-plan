import test from "node:test";
import assert from "node:assert/strict";
import { HOTEL_BRANDS, matchesHotelBrand } from "../../shared/hotel-brands.js";
import { hotelBrands } from "../../server/travel-api.js";
import { AppError } from "../../server/errors.js";
import { planRealRoute, queryLeg } from "../../server/route-planning.js";
import { createTravelServer } from "../../server/app.js";
const anchor = {
  id: "B0HOTEL1",
  name: "测试酒店",
  city: "杭州",
  lat: 30.25,
  lng: 120.16,
  source: "live",
};
const places = [
  {
    id: "B0PLACE1",
    name: "景点一",
    city: "杭州",
    lat: 30.26,
    lng: 120.17,
    source: "live",
  },
  {
    id: "B0PLACE2",
    name: "景点二",
    city: "杭州",
    lat: 30.27,
    lng: 120.18,
    source: "live",
  },
];
const payload = {
  city: "杭州",
  hotel: { name: anchor.name, amapPoiId: "B0STALE1" },
  preference: "公共交通",
  places: places.map((p) => ({ id: p.id })),
  days: places.map((p, i) => ({
    day: i + 1,
    stops: [
      { id: p.id, placeId: p.id, name: p.name, kind: "place", period: "早上" },
    ],
  })),
};
const deps = {
  hotelPoi: async (id) => {
    if (id === "B0STALE1")
      throw new AppError("HOTEL_UNRESOLVED", "旧标识失效", 422);
    return anchor;
  },
  searchHotelPois: async () => [{ name: anchor.name, amapPoiId: anchor.id }],
  getPlaceDetail: async (id) => places.find((p) => p.id === id),
  queryLeg: async (from, to) => ({
    from,
    to,
    status: "ready",
    distanceMeters: 1000,
    durationSeconds: 600,
    polylines: [],
    source: "live",
  }),
};
test("固定品牌白名单不依赖供应方搜索；集团偏好多选采用并集", async () => {
  assert.deepEqual(await hotelBrands("杭州"), [
    "华住会",
    "希尔顿",
    "万豪",
    "洲际",
    "凯悦",
    "雅高",
    "首旅",
  ]);
  assert.equal(HOTEL_BRANDS.length, 7);
  for (const [name, group] of [
    ["全季杭州西湖酒店", "华住会"],
    ["汉庭酒店", "华住会"],
    ["如家精选酒店", "首旅"],
    ["希尔顿欢朋酒店", "希尔顿"],
  ])
    assert.ok(matchesHotelBrand({ name, brand: "" }, [group]));
  assert.ok(
    matchesHotelBrand({ name: "如家酒店", brand: "" }, ["希尔顿", "首旅"]),
  );
  assert.ok(
    !matchesHotelBrand({ name: "锦江酒店", brand: "锦江" }, ["华住会", "首旅"]),
  );
});
test("失效酒店ID按名称核实；每天酒店出发，按原顺序并返回酒店，空闲天不造路段", async () => {
  const route = await planRealRoute(
    { ...payload, days: [...payload.days, { day: 3, stops: [] }] },
    new AbortController().signal,
    () => {},
    deps,
  );
  assert.equal(route.status, "ready");
  assert.deepEqual(
    route.days.map((d) => d.stops.map((s) => s.placeId)),
    [[places[0].id], [places[1].id], []],
  );
  for (const day of route.days.slice(0, 2)) {
    assert.equal(day.legs.length, 2);
    assert.equal(day.legs[0].from.id, anchor.id);
    assert.equal(day.legs.at(-1).to.id, anchor.id);
  }
  assert.deepEqual(route.days[2].legs, []);
});
test("同名分店不自动确认，保留分天和地点让用户选择", async () => {
  const route = await planRealRoute(
    payload,
    new AbortController().signal,
    () => {},
    {
      ...deps,
      searchHotelPois: async () => [
        { name: anchor.name, amapPoiId: "B0HOTEL1" },
        { name: anchor.name, amapPoiId: "B0HOTEL2" },
      ],
    },
  );
  assert.equal(route.status, "needs-hotel");
  assert.equal(route.hotelChoices.length, 2);
  assert.deepEqual(
    route.days.map((d) => d.stops),
    payload.days.map((d) => d.stops),
  );
});
test("部分高德方式失败仍可规划；全部失败保留安全原因和点位草图", async () => {
  const call = async (tool) => {
    if (tool !== "maps_direction_driving")
      throw new AppError("AMAP_TIMEOUT", "高德超时", 504);
    return { route: { paths: [{ distance: 2400, duration: 600 }] } };
  };
  const leg = await queryLeg(
    anchor,
    places[0],
    "杭州",
    "公共交通",
    new AbortController().signal,
    call,
    async (s) => s,
  );
  assert.equal(leg.status, "ready");
  assert.equal(leg.mode, "driving");
  const route = await planRealRoute(
    payload,
    new AbortController().signal,
    () => {},
    {
      ...deps,
      queryLeg: (from, to, city, pref, signal) =>
        queryLeg(from, to, city, pref, signal, async () => {
          throw new AppError("AMAP_RATE_LIMITED", "高德额度不足", 429);
        }),
    },
  );
  assert.equal(route.status, "partial");
  assert.ok(route.hotelAnchor);
  assert.equal(route.days[0].legs[0].errorCode, "AMAP_RATE_LIMITED");
  assert.equal(route.days[0].legs[0].distanceMeters, null);
  assert.ok(!route.days[0].legs[0].error.includes("铁路"));
});
test("铁路HTTP查询失败不污染随后的纯市内路线端点", async () => {
  const server = createTravelServer({
    handlers: {
      "rail/search": () => {
        throw new AppError("RAIL_QUERY_FAILED", "12306查询失败");
      },
      "amap/route": (p, s) => planRealRoute(p, s, () => {}, deps),
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port + "/api/travel/";
  const post = (route, p) =>
    fetch(base + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  try {
    const rail = await post("rail/search", {});
    assert.equal(rail.status, 502);
    const city = await post("amap/route", payload);
    assert.equal(city.status, 200);
    assert.equal((await city.json()).status, "ready");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("坐标缺失不能被转换为零，非法坐标在调用高德前拒绝", async () => {
  await assert.rejects(
    queryLeg(
      { ...anchor, lat: null },
      places[0],
      "杭州",
      "公共交通",
      new AbortController().signal,
      () => {
        throw Error("must not run");
      },
    ),
    (e) => e.code === "AMAP_INVALID_PARAMETERS",
  );
});
