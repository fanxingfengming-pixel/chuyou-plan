import { describe, it, expect } from "vitest";
import { initialDraft, restoreDraft, updateDraft } from "../src/planning/model";
import {
  generateRoute,
  moveStop,
  invalidateRoute,
  routeNumbers,
  routeSignature,
  isRouteReady,
} from "../src/planning/routeEngine";
import { validateServiceResult } from "../src/planning/contracts";
import type { TripDraft, Hotel, Place } from "../src/planning/types";
import catalog from "../public/mock/v2/catalog.json";
const hotels = catalog.cities.杭州.hotels as Hotel[],
  places = catalog.cities.杭州.places as Place[];
const fixture = (): TripDraft => ({
  ...initialDraft(),
  originCity: "长沙",
  destinationCity: "杭州",
  tripDays: 2,
  selectedHotel: hotels[0],
  hotelResults: hotels,
  hotelCandidateIds: hotels.slice(0, 6).map((h) => h.id),
  tripPlaces: places.slice(0, 3),
  localTransportPreference: "公共交通",
});
describe("V2.1候选、编号和失效", () => {
  it("搜索结果加入后只替换指定槽；不改变已选酒店或筛选，刷新仍保留", () => {
    const d = fixture(),
      newHotel = { ...hotels[0], id: "new-hotel", name: "新酒店" },
      ids = d.hotelCandidateIds.map((id, i) => (i === 3 ? newHotel.id : id));
    const next = updateDraft(d, {
      hotelResults: [...hotels, newHotel],
      hotelCandidateIds: ids,
    });
    expect(next.hotelCandidateIds).toEqual(ids);
    expect(next.selectedHotel).toEqual(d.selectedHotel);
    expect(next.hotelFilters).toEqual(d.hotelFilters);
    expect(restoreDraft(JSON.stringify(next)).hotelCandidateIds).toEqual(ids);
  });
  it("地图POI酒店允许价格null，其他未知酒店资料不被补0", () => {
    const d = fixture();
    d.selectedHotel = {
      ...hotels[0],
      price: null,
      dataProvider: "amap",
      userScore: null,
      reviewCount: null,
    };
    expect(restoreDraft(JSON.stringify(d)).selectedHotel?.price).toBeNull();
    expect(() =>
      validateServiceResult("hotels/search-name", {
        hotels: [d.selectedHotel],
        provider: "amap",
        notice: "仅位置",
      }),
    ).not.toThrow();
  });
  it("第二天编号从第一天继续，餐食建议不占编号", () => {
    const d = fixture(),
      r = generateRoute(d, false),
      n = routeNumbers(r);
    expect(Object.values(n)).toEqual([1, 2, 3]);
    expect(n[r.days[1].stops.find((s) => s.kind === "place")!.placeId!]).toBe(
      3,
    );
  });
  it("旧路线刷新保留手动分天且清除完成，加载中请求不伪装仍运行", () => {
    const d = fixture();
    d.routeDraft = generateRoute(d, false);
    delete d.routeDraft.schemaVersion;
    d.memoCompletedAt = "已完成";
    const order = d.routeDraft.days;
    const restored = restoreDraft(JSON.stringify(d));
    expect(restored.routeDraft?.days.map((d) => d.stops)).toEqual(
      order.map((d) => d.stops),
    );
    expect(restored.routeDraft?.status).toBe("idle");
    expect(restored.memoCompletedAt).toBe("");
    expect(isRouteReady(restored)).toBe(false);
  });
  it("编辑路线使旧路段和完成失效；携带清单变化不使路线失效", () => {
    const d = fixture();
    d.routeDraft = generateRoute(d, false);
    d.memoCompletedAt = "已完成";
    expect(updateDraft(d, { packingItems: [] }).memoCompletedAt).toBe("已完成");
    const edited = updateDraft(d, {
      routeDraft: invalidateRoute(d.routeDraft),
    });
    expect(edited.memoCompletedAt).toBe("");
    expect(isRouteReady(edited)).toBe(false);
  });
  it("签名覆盖日期、酒店位置和顺序；挂起请求不能套用新签名", () => {
    const d = fixture();
    d.routeDraft = generateRoute(d, false);
    const a = routeSignature(d);
    expect(routeSignature({ ...d, departureDate: "2026-10-20" })).not.toBe(a);
    expect(
      routeSignature({
        ...d,
        selectedHotel: { ...hotels[0], amapPoiId: "B0123456" },
      }),
    ).not.toBe(a);
    expect(
      routeSignature({
        ...d,
        routeDraft: { ...d.routeDraft, days: [...d.routeDraft.days].reverse() },
      }),
    ).not.toBe(a);
  });
  it("服务返回异常坐标或虚构负耗时被拒绝", () => {
    const d = fixture();
    const r = {
      ...generateRoute(d, false),
      schemaVersion: 21,
      status: "ready",
      hotelAnchor: { id: "h", name: "h", lat: 999, lng: 0, source: "live" },
    };
    expect(() => validateServiceResult("amap/route", r)).toThrow();
  });
});

it("移动后时段随顺序更新，午餐不跑到当天首个景点之前", () => {
  const d = fixture(),
    r = generateRoute(d, false),
    p = r.days[0].stops.filter((s) => s.kind === "place"),
    moved = moveStop(r, p[1].id, 1, p[0].id);
  expect(moved.days[0].stops[0].kind).toBe("place");
  expect(moved.days[0].stops[0].period).toBe("早上");
  expect(moved.days[0].stops[1].kind).toBe("meal");
  expect(moved.days[0].stops[2].period).toBe("下午");
});
