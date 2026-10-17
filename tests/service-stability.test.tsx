// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import caps from "../shared/hotel-capabilities.json";
vi.mock("../src/planning/serviceClient", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/planning/serviceClient")>();
  return {
    ...actual,
    isLiveMode: true,
    getServiceHealth: vi.fn(),
    getHotelCapabilities: vi.fn(),
  };
});
import {
  getHotelCapabilities,
  getServiceHealth,
} from "../src/planning/serviceClient";
import { ServiceStatusProvider } from "../src/planning/ServiceStatusProvider";
import { ServiceStatus } from "../src/planning/components/ServiceStatus";
import { HotelFilters } from "../src/planning/components/HotelPages";
import {
  TripDraftProvider,
  useTripDraft,
} from "../src/planning/TripDraftProvider";
import { Router } from "../src/planning/router";
import { selectHighlights } from "../src/planning/services";
import type { Hotel } from "../src/planning/types";
let root: Root,
  container: HTMLDivElement,
  latest: ReturnType<typeof useTripDraft>;
function Probe() {
  latest = useTripDraft();
  return null;
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  if (!HTMLElement.prototype.scrollIntoView)
    HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(getServiceHealth).mockResolvedValue({
    app: "chuyou-plan",
    localService: "ready",
    runtimeMode: "local",
  });
  vi.mocked(getHotelCapabilities).mockResolvedValue(caps);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(
      <ServiceStatusProvider>
        <Router>
          <TripDraftProvider>
            <Probe />
            <ServiceStatus />
            <HotelFilters />
          </TripDraftProvider>
        </Router>
      </ServiceStatusProvider>,
    ),
  );
}
it("未支持条件禁用，旧筛选值需主动清除，其他预算及草稿保持", async () => {
  await mount();
  await act(async () =>
    latest.patch({
      rawPrompt: "长沙去杭州",
      hotelFilters: {
        ...latest.draft.hotelFilters,
        priceRange: [400, 800],
        reviewCount: 500,
        facilities: ["早餐"],
      },
    }),
  );
  expect(container.querySelector('[aria-label="距地铁距离"]')).toBeNull();
  expect(
    container.querySelector<HTMLSelectElement>('[aria-label="酒店星级"]')
      ?.disabled,
  ).toBe(true);
  expect(latest.draft.hotelFilters.reviewCount).toBe(500);
  const buttons = () => Array.from(container.querySelectorAll("button"));
  const search = buttons().find((b) =>
    b.textContent?.includes("搜索适合的酒店"),
  )!;
  expect(search.disabled).toBe(false);
  await act(async () => search.click());
  expect(
    container.querySelector('.step-blocker[role="alert"]')?.textContent,
  ).toContain("请先主动清除暂不支持");
  expect(latest.draft.hotelSearchStatus).toBe("idle");
  expect(latest.draft.hotelFilters.reviewCount).toBe(500);
  await act(async () =>
    buttons()
      .find((b) => b.textContent === "清除未支持条件")!
      .click(),
  );
  expect(latest.draft.hotelFilters.reviewCount).toBe(0);
  expect(latest.draft.hotelFilters.facilities).toEqual([]);
  expect(latest.draft.hotelFilters.priceRange).toEqual([400, 800]);
  expect(latest.draft.rawPrompt).toBe("长沙去杭州");
  expect(search.disabled).toBe(false);
});
it("服务中断显示恢复操作，恢复检查不清空草稿", async () => {
  vi.mocked(getServiceHealth).mockRejectedValueOnce(new Error("offline"));
  await mount();
  await act(async () => latest.patch({ rawPrompt: "保留我的旅行想法" }));
  expect(container.textContent).toContain("本地服务暂不可用");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "重新检查服务")!
      .click(),
  );
  expect(container.textContent).toContain("本地服务在线");
  expect(latest.draft.rawPrompt).toBe("保留我的旅行想法");
});
it("旧草稿中的绝对化推荐文案不继续显示", () => {
  const hotel = {
    id: "x",
    name: "酒店",
    price: 300,
    overallRating: 8,
    coreDistance: 5,
    renovationYear: null,
    source: "live",
    reason: "品质出色，地铁零距离",
    highlightLabel: "最推荐",
  } as Hotel;
  const picks = selectHighlights([hotel]);
  expect(picks[0].reason).not.toMatch(/品质出色|零距离/);
  expect(picks[0].reason).toContain("直线");
  expect(picks[0].label).toBe("综合推荐");
});
