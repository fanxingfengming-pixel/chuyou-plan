const known = (value) => typeof value === "number" && Number.isFinite(value);
const amount = (value) =>
  Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
export function factHotelReason(hotel) {
  const facts = known(hotel.price)
    ? ["供应方每晚起价 ¥" + amount(hotel.price)]
    : ["高德地图已定位；报价待核实"];
  if (known(hotel.overallRating))
    facts.push(
      "展示评分 " + hotel.overallRating.toFixed(1) + "/10（供应方评分换算）",
    );
  if (known(hotel.coreDistance))
    facts.push("距核心地点约 " + hotel.coreDistance + " 公里（直线）");
  if (known(hotel.renovationYear)) facts.push(hotel.renovationYear + " 年装修");
  return facts.join("；") + "。房型、床位或整间房及入住人数需在飞猪核对。";
}
export function getHotelHighlights(items, recommendedId) {
  const available = items.filter((h) => h && known(h.price));
  const used = new Set();
  const result = [];
  const take = (list, label, prefix) => {
    const hotel = list.find((h) => !used.has(h.id));
    if (!hotel) return;
    used.add(hotel.id);
    result.push({ hotel, label, reason: prefix + factHotelReason(hotel) });
  };
  const balanced = [...available].sort(
    (a, b) =>
      (b.overallRating ?? 0) - (a.overallRating ?? 0) ||
      (a.coreDistance ?? Infinity) - (b.coreDistance ?? Infinity) ||
      a.price - b.price ||
      a.id.localeCompare(b.id),
  );
  const preferred = available.find((h) => h.id === recommendedId);
  take(
    preferred ? [preferred, ...balanced] : balanced,
    "综合推荐",
    preferred
      ? "结合你的偏好，从本次候选中选择。已知信息："
      : "按本次候选的已知评分、距离和报价排序。",
  );
  take(
    [...available].sort(
      (a, b) => a.price - b.price || a.id.localeCompare(b.id),
    ),
    "价格较优",
    "在其余候选中优先较低起价。",
  );
  const located = available
    .filter((h) => known(h.coreDistance))
    .sort(
      (a, b) =>
        a.coreDistance - b.coreDistance ||
        a.price - b.price ||
        a.id.localeCompare(b.id),
    );
  if (located.some((h) => !used.has(h.id)))
    take(located, "距核心较近", "在其余候选中优先较短直线距离。");
  else take(balanced, "备选参考", "核心地点距离资料不足，保留一个其他候选。");
  return result;
}
