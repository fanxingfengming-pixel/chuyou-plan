import { HotelBrandPreference } from "../src/planning/components/LocationPages";
import { hotelPayload } from "../src/planning/payload";
// @vitest-environment jsdom
import { Media, ResetControl } from "../src/planning/components/Common";
import { Router } from "../src/planning/router";

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TripDraftProvider,
  useTripDraft,
} from "../src/planning/TripDraftProvider";
import { initialDraft, restoreDraft, updateDraft } from "../src/planning/model";
import {
  generateRoute,
  moveStop,
  optimizeRoute,
} from "../src/planning/routeEngine";
import {
  filterHotelCatalog,
  getBookingUrl,
  parseTripPrompt,
  searchPlaceWithAmapMCP,
  selectHighlights,
} from "../src/planning/services";
import { DualRangeSlider } from "../src/planning/components/DualRangeSlider";
import type { Catalog, HotelSearchPayload } from "../src/planning/types";
import data from "../public/mock/v2/catalog.json";
const catalog = data as unknown as Catalog;
const place = catalog.cities.北京.places[0],
  hotel = catalog.cities.北京.hotels[0];
let root: Root,
  container: HTMLDivElement,
  latest: ReturnType<typeof useTripDraft>;
function Probe() {
  latest = useTripDraft();
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => catalog })),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(
      <TripDraftProvider>
        <Probe />
      </TripDraftProvider>,
    ),
  );
}
const ready = () => ({
  ...initialDraft(),
  originCity: "长沙",
  destinationCity: "北京",
  tripDays: 4,
  fuzzyDateText: "11月",
  selectedTransportMode: "rail" as const,
  planningMode: "hotel" as const,
});
describe("V2 草稿与用户决策", () => {
  it("切换目的地只保留通用信息并清空关联数据", () => {
    const previous = {
      ...ready(),
      brandPreference: ["亚朵"],
      selectedPlaces: [place],
      primaryPlace: place,
      recommendedDistricts: ["东城区"],
      selectedHotel: hotel,
      hotelResults: [hotel],
      tripPlaces: [place],
      localTransportPreference: "打车",
      routeDraft: generateRoute({ ...ready(), tripPlaces: [place] }),
    };
    const next = updateDraft(previous, { destinationCity: "东京" });
    expect([
      next.originCity,
      next.tripDays,
      next.adults,
      next.fuzzyDateText,
    ]).toEqual(["长沙", 4, 1, "11月"]);
    expect([
      next.selectedHotel,
      next.primaryPlace,
      next.routeDraft,
      next.selectedTransportMode,
    ]).toEqual([null, null, null, null]);
    expect([
      next.selectedPlaces,
      next.brandPreference,
      next.hotelResults,
      next.tripPlaces,
      next.recommendedDistricts,
    ]).toEqual([[], [], [], [], []]);
  });
  it("更换酒店保留景点核心位置筛选与市内交通，只清除路线", () => {
    const previous = {
      ...ready(),
      selectedPlaces: [place],
      primaryPlace: place,
      selectedHotel: hotel,
      tripPlaces: [place],
      localTransportPreference: "打车",
      routeDraft: generateRoute({ ...ready(), tripPlaces: [place] }),
    };
    const next = updateDraft(previous, {
      selectedHotel: catalog.cities.北京.hotels[1],
    });
    expect(next.tripPlaces).toEqual([place]);
    expect(next.primaryPlace).toEqual(place);
    expect(next.hotelFilters).toEqual(previous.hotelFilters);
    expect(next.localTransportPreference).toBe("打车");
    expect(next.routeDraft).toBeNull();
  });
  it("区域和对比最多3个，核心地点必须属于已选位置", () => {
    const next = updateDraft(
      { ...ready(), hotelResults: catalog.cities.北京.hotels },
      {
        selectedPlaces: catalog.cities.北京.places.slice(0, 5),
        primaryPlace: catalog.cities.北京.places[4],
        compareHotelIds: catalog.cities.北京.hotels
          .slice(0, 5)
          .map((h) => h.id),
      },
    );
    expect(next.selectedPlaces).toHaveLength(3);
    expect(next.primaryPlace).toBeNull();
    expect(
      updateDraft(
        { ...ready(), hotelResults: catalog.cities.北京.hotels },
        {
          compareHotelIds: catalog.cities.北京.hotels
            .slice(0, 5)
            .map((h) => h.id),
        },
      ).compareHotelIds,
    ).toHaveLength(3);
  });
  it("保存到 LocalStorage，重新挂载恢复，重置后键被移除", async () => {
    await mount();
    await act(async () => latest.patch(ready()));
    expect(
      restoreDraft(localStorage.getItem("tripDraft")).destinationCity,
    ).toBe("北京");
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    expect(latest.draft.originCity).toBe("长沙");
    await act(async () => latest.reset());
    expect(localStorage.getItem("tripDraft")).toBeNull();
    expect(latest.draft.destinationCity).toBe("");
  });
  it("损坏及旧版本草稿安全回退，挂起请求恢复为 idle", () => {
    expect(restoreDraft("{bad")).toEqual(initialDraft());
    expect(restoreDraft(JSON.stringify({ version: 1 }))).toEqual(
      initialDraft(),
    );
    expect(
      restoreDraft(JSON.stringify({ ...ready(), hotelFilters: {} })),
    ).toEqual(initialDraft());
    expect(
      restoreDraft(JSON.stringify({ ...ready(), hotelSearchStatus: "loading" }))
        .hotelSearchStatus,
    ).toBe("idle");
  });
});
describe("V2 真实异步状态与并发保护", () => {
  it("真实读取目录后成功，严格条件允许 empty，绝不自动放宽", async () => {
    await mount();
    await act(async () => latest.patch(ready()));
    await act(async () => latest.startHotelSearch());
    expect(latest.draft.hotelSearchStatus).toBe("success");
    await act(async () =>
      latest.patch({
        hotelFilters: { ...latest.draft.hotelFilters, overallRating: 10 },
      }),
    );
    await act(async () => latest.startHotelSearch());
    expect(latest.draft.hotelSearchStatus).toBe("empty");
    expect(latest.draft.hotelFilters.overallRating).toBe(10);
  });
  it("请求失败进入 error 可重试", async () => {
    await mount();
    await act(async () => latest.patch(ready()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("服务连接失败")),
    );
    await act(async () => latest.startHotelSearch());
    expect(latest.draft.hotelSearchStatus).toBe("error");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => catalog })),
    );
    await act(async () => latest.startHotelSearch());
    expect(latest.draft.hotelSearchStatus).toBe("success");
  });
  it("慢请求进入 timeout，继续等待保留同一个请求并接受迟到的成功", async () => {
    vi.useFakeTimers();
    let resolve!: (v: unknown) => void;
    const mock = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal("fetch", mock);
    await mount();
    await act(async () => latest.patch(ready()));
    act(() => {
      latest.startHotelSearch();
    });
    expect(latest.draft.hotelSearchStatus).toBe("loading");
    await act(async () => vi.advanceTimersByTimeAsync(15001));
    expect(latest.draft.hotelSearchStatus).toBe("timeout");
    act(() => latest.continueHotelSearch());
    expect(mock).toHaveBeenCalledTimes(1);
    expect(latest.draft.hotelSearchStatus).toBe("loading");
    await act(async () => {
      resolve({ ok: true, json: async () => catalog });
    });
    expect(latest.draft.hotelSearchStatus).toBe("success");
  });
  it("搜索过程中修改目的地，迟到响应不会污染新草稿", async () => {
    let resolve!: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    );
    await mount();
    await act(async () => latest.patch(ready()));
    act(() => {
      latest.startHotelSearch();
    });
    await act(async () => latest.patch({ destinationCity: "东京" }));
    await act(async () => {
      resolve({ ok: true, json: async () => catalog });
    });
    expect(latest.draft.hotelResults).toEqual([]);
    expect(latest.draft.hotelSearchStatus).toBe("idle");
  });
});
describe("V2 服务契约与粗粒度路线", () => {
  it("本地 parser 支持中文人数、模糊日期与完整往返日期", async () => {
    expect(
      await parseTripPrompt("11月从长沙去北京玩4天，两个人"),
    ).toMatchObject({
      originCity: "长沙",
      destinationCity: "北京",
      tripDays: 4,
      adults: 2,
      dateMode: "fuzzy",
      fuzzyDateText: "11月",
    });
    expect(
      await parseTripPrompt(
        "2026年11月10日到2026年11月14日从上海去东京，2成人1儿童",
      ),
    ).toMatchObject({
      dateMode: "range",
      tripDays: 5,
      adults: 2,
      children: 1,
      destinationCity: "东京",
    });
  });
  it("未知地点不捏造坐标，国外目录不返回国内品牌", async () => {
    expect(await searchPlaceWithAmapMCP("未知山谷", "北京")).toEqual([]);
    expect(catalog.cities.东京.brands).not.toContain("汉庭");
  });
  it("过滤所有服务条件，并且推荐三家不重复", () => {
    const payload: HotelSearchPayload = {
      ...hotelPayload(ready()),
      primaryPlace: place,
    };
    const filtered = filterHotelCatalog(catalog.cities.北京.hotels, payload);
    expect(
      filtered.every(
        (h) =>
          (h.price ?? -1) >= payload.priceRange[0] &&
          (h.price ?? Infinity) <= payload.priceRange[1],
      ),
    ).toBe(true);
    expect(
      new Set(selectHighlights(filtered).map((h) => h.hotel.id)).size,
    ).toBe(3);
  });
  it("危险外链不能通过飞猪链接校验", () => {
    expect(getBookingUrl({ ...hotel, bookingUrl: "javascript:alert(1)" })).toBe(
      "https://www.fliggy.com/",
    );
    expect(
      getBookingUrl({ ...hotel, bookingUrl: "https://fliggy.com.evil.test/" }),
    ).toBe("https://www.fliggy.com/");
  });
  it("路线不含精确分钟，移动后标记待优化，优化保留用户指定的天数", () => {
    const d = {
      ...ready(),
      selectedHotel: hotel,
      tripPlaces: catalog.cities.北京.places.slice(0, 6),
      localTransportPreference: "公共交通",
    };
    const route = generateRoute(d),
      id = route.days[0].stops.find((s) => s.kind === "place")!.id,
      moved = moveStop(route, id, 2);
    expect(moved.needsOptimization).toBe(true);
    expect(moved.days[1].stops.some((s) => s.id === id)).toBe(true);
    const optimized = optimizeRoute({ ...d, routeDraft: moved });
    expect(optimized.days[1].stops.some((s) => s.id === id)).toBe(true);
    expect(optimized.needsOptimization).toBe(false);
    expect(
      route.days
        .flatMap((day) => day.stops)
        .every((stop) =>
          ["早上", "中午", "下午", "晚上"].includes(stop.period),
        ),
    ).toBe(true);
  });
  it("显式删除/替换的路线更新不被通用失效规则覆盖", () => {
    const d = { ...ready(), tripPlaces: [place] },
      route = generateRoute(d),
      next = updateDraft(d, {
        tripPlaces: [],
        routeDraft: { ...route, days: [], needsOptimization: true },
      });
    expect(next.routeDraft).not.toBeNull();
  });
  it("价格滑块支持键盘、双把手不可穿越、近距离标签合并", async () => {
    let value: [number, number] = [400, 1000];
    function Slider() {
      const [state, setState] = React.useState(value);
      return (
        <DualRangeSlider
          value={state}
          onChange={(v) => {
            value = v;
            setState(v);
          }}
        />
      );
    }
    await act(async () => root.render(<Slider />));
    const slider = container.querySelector<HTMLButtonElement>("[role=slider]")!;
    await act(async () =>
      slider.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true }),
      ),
    );
    expect(value).toEqual([1000, 1000]);
    expect(container.querySelector(".range-merged")).not.toBeNull();
  });
});

it("首页表单内取消或确认重置，不会误触发开始规划", async () => {
  localStorage.setItem(
    "tripDraft",
    JSON.stringify(updateDraft(initialDraft(), ready())),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
  await act(async () =>
    root.render(
      <Router>
        <TripDraftProvider>
          <Probe />
          <form onSubmit={submit}>
            <ResetControl />
          </form>
        </TripDraftProvider>
      </Router>,
    ),
  );
  const click = async (text: string) => {
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(text),
    )!;
    await act(async () => button.click());
  };
  await click("全部重置");
  await click("保留草稿");
  expect(submit).not.toHaveBeenCalled();
  expect(latest.draft.destinationCity).toBe("北京");
  await click("全部重置");
  await click("确认全部重置");
  expect(submit).not.toHaveBeenCalled();
  expect(localStorage.getItem("tripDraft")).toBeNull();
});
it("真实酒店未知参数在草稿恢复后仍保持未知", () => {
  const liveHotel = {
    ...hotel,
    source: "live" as const,
    subwayDistance: null,
    overallRating: null,
    reviewCount: null,
    starLevel: null,
    userScore: null,
    renovationYear: null,
    lat: null,
    lng: null,
  };
  const saved = {
    ...initialDraft(),
    hotelResults: [liveHotel],
    selectedHotel: liveHotel,
    hotelSearchStatus: "success",
  };
  const restored = restoreDraft(JSON.stringify(saved));
  expect(restored.selectedHotel?.id).toBe(hotel.id);
  expect(restored.selectedHotel?.subwayDistance).toBeNull();
  expect(restored.hotelResults).toHaveLength(1);
});
it("飞猪外链拒绝携带嵌入式用户名或密码", () => {
  expect(
    getBookingUrl({
      ...hotel,
      source: "live",
      bookingUrl: "https://user:secret@router.feizhu.com/x",
    }),
  ).toBeUndefined();
});

it("图片失效后显示通用风景，不冒充地点实拍", async () => {
  await act(async () =>
    root.render(
      <Media
        place={{
          ...place,
          image: "https://img.alicdn.com/scene.jpg",
          imageSource: "高德地点图片",
        }}
      />,
    ),
  );
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "scene.jpg",
  );
  await act(async () =>
    container.querySelector("img")?.dispatchEvent(new Event("error")),
  );
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "/images/fallback-landscape.webp",
  );
  expect(container.querySelector("img")?.getAttribute("alt")).toContain(
    "非实拍",
  );
  expect(container.textContent).toContain("通用风景示意图");
});

it("品牌卡片精确展示八项；多选、取消、不限和刷新持久化有效", async () => {
  localStorage.setItem("tripDraft", JSON.stringify(ready()));
  await act(async () =>
    root.render(
      <Router>
        <TripDraftProvider>
          <Probe />
          <HotelBrandPreference />
        </TripDraftProvider>
      </Router>,
    ),
  );
  const buttons = [
    ...container.querySelectorAll<HTMLButtonElement>(".brand-options button"),
  ];
  expect(buttons.map((b) => b.textContent?.trim())).toEqual([
    "不限品牌保持开放，发现更多选择",
    "华住会",
    "希尔顿",
    "万豪",
    "洲际",
    "凯悦",
    "雅高",
    "首旅",
  ]);
  await act(async () => {
    buttons[1].click();
    buttons[2].click();
  });
  expect(latest.draft.brandPreference).toEqual(["华住会", "希尔顿"]);
  expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
  expect(buttons[2].getAttribute("aria-pressed")).toBe("true");
  expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
  expect(
    restoreDraft(localStorage.getItem("tripDraft")).brandPreference,
  ).toEqual(["华住会", "希尔顿"]);
  await act(async () => buttons[1].click());
  expect(latest.draft.brandPreference).toEqual(["希尔顿"]);
  await act(async () => buttons[0].click());
  expect(latest.draft.brandPreference).toEqual([]);
  expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  expect(container.textContent).not.toContain("品牌图待补充");
});
it("旧品牌草稿保留并提示用户重选，不静默变成不限品牌", async () => {
  localStorage.setItem(
    "tripDraft",
    JSON.stringify({ ...ready(), brandPreference: ["锦江"] }),
  );
  await act(async () =>
    root.render(
      <Router>
        <TripDraftProvider>
          <Probe />
          <HotelBrandPreference />
        </TripDraftProvider>
      </Router>,
    ),
  );
  expect(latest.draft.brandPreference).toEqual(["锦江"]);
  expect(container.textContent).toContain("已移出本次范围");
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>(".brand-options button"),
  ].find((b) => b.textContent?.trim() === "首旅")!;
  await act(async () => button.click());
  expect(latest.draft.brandPreference).toEqual(["首旅"]);
});

it("旧地铁筛选恢复时移除，其他偏好及已选酒店保留，请求不再发送旧字段", () => {
  const previous = {
    ...ready(),
    rawPrompt: "保留行程",
    selectedHotel: hotel,
    hotelResults: [hotel],
    tripPlaces: [place],
    brandPreference: ["华住会"],
    hotelFilters: {
      ...initialDraft().hotelFilters,
      priceRange: [400, 800] as [number, number],
      subwayDistance: 300,
    },
  };
  const restored = restoreDraft(JSON.stringify(previous));
  expect(restored.rawPrompt).toBe("保留行程");
  expect(restored.selectedHotel).toEqual(hotel);
  expect(restored.tripPlaces).toEqual([place]);
  expect(restored.brandPreference).toEqual(["华住会"]);
  expect(restored.hotelFilters.priceRange).toEqual([400, 800]);
  expect(restored.hotelFilters).not.toHaveProperty("subwayDistance");
  expect(hotelPayload(previous)).not.toHaveProperty("subwayDistance");
  expect(updateDraft(previous, {}).hotelFilters).not.toHaveProperty(
    "subwayDistance",
  );
});
