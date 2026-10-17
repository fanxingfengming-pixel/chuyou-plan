import type { PackingItem, TripDraft } from "./types";
export function suggestedPacking(d: TripDraft): PackingItem[] {
  const rows = [
    ["id", "身份证件", "出发前确认身份证件与预订信息。"],
    ["phone", "手机与充电器", "带上常用充电线。"],
    ["clothes", "换洗衣物", "按 " + d.tripDays + " 天行程与洗衣安排准备。"],
    ["wash", "个人洗护用品", "按个人习惯准备。"],
    ["shoes", "舒适鞋履", "城市步行时使用。"],
    ["water", "随行水杯", "按实际出行条件携带。"],
  ];
  if (d.tripDays >= 3) rows.push(["bag", "备用收纳袋", "分开放置衣物和小件。"]);
  if (d.children > 0)
    rows.push(["child", "儿童随行用品", "按儿童年龄准备换洗衣物与日常用品。"]);
  if (d.selectedTransportMode === "flight")
    rows.push([
      "flight",
      "登机与行李核对",
      "出发前核对航司关于液体、电池和行李的要求。",
    ]);
  if (d.selectedTransportMode === "rail")
    rows.push(["rail", "车次与乘车信息", "核对车站、日期与乘车证件。"]);
  return rows.map(([id, name, note]) => ({
    id: "suggested-" + id,
    name,
    note,
    packed: false,
    origin: "suggested",
  }));
}
export function reconcilePacking(d: TripDraft): PackingItem[] {
  const suggestions = suggestedPacking(d).filter(
    (p) => !d.suppressedPackingIds.includes(p.id),
  );
  const activeIds = new Set(suggestions.map((p) => p.id));
  return [
    ...suggestions.map((p) => {
      const old = d.packingItems.find((x) => x.id === p.id);
      return old ? (old.customized ? old : { ...p, packed: old.packed }) : p;
    }),
    ...d.packingItems.filter(
      (p) =>
        !activeIds.has(p.id) &&
        (p.origin === "custom" ||
          (!d.suppressedPackingIds.includes(p.id) &&
            (p.customized || p.packed))),
    ),
  ];
}
