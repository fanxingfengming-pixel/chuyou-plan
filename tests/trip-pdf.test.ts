import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { initialDraft } from "../src/planning/model";
import {
  createTripPdf,
  tripPdfFilename,
  tripPdfSections,
} from "../src/planning/tripPdf";
import type { Catalog, TripDraft } from "../src/planning/types";
import data from "../public/mock/v2/catalog.json";
const city = (data as unknown as Catalog).cities.杭州;
const places = city.places.slice(0, 3);
const fixture = (): TripDraft => ({
  ...initialDraft(),
  originCity: "长沙",
  destinationCity: "杭州",
  planningMode: "area",
  dateMode: "exact",
  departureDate: "2026-10-18",
  returnDate: "2026-10-20",
  tripDays: 3,
  adults: 2,
  children: 1,
  selectedTransportMode: "rail",
  selectedHotel: city.hotels[0],
  tripPlaces: places,
  selectedPlaces: [places[0]],
  primaryPlace: places[0],
  localTransportPreference: "步行 + 公共交通",
  rawPrompt: "带孩子慢慢游玩，晚上早点休息。",
  hotelResults: [{ ...city.hotels[1], name: "未选择酒店不应导出" }],
  recommendedDistricts: ["未确认推荐区域不应导出"],
  lastUpdatedAt: "2026-10-17T02:00:00Z",
  routeDraft: {
    generatedAt: "2026-10-17T01:00:00Z",
    needsOptimization: true,
    days: [
      {
        day: 1,
        stops: [places[1], places[0]].map((p) => ({
          id: p.id,
          placeId: p.id,
          name: p.name,
          kind: "place",
          period: "早上",
        })),
      },
      {
        day: 2,
        stops: [
          {
            id: "lunch",
            kind: "meal",
            name: "附近用餐 · 自由选择",
            period: "中午",
          },
          {
            id: places[2].id,
            placeId: places[2].id,
            name: places[2].name,
            kind: "place",
            period: "下午",
          },
        ],
      },
      { day: 3, stops: [] },
    ],
  },
});
const exportedAt = new Date("2026-10-17T03:00:00Z");
const text = (draft: TripDraft) =>
  tripPdfSections(draft, exportedAt)
    .flatMap((s) => [s.title, ...s.lines])
    .join("\n");
describe("行程 PDF 内容与真实文件", () => {
  it("只导出已选内容，保留当前顺序、空白日及调整状态，且不修改草稿", () => {
    const draft = fixture(),
      before = structuredClone(draft);
    const sections = tripPdfSections(draft, exportedAt);
    const first = sections.find((s) => s.title.startsWith("第 1 天"))!;
    expect(first.title).toContain("2026-10-18");
    expect(
      first.lines.findIndex((l) => l.includes(places[1].name)),
    ).toBeLessThan(first.lines.findIndex((l) => l.includes(places[0].name)));
    expect(text(draft)).toContain("尚未重新优化");
    expect(text(draft)).toContain("本日暂无已安排地点");
    expect(text(draft)).not.toContain("未选择酒店不应导出");
    expect(text(draft)).not.toContain("未确认推荐区域不应导出");
    expect(draft).toEqual(before);
  });
  it("模糊与范围日期不推断具体每日日期", () => {
    const fuzzy = {
      ...fixture(),
      dateMode: "fuzzy" as const,
      fuzzyDateText: "下个月周末",
    };
    expect(text(fuzzy)).toContain("下个月周末（大致日期，待确认）");
    expect(
      tripPdfSections(fuzzy).find((s) => s.title.startsWith("第 1 天"))?.title,
    ).toBe("第 1 天");
    const range = { ...fixture(), dateMode: "range" as const };
    expect(text(range)).toContain("具体日期待确认");
    expect(
      tripPdfSections(range).find((s) => s.title.startsWith("第 1 天"))?.title,
    ).toBe("第 1 天");
  });
  it("标明模拟报价、规划选择与路线局限，不把缺失信息伪造为确认数据", () => {
    const draft = fixture();
    expect(text(draft)).toContain("模拟数据");
    expect(text(draft)).toContain("非订单成交价");
    expect(text(draft)).toContain("不包含实际道路导航");
    expect(
      text({
        ...draft,
        selectedHotel: null,
        selectedTransportMode: null,
        departureDate: "",
        returnDate: "",
      }),
    ).toContain("尚未确认酒店");
    expect(text(draft)).toContain("2026/10/17 11:00（北京时间）");
  });
  it("未生成路线时禁止导出，中文文件名过滤路径字符", () => {
    expect(() => tripPdfSections(initialDraft())).toThrow("请先生成");
    expect(tripPdfFilename(fixture())).toBe("出游plan_杭州行程_2026-10-18.pdf");
    expect(
      tripPdfFilename({ ...fixture(), destinationCity: "杭/州:旅行?" }),
    ).toBe("出游plan_杭州旅行行程_2026-10-18.pdf");
  });
  it("使用实际中文字体生成可读取的多页 PDF", async () => {
    const font = new Uint8Array(
      readFileSync("public/fonts/NotoSansSC-Regular.ttf"),
    );
    const bytes = await createTripPdf(fixture(), font, exportedAt);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("出游plan · 杭州旅行行程");
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(bytes.length).toBeLessThan(8000000);
    const repeated = await createTripPdf(fixture(), font, exportedAt);
    expect(repeated.length).toBeLessThan(8000000);
    expect((await PDFDocument.load(repeated)).getPageCount()).toBe(
      pdf.getPageCount(),
    );
    mkdirSync("artifacts/pdf", { recursive: true });
    writeFileSync("artifacts/pdf/sample-itinerary.pdf", bytes);
    writeFileSync(
      "artifacts/pdf/sample-draft.json",
      JSON.stringify(fixture(), null, 2),
    );
  }, 20000);
  it("长中文地址与 30 天行程自动分页且保留末尾内容", async () => {
    const draft = fixture();
    draft.tripDays = 30;
    draft.rawPrompt = "希望旅程轻松一些，注意合理休息和沿途探索。".repeat(30);
    draft.tripPlaces = draft.tripPlaces.map((p) => ({
      ...p,
      address: "较长的中文街道地址用于检查自动换行与分页。".repeat(15),
    }));
    draft.routeDraft!.days = Array.from({ length: 30 }, (_, index) => ({
      day: index + 1,
      stops: draft.routeDraft!.days[0].stops,
    }));
    const bytes = await createTripPdf(
      draft,
      new Uint8Array(readFileSync("public/fonts/NotoSansSC-Regular.ttf")),
      exportedAt,
    );
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(10);
    writeFileSync("artifacts/pdf/long-itinerary.pdf", bytes);
  }, 30000);
});

it("已删除的地铁筛选不进入导出的筛选偏好摘要", () => {
  const draft = {
    ...fixture(),
    hotelFilters: { ...initialDraft().hotelFilters, subwayDistance: 300 },
  };
  expect(JSON.stringify(tripPdfSections(draft))).not.toContain("距地铁不超过");
});
