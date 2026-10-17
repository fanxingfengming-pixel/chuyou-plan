import { mapGeometry, dayColors } from "./mapGeometry";
import { routeNumbers, legLabel } from "./routeEngine";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TripDraft } from "./types";

export interface TripPdfSection {
  title: string;
  lines: string[];
}
const transportNames = { rail: "高铁 / 火车", flight: "飞机", drive: "自驾" };
const sourceLabel = (source: string) =>
  source === "mock"
    ? "模拟数据"
    : source === "live"
      ? "查询数据"
      : "来源待核实";
const value = (text: string | undefined | null) => text?.trim() || "待确认";
const timestamp = (text: string) => {
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? "待确认"
    : new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date) + "（北京时间）";
};
export function tripPdfFilename(draft: TripDraft) {
  const city = (draft.destinationCity || "旅行")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 60);
  const date =
    draft.dateMode === "exact" &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.departureDate)
      ? "_" + draft.departureDate
      : "";
  return `出游plan_${city || "旅行"}行程${date}.pdf`;
}
function dayDate(draft: TripDraft, day: number) {
  if (
    draft.dateMode !== "exact" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.departureDate)
  )
    return "";
  const date = new Date(draft.departureDate + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + day - 1);
  return " · " + date.toISOString().slice(0, 10);
}
// Read the confirmed draft as it stands. Export must never regenerate or optimize it.
export function tripPdfSections(
  draft: TripDraft,
  exportedAt = new Date(),
): TripPdfSection[] {
  const route = draft.routeDraft;
  if (!route || !route.days.length)
    throw new Error("请先生成行程路线，再导出 PDF。");
  if (route.schemaVersion === 21 && route.status === "ready")
    return memoSections(draft, exportedAt);
  const chosenTransport = draft.transportOptions.find(
    (option) => option.mode === draft.selectedTransportMode,
  );
  const dates =
    draft.dateMode === "fuzzy"
      ? value(draft.fuzzyDateText) + "（大致日期，待确认）"
      : draft.dateMode === "range"
        ? `${value(draft.departureDate)} 至 ${value(draft.returnDate)}（可出行范围，具体日期待确认）`
        : `${value(draft.departureDate)} 出发 · ${value(draft.returnDate)} 返回`;
  const sections: TripPdfSection[] = [
    {
      title: "旅行信息与出行选择",
      lines: [
        `出发 / 目的地：${value(draft.originCity)} → ${value(draft.destinationCity)}`,
        `日期：${dates}`,
        `时长 / 人数：${draft.tripDays} 天 · ${draft.adults} 位成人 · ${draft.children} 位儿童`,
        `城际交通：${draft.selectedTransportMode ? transportNames[draft.selectedTransportMode] : "待确认"}（出行方式选择，未确认订票）`,
        ...(chosenTransport
          ? [
              `交通查询参考：${chosenTransport.title} · ${chosenTransport.duration} · ${chosenTransport.priceLabel}（${sourceLabel(chosenTransport.source)}）`,
            ]
          : []),
        `市内交通：${value(draft.localTransportPreference)}`,
        `住宿规划方式：${draft.planningMode === "area" ? "按区域选择" : draft.planningMode === "hotel" ? "按酒店 / 品牌选择" : "待确认"}`,
        ...(draft.primaryPlace ? [`核心地点：${draft.primaryPlace.name}`] : []),
        ...(draft.selectedPlaces.length
          ? [
              `已选住宿参考地点：${draft.selectedPlaces.map((p) => p.name).join("、")}`,
            ]
          : []),
        ...(draft.brandPreference.length
          ? [`酒店品牌偏好：${draft.brandPreference.join("、")}`]
          : []),
        ...(draft.rawPrompt.trim() ? [`原始旅行偏好：${draft.rawPrompt}`] : []),
      ],
    },
  ];
  const hotel = draft.selectedHotel;
  sections.push({
    title: "已选住宿",
    lines: hotel
      ? [
          `酒店：${hotel.name}（已确认用于行程规划）`,
          `位置：${value(hotel.city)} · ${value(hotel.district)}`,
          `每晚查询参考价：${hotel.price !== null && Number.isFinite(hotel.price) && hotel.price > 0 ? "¥" + hotel.price.toLocaleString("zh-CN") : "待核实"}（${sourceLabel(hotel.source)}；非订单成交价）`,
          ...(hotel.queriedAt
            ? [`报价查询时间：${timestamp(hotel.queriedAt)}`]
            : []),
          ...(hotel.facilities.length
            ? [`设施：${hotel.facilities.join("、")}`]
            : []),
          "住宿选择不代表已预订；房型、库存、税费和最终总价请在预订平台确认。",
        ]
      : ["尚未确认酒店。每日出发点与住宿位置待确认。"],
  });
  const f = draft.hotelFilters;
  sections.push({
    title: "住宿筛选偏好",
    lines: [
      `每晚价格范围：¥${f.priceRange[0]} - ¥${f.priceRange[1]}（筛选条件）`,
      ...(f.selectedDistricts.length
        ? [`已选区域：${f.selectedDistricts.join("、")}`]
        : []),
      ...(f.overallRating > 0 ? [`最低综合评分：${f.overallRating}`] : []),
      ...(f.starLevel > 0 ? [`最低星级：${f.starLevel}`] : []),
      ...(f.minRenovationYear > 0
        ? [`装修年份：${f.minRenovationYear} 年及以后`]
        : []),
      ...(f.reviewCount > 0 ? [`最低评价数量：${f.reviewCount}`] : []),
      ...(f.userScore > 0 ? [`最低用户评分：${f.userScore}`] : []),
      ...(f.facilities.length ? [`所需设施：${f.facilities.join("、")}`] : []),
    ],
  });
  sections.push({
    title: `已加入行程的地点 · ${draft.tripPlaces.length} 个`,
    lines: draft.tripPlaces.length
      ? draft.tripPlaces.flatMap((place, index) => [
          `${index + 1}. ${place.name} · ${place.type}（${sourceLabel(place.source)}）`,
          `地址：${value(place.address)} · ${value(place.district)}`,
        ])
      : ["尚未选择景点。"],
  });
  sections.push({
    title: "每日路线",
    lines: [
      "以下按当前草稿顺序导出，保留手动调整的天数与先后顺序。时段仅为大概安排。",
      "路线按地理关系提供顺序建议，不包含实际道路导航、精确耗时、开放时间或预约校验。",
      ...(route.needsOptimization
        ? ["当前顺序已修改，尚未重新优化；本文件保留你的最新安排。"]
        : []),
    ],
  });
  for (const day of route.days) {
    const hotelName = hotel?.name || "住宿地点待确认";
    sections.push({
      title: `第 ${day.day} 天${dayDate(draft, day.day)}`,
      lines: [
        `出发：${hotelName} · ${value(draft.localTransportPreference)}`,
        ...(day.stops.length
          ? day.stops.flatMap((stop, index) => {
              const place = draft.tripPlaces.find((p) => p.id === stop.placeId);
              return [
                `${index + 1}. ${stop.period} · ${stop.name}${stop.kind === "meal" ? "（用餐建议，餐厅未确定）" : ""}`,
                ...(stop.kind === "place"
                  ? [
                      place
                        ? `   地址：${value(place.address)} · ${value(place.district)}（${sourceLabel(place.source)}）`
                        : "   地点信息待核实",
                    ]
                  : []),
              ];
            })
          : ["自由活动：本日暂无已安排地点，可自行探索。"]),
        `返程：返回 ${hotelName} / 自由活动（建议）`,
      ],
    });
  }

  sections.push({
    title: "携带物品与备忘",
    lines: [
      "已备好 " +
        draft.packingItems.filter((p) => p.packed).length +
        " / " +
        draft.packingItems.length +
        " 项",
      ...draft.packingItems.map(
        (p) =>
          (p.packed ? "已备好：" : "待准备：") +
          p.name +
          (p.note ? "；备注：" + p.note : ""),
      ),
    ],
  });
  sections.push({
    title: "出发前核对",
    lines: [
      "请确认酒店和车票 / 机票预订、景点开放时间、预约要求及当天交通情况。",
      "模拟数据已在对应条目标注；查询价格和出行参考可能变化，不代表库存、订单或支付确认。",
      `草稿更新时间：${timestamp(draft.lastUpdatedAt)}`,
      `路线生成时间：${timestamp(route.generatedAt)}`,
      `文件导出时间：${timestamp(exportedAt.toISOString())}`,
    ],
  });
  return sections;
}

const PAGE_WIDTH = 595.28,
  PAGE_HEIGHT = 841.89,
  MARGIN = 46;
const INK = rgb(0.235, 0.169, 0.137),
  MUTED = rgb(0.459, 0.388, 0.341);
const ACCENT = rgb(0.655, 0.294, 0.208),
  LINE = rgb(0.89, 0.835, 0.78);
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

class PdfLayout {
  page!: PDFPage;
  y = 0;
  compact = false;
  private supported: Set<number>;
  replacedSymbols = false;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
  ) {
    this.supported = new Set(font.getCharacterSet());
  }
  clean(text: string) {
    return Array.from(
      text
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
        .replace(/\t/g, " ")
        .replace(/[\ufe0e\ufe0f]/g, ""),
    )
      .map((char) => {
        if (
          char === "\n" ||
          char === "\r" ||
          this.supported.has(char.codePointAt(0)!)
        )
          return char;
        this.replacedSymbols = true;
        return "□";
      })
      .join("");
  }
  newPage(first = false) {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 8,
      width: PAGE_WIDTH,
      height: 8,
      color: ACCENT,
    });
    this.page.drawText("出游plan / 旅行行程", {
      x: MARGIN,
      y: PAGE_HEIGHT - 39,
      size: 10,
      font: this.font,
      color: ACCENT,
    });
    this.y = PAGE_HEIGHT - (first ? 73 : 68);
  }
  ensure(height: number) {
    if (this.y - height < 65) this.newPage();
  }
  wrap(text: string, size: number) {
    const lines: string[] = [];
    for (const paragraph of this.clean(text).split(/\r?\n/)) {
      let line = "";
      for (const char of Array.from(paragraph)) {
        if (
          line &&
          this.font.widthOfTextAtSize(line + char, size) > CONTENT_WIDTH
        ) {
          lines.push(line);
          line = char;
        } else line += char;
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, size = 10, color = INK, spacing = 4) {
    const height = size * (this.compact ? 1.5 : 1.7);
    for (const line of this.wrap(text, size)) {
      this.ensure(height);
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y - size,
        size,
        font: this.font,
        color,
      });
      this.y -= height;
    }
    this.y -= spacing;
  }
  routeMap(draft: TripDraft) {
    if (!draft.routeDraft?.hotelAnchor) return;
    this.ensure(220);
    this.text(
      "旅行路线草图 · H酒店 / 景点全局连续编号 · 北向上",
      11,
      ACCENT,
      3,
    );
    const map = mapGeometry(draft.routeDraft),
      height = 180,
      width = CONTENT_WIDTH,
      top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width,
      height,
      color: rgb(1, 0.98, 0.95),
      borderColor: LINE,
      borderWidth: 0.5,
    });
    const project = (p: { x: number; y: number }) => ({
      x:
        MARGIN +
        (width - 900 * Math.min(width / 900, height / 600)) / 2 +
        p.x * Math.min(width / 900, height / 600),
      y: top - p.y * Math.min(width / 900, height / 600),
    });
    for (const line of map.lines) {
      const color = dayColors[(line.day - 1) % dayColors.length],
        r = parseInt(color.slice(1, 3), 16) / 255,
        g = parseInt(color.slice(3, 5), 16) / 255,
        b = parseInt(color.slice(5, 7), 16) / 255;
      for (let i = 1; i < line.points.length; i++)
        this.page.drawLine({
          start: project(line.points[i - 1]),
          end: project(line.points[i]),
          thickness: 0.9,
          color: rgb(r, g, b),
          ...(line.schematic ? { dashArray: [3, 3] } : {}),
        });
    }
    for (const point of map.points) {
      const p = project(point);
      this.page.drawCircle({
        x: p.x,
        y: p.y,
        size: 7,
        color: point.label === "H" ? INK : rgb(1, 0.99, 0.97),
        borderColor: ACCENT,
        borderWidth: 1,
      });
      this.page.drawText(point.label, {
        x: p.x - this.font.widthOfTextAtSize(point.label, 8) / 2,
        y: p.y - 3,
        size: 8,
        font: this.font,
        color: point.label === "H" ? rgb(1, 1, 1) : ACCENT,
      });
    }
    this.y -= height + 8;
    this.text(
      "高德MCP真实坐标与距离/耗时；" +
        (map.hasOfficialGeometry ? "高德官方路径服务补充轨迹；" : "") +
        (map.hasSchematic ? "虚线为点位示意，非道路轨迹；" : "") +
        "草图非实时导航。",
      8,
      MUTED,
      5,
    );
  }
  columns(lines: string[]) {
    const size = 8.5,
      gap = 18,
      colWidth = (CONTENT_WIDTH - gap) / 2;
    const wrap = (text: string) => {
      const result: string[] = [];
      let row = "";
      for (const ch of this.clean(text)) {
        if (row && this.font.widthOfTextAtSize(row + ch, size) > colWidth) {
          result.push(row);
          row = ch;
        } else row += ch;
      }
      if (row) result.push(row);
      return result;
    };
    for (let i = 0; i < lines.length; i += 2) {
      const left = wrap(lines[i]),
        right = wrap(lines[i + 1] || ""),
        height = Math.max(left.length, right.length) * 14 + 6;
      this.ensure(height);
      for (const [col, rows] of [
        [0, left],
        [1, right],
      ] as const)
        rows.forEach((line, j) =>
          this.page.drawText(line, {
            x: MARGIN + col * (colWidth + gap),
            y: this.y - size - j * 14,
            size,
            font: this.font,
            color: INK,
          }),
        );
      this.y -= height;
    }
  }
  section(section: TripPdfSection) {
    // Keep a heading with its first lines; long content continues onto later pages.
    const headingLines = this.wrap(section.title, 15);
    this.ensure(headingLines.length * 25.5 + 70);
    this.y -= 17;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.65,
      color: LINE,
    });
    this.y -= 12;
    this.text(section.title, 15, ACCENT, 9);
    for (const line of section.lines) this.text(line);
  }
  finish() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: 47 },
        end: { x: PAGE_WIDTH - MARGIN, y: 47 },
        thickness: 0.5,
        color: LINE,
      });
      page.drawText("旅行规划参考 · 以实际预订与现场信息为准", {
        x: MARGIN,
        y: 29,
        size: 8,
        font: this.font,
        color: MUTED,
      });
      const label = `${index + 1} / ${pages.length}`;
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(label, 9),
        y: 28,
        size: 9,
        font: this.font,
        color: MUTED,
      });
    });
  }
}
export async function createTripPdf(
  draft: TripDraft,
  fontBytes: Uint8Array,
  exportedAt = new Date(),
) {
  const sections = tripPdfSections(draft, exportedAt);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(new Uint8Array(fontBytes), {
    subset: false,
  });
  doc.setTitle(`出游plan · ${draft.destinationCity}旅行行程`);
  doc.setAuthor("出游plan");
  doc.setSubject("用户选择与每日路线规划");
  doc.setLanguage("zh-CN");
  doc.setCreationDate(exportedAt);
  const layout = new PdfLayout(doc, font);
  layout.compact =
    draft.routeDraft?.schemaVersion === 21 &&
    draft.routeDraft.status === "ready";
  layout.newPage(true);
  layout.text(
    `${value(draft.destinationCity)}旅行行程`,
    layout.compact ? 22 : 26,
    INK,
    8,
  );
  layout.text(
    `${draft.tripDays} 天 · ${draft.adults} 位成人${draft.children ? ` · ${draft.children} 位儿童` : ""} · 保留当前选择与路线`,
    11,
    MUTED,
    6,
  );
  if (
    draft.routeDraft?.schemaVersion === 21 &&
    draft.routeDraft.status === "ready"
  ) {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      layout.ensure(65);
      layout.text(section.title, 13, ACCENT, 5);
      if (section.title === "携带与重要地点") {
        const places = section.lines.filter(
          (line) => !/^已备好：|^待准备：/.test(line),
        );
        const packing = section.lines.filter((line) =>
          /^已备好：|^待准备：/.test(line),
        );
        for (const line of places) layout.text(line, 9, INK, 2);
        layout.columns(packing);
      } else for (const line of section.lines) layout.text(line, 9, INK, 2);
      if (i === 0) layout.routeMap(draft);
      layout.y -= 8;
    }
  } else for (const section of sections) layout.section(section);
  if (layout.replacedSymbols)
    layout.text("提示：少量字体未收录的特殊符号以方框表示。", 9, MUTED);
  layout.finish();
  return doc.save();
}

let fontRequest: Promise<Uint8Array> | undefined;
function loadPdfFont() {
  if (!fontRequest) {
    fontRequest = fetch(
      `${import.meta.env.BASE_URL}fonts/NotoSansSC-Regular.ttf`,
      { signal: AbortSignal.timeout(60000) },
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("中文字体加载失败，请检查网络后重试。");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (
          bytes.length < 4 ||
          !(
            bytes[0] === 0 &&
            bytes[1] === 1 &&
            bytes[2] === 0 &&
            bytes[3] === 0
          )
        ) {
          throw new Error("中文字体文件不可用，请刷新页面后重试。");
        }
        return bytes;
      })
      .catch((error) => {
        fontRequest = undefined;
        throw error;
      });
  }
  return fontRequest;
}
export async function downloadTripPdf(draft: TripDraft) {
  const bytes = await createTripPdf(draft, await loadPdfFont());
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = tripPdfFilename(draft);
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give browsers time to consume the download before releasing the Blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function memoSections(draft: TripDraft, at: Date): TripPdfSection[] {
  const r = draft.routeDraft!,
    numbers = routeNumbers(r),
    h = draft.selectedHotel;
  const sections: TripPdfSection[] = [
    {
      title: "旅行备忘录",
      lines: [
        (draft.dateMode === "fuzzy"
          ? draft.fuzzyDateText
          : draft.departureDate +
            (draft.returnDate ? " 至 " + draft.returnDate : "")) +
          (draft.dateMode === "range" ? "（可出行范围）" : ""),
        "H · " +
          h?.name +
          " · " +
          (r.hotelAnchor?.address || h?.district || ""),
        "酒店仅为规划选择；" +
          (h?.price == null
            ? "报价待核实"
            : "供应方每晚起价 ¥" + h.price + "，非订单成交价"),
      ],
    },
  ];
  for (const day of r.days)
    sections.push({
      title: "第 " + day.day + " 天" + dayDate(draft, day.day),
      lines: [
        "H 酒店出发 → " +
          day.stops
            .map(
              (s) =>
                (s.kind === "place" ? numbers[s.placeId!] + ". " : "") +
                s.period +
                " " +
                s.name,
            )
            .join(" → ") +
          (day.stops.some((s) => s.kind === "place")
            ? " → H 返回酒店"
            : "酒店休整 / 自由安排"),
        ...(day.legs || []).map(
          (l) =>
            (l.from.id === r.hotelAnchor?.id ? "H" : numbers[l.from.id]) +
            " → " +
            (l.to.id === r.hotelAnchor?.id ? "H" : numbers[l.to.id]) +
            " · " +
            legLabel(l) +
            (l.mode === "transit" && l.instructions.length
              ? " · " + l.instructions.join(" → ")
              : ""),
        ),
      ],
    });
  sections.push({
    title: "携带与重要地点",
    lines: [
      ...r.days.flatMap((d) =>
        d.stops
          .filter((s) => s.kind === "place")
          .map((s) => {
            const p = draft.tripPlaces.find((p) => p.id === s.placeId);
            return (
              numbers[s.placeId!] +
              ". " +
              s.name +
              " · " +
              (p?.address || p?.district || "")
            );
          }),
      ),
      ...draft.packingItems.map(
        (p) =>
          (p.packed ? "已备好：" : "待准备：") +
          p.name +
          (p.note ? "；备注：" + p.note : ""),
      ),
    ],
  });
  sections.push({
    title: "查询与出发前核对",
    lines: [
      "路线：" +
        (r.hotelAnchor?.source === "mock"
          ? "显式模拟数据，不可用于实际出行"
          : "高德地图MCP真实查询") +
        "；查询时间：" +
        timestamp(r.generatedAt),
      "时段为大概安排，交通分钟数是查询参考；驾车不含叫车等待。请核对预订、开放与预约及公交运营。",
      "文件导出时间：" + timestamp(at.toISOString()),
    ],
  });
  return sections;
}
