import { describe, it, expect } from "vitest";
import {
  initialDraft,
  restoreDraft,
  updateDraft,
  ensureCorePlace,
} from "../src/planning/model";
import { reconcilePacking } from "../src/planning/packing";
import { generateRoute } from "../src/planning/routeEngine";
import { tripPdfSections } from "../src/planning/tripPdf";
import type { Place, TripDraft } from "../src/planning/types";
import catalog from "../public/mock/v2/catalog.json";
const core = catalog.cities.北京.places[0] as Place;
const second = catalog.cities.北京.places[1] as Place;
const ready = (): TripDraft => ({
  ...initialDraft(),
  destinationCity: "北京",
  originCity: "长沙",
  tripDays: 3,
  selectedPlaces: [core],
  primaryPlace: core,
  localTransportPreference: "步行 + 公共交通",
});
describe("核心地点、清单与旧草稿兼容", () => {
  it("核心只自动加入一次，主动删除后刷新和重建路线也不加回", () => {
    let d = ready();
    d = updateDraft(d, ensureCorePlace(d)!);
    expect(d.tripPlaces.map((p) => p.id)).toEqual([core.id]);
    expect(ensureCorePlace(d)).toBeNull();
    d = updateDraft(d, { tripPlaces: [] });
    expect(d.corePlaceDecisions[core.id]).toBe("excluded");
    d = restoreDraft(JSON.stringify(d));
    expect(ensureCorePlace(d)).toBeNull();
    expect(
      generateRoute(d)
        .days.flatMap((day) => day.stops)
        .some((s) => s.placeId === core.id),
    ).toBe(false);
  });
  it("更换核心加入新点并保留原行程，重复生成不重复核心", () => {
    let d = updateDraft(ready(), ensureCorePlace(ready())!);
    d = updateDraft(d, {
      selectedPlaces: [core, second],
      primaryPlace: second,
    });
    d = updateDraft(d, ensureCorePlace(d)!);
    expect(d.tripPlaces.map((p) => p.id)).toEqual([second.id, core.id]);
    expect(
      generateRoute(d)
        .days.flatMap((day) => day.stops)
        .filter((s) => s.placeId === second.id),
    ).toHaveLength(1);
  });
  it("旧v2草稿缺少新字段仍保留酒店、景点和原路线", () => {
    const d = {
      ...ready(),
      selectedHotel: catalog.cities.北京.hotels[0],
      tripPlaces: [core],
      routeDraft: generateRoute(ready()),
    };
    const old: Record<string, unknown> = { ...d };
    delete old.corePlaceDecisions;
    delete old.packingItems;
    delete old.suppressedPackingIds;
    const restored = restoreDraft(JSON.stringify(old));
    expect(restored.selectedHotel?.id).toBe(d.selectedHotel.id);
    expect(restored.routeDraft).toEqual(d.routeDraft);
    expect(restored.packingItems).toEqual([]);
  });
  it("更新建议保留手动编辑、勾选和删除决定", () => {
    const d = ready();
    d.packingItems = reconcilePacking(d);
    d.packingItems[0] = {
      ...d.packingItems[0],
      name: "身份证与护照",
      note: "放在侧袋",
      packed: true,
      customized: true,
    };
    d.suppressedPackingIds = ["suggested-phone"];
    d.packingItems.push({
      id: "custom-1",
      name: "相机",
      note: "备两张卡",
      packed: false,
      origin: "custom",
    });
    d.children = 1;
    d.tripDays = 5;
    const items = reconcilePacking(d);
    expect(items.find((p) => p.id === "suggested-id")).toMatchObject({
      name: "身份证与护照",
      note: "放在侧袋",
      packed: true,
    });
    expect(items.some((p) => p.id === "suggested-phone")).toBe(false);
    expect(items.some((p) => p.id === "suggested-child")).toBe(true);
    expect(items.some((p) => p.id === "custom-1")).toBe(true);
  });
  it("更换目的地保留自定义清单和备注，清单编辑不使路线失效", () => {
    const d = {
      ...ready(),
      routeDraft: generateRoute(ready()),
      packingItems: [
        {
          id: "custom-1",
          name: "相机",
          note: "充满电",
          packed: true,
          origin: "custom" as const,
        },
      ],
    };
    expect(updateDraft(d, { packingItems: d.packingItems }).routeDraft).toEqual(
      d.routeDraft,
    );
    const changed = updateDraft(d, { destinationCity: "杭州" });
    expect(changed.packingItems).toEqual(d.packingItems);
    expect(changed.corePlaceDecisions).toEqual({});
    const userDecisions = {
      ...d,
      packingItems: [
        ...d.packingItems,
        {
          id: "suggested-clothes",
          name: "换洗衣物",
          note: "放在蓝色包里",
          packed: true,
          origin: "suggested" as const,
          customized: true,
        },
        {
          id: "suggested-phone",
          name: "手机与充电器",
          note: "带上常用充电线。",
          packed: true,
          origin: "suggested" as const,
        },
        {
          id: "suggested-rail",
          name: "车次与乘车信息",
          note: "保存家人的车票",
          packed: false,
          origin: "suggested" as const,
          customized: true,
        },
      ],
    };
    const items = reconcilePacking(
      updateDraft(userDecisions, { destinationCity: "杭州" }),
    );
    expect(items.find((p) => p.id === "suggested-clothes")).toMatchObject({
      note: "放在蓝色包里",
      packed: true,
    });
    expect(items.find((p) => p.id === "suggested-phone")?.packed).toBe(true);
    expect(items.find((p) => p.id === "suggested-rail")?.note).toBe(
      "保存家人的车票",
    );
    expect(new Set(items.map((p) => p.id)).size).toBe(items.length);
  });
  it("PDF包含清单、备注和当前完成状态", () => {
    const d = {
      ...ready(),
      tripPlaces: [core],
      routeDraft: generateRoute(ready()),
      packingItems: [
        {
          id: "custom-1",
          name: "相机",
          note: "充满电",
          packed: true,
          origin: "custom" as const,
        },
      ],
    };
    expect(
      JSON.stringify(tripPdfSections(d, new Date("2026-10-17T00:00:00Z"))),
    ).toContain("已备好：相机；备注：充满电");
  });
});
