import capabilities from "../shared/hotel-capabilities.json" with { type: "json" };
import { AppError } from "./errors.js";
export { capabilities };
export function unsupportedFilters(filters) {
  return [
    [filters.starLevel > 0, "数字星级"],
    [filters.reviewCount > 0, "评论数量"],
    [
      Array.isArray(filters.facilities) && filters.facilities.length > 0,
      "设施",
    ],
  ]
    .filter(([active]) => active)
    .map(([, label]) => label);
}
export function assertSupportedFilters(filters) {
  const names = unsupportedFilters(filters);
  if (names.length)
    throw new AppError(
      "UNSUPPORTED_FILTERS",
      "当前数据源暂不支持" +
        names.join("、") +
        "，请主动清除这些条件后再搜索。",
      422,
    );
}
