export const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function beijingToday(now = new Date()) { return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function liveDateError(d, now = new Date()) {
  if (d.dateMode === "fuzzy" || !validDate(d.departureDate)) return "实时查询需要有效的精确出发日期，请先修改旅行信息。";
  if (d.departureDate < beijingToday(now)) return "出发日期已过去，请修改日期后再查询实时价格与班次。历史行程仍可查看和导出。";
  if (d.returnDate && (!validDate(d.returnDate) || d.returnDate < d.departureDate)) return "返程日期应为有效日期，且不早于出发日期。";
  return "";
}
export function detailsIssue(d) {
  if (!d.originCity.trim()) return {field:"originCity",message:"请补齐出发地。"};
  if (!d.destinationCity.trim() || d.originCity.trim() === d.destinationCity.trim()) return {field:"destinationCity",message:"请补齐目的地，且出发地与目的地不能相同。"};
  if (d.dateMode === "fuzzy" ? !d.fuzzyDateText.trim() : !validDate(d.departureDate)) return {field:d.dateMode === "fuzzy" ? "fuzzyDateText" : "departureDate",message:"请补齐有效的出发时间。"};
  if ((d.dateMode === "range" || d.returnDate) && (!validDate(d.returnDate) || d.returnDate < d.departureDate)) return {field:"returnDate",message:"返程日期应为有效日期，且不早于出发日期。"};
  if (!Number.isInteger(d.tripDays) || d.tripDays < 1 || d.tripDays > 30) return {field:"tripDays",message:"游玩天数请填写 1–30 的整数。"};
  for (const [field,min] of [["adults",1],["children",0]]) if (!Number.isInteger(d[field]) || d[field] < min || d[field] > 20) return {field,message:field === "adults" ? "成人数请填写 1–20 的整数。" : "儿童数请填写 0–20 的整数。"};
  return null;
}
