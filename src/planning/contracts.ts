import type { TripDraft } from "./types";
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.length <= 2000;
const numbers = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));
const strings = (v: unknown) =>
  Array.isArray(v) && v.length <= 100 && v.every(text);
const source = (v: Record<string, unknown>) =>
  v.source === "mock" || v.source === "live";
const place = (v: unknown) =>
  object(v) &&
  ["id", "name", "city", "district", "address", "description"].every((k) =>
    text(v[k]),
  ) &&
  numbers(v, ["lat", "lng"]) &&
  Math.abs(Number(v.lat)) <= 90 &&
  Math.abs(Number(v.lng)) <= 180 &&
  ["景点", "商圈"].includes(String(v.type)) &&
  source(v);
const nullableNumbers = (v: Record<string, unknown>, keys: string[]) =>
  keys.every(
    (k) => v[k] === null || (typeof v[k] === "number" && Number.isFinite(v[k])),
  );
const hotel = (v: unknown) =>
  object(v) &&
  ["id", "name", "city", "district", "brand", "reason"].every((k) =>
    text(v[k]),
  ) &&
  (v.price === null || numbers(v, ["price"])) &&
  nullableNumbers(v, [
    "overallRating",
    "subwayDistance",
    "renovationYear",
    "starLevel",
    "reviewCount",
    "userScore",
    "lat",
    "lng",
  ]) &&
  Number(v.price) >= 0 &&
  strings(v.facilities) &&
  source(v);
const transport = (v: unknown) =>
  object(v) &&
  ["rail", "flight", "drive"].includes(String(v.mode)) &&
  ["title", "duration", "priceLabel", "reason"].every((k) => text(v[k])) &&
  typeof v.available === "boolean" &&
  source(v);
export function validateServiceResult(service: string, value: unknown) {
  let valid = false;
  if (service === "parse-trip") {
    const v = value as Partial<TripDraft>;
    valid =
      object(value) &&
      [
        "rawPrompt",
        "originCity",
        "destinationCity",
        "departureDate",
        "returnDate",
        "fuzzyDateText",
      ].every((k) => text(value[k])) &&
      ["exact", "fuzzy", "range"].includes(String(v.dateMode)) &&
      numbers(value, ["tripDays", "adults", "children"]) &&
      Number(v.adults) >= 1 &&
      Number(v.tripDays) >= 0 &&
      Number(v.tripDays) <= 30;
  } else if (
    service === "amap/search-place" ||
    service === "recommend-places" ||
    service === "area-recommendations"
  )
    valid = Array.isArray(value) && value.length <= 100 && value.every(place);
  else if (service === "amap/resolve-district" || service === "hotel-brands")
    valid = strings(value);
  else if (service === "flyai/search-hotels")
    valid = Array.isArray(value) && value.length <= 200 && value.every(hotel);
  else if (service === "hotels/search-name")
    valid =
      object(value) &&
      ["flyai", "amap"].includes(String(value.provider)) &&
      text(value.notice) &&
      Array.isArray(value.hotels) &&
      value.hotels.length <= 200 &&
      value.hotels.every(hotel);
  else if (service === "amap/route") valid = routeResult(value);
  else if (service === "rail/search" || service === "flight/search")
    valid = transport(value);
  else if (service === "transport/compare")
    valid =
      object(value) &&
      text(value.summary) &&
      Array.isArray(value.options) &&
      value.options.every(transport);
  else if (service === "route/edit-intent")
    valid =
      object(value) &&
      ["move", "delete", "replace"].includes(String(value.operation)) &&
      text(value.placeId) &&
      text(value.replacementQuery) &&
      (value.day === null || Number.isInteger(value.day));
  else if (service === "hotels/relaxation-advice")
    valid = object(value) && text(value.summary);
  if (!valid) throw new Error("查询返回的信息格式不正确，请重试。");
  return value;
}
export function safeMediaUrl(value: string | undefined) {
  if (!value) return undefined;
  if (/^\/images\/[a-z0-9_.-]+$/i.test(value)) return value;
  if (/^\/images\/places\/[a-f0-9]{64}\.webp$/.test(value)) return value;
  if (/^\/api\/travel\/media\/[a-f0-9]{64}\.webp$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* omit invalid media */
  }
  return undefined;
}

function routeResult(value: unknown) {
  if (
    !object(value) ||
    value.schemaVersion !== 21 ||
    !["idle", "loading", "ready", "partial", "error", "needs-hotel"].includes(
      String(value.status),
    ) ||
    !Array.isArray(value.days) ||
    value.days.length > 30
  )
    return false;
  const point = (p: unknown) =>
    object(p) &&
    text(p.id) &&
    text(p.name) &&
    numbers(p, ["lat", "lng"]) &&
    Math.abs(Number(p.lat)) <= 90 &&
    Math.abs(Number(p.lng)) <= 180 &&
    source(p);
  if (value.hotelAnchor != null && !point(value.hotelAnchor)) return false;
  if (
    value.hotelChoices != null &&
    (!Array.isArray(value.hotelChoices) || !value.hotelChoices.every(hotel))
  )
    return false;
  return value.days.every(
    (day: unknown) =>
      object(day) &&
      Number.isInteger(day.day) &&
      Array.isArray(day.stops) &&
      day.stops.length <= 300 &&
      day.stops.every(
        (s: unknown) =>
          object(s) &&
          text(s.id) &&
          text(s.name) &&
          ["place", "meal"].includes(String(s.kind)) &&
          ["早上", "中午", "下午", "晚上"].includes(String(s.period)),
      ) &&
      (!day.legs ||
        (Array.isArray(day.legs) &&
          day.legs.length <= 301 &&
          day.legs.every(
            (leg: unknown) =>
              object(leg) &&
              point(leg.from) &&
              point(leg.to) &&
              ["ready", "error"].includes(String(leg.status)) &&
              source(leg) &&
              text(leg.provider) &&
              text(leg.queriedAt) &&
              text(leg.error) &&
              text(leg.recommendation) &&
              (leg.status === "error" ||
                (["walking", "transit", "driving"].includes(String(leg.mode)) &&
                  numbers(leg, ["distanceMeters", "durationSeconds"]) &&
                  Number(leg.distanceMeters) > 0 &&
                  Number(leg.durationSeconds) > 0)) &&
              Array.isArray(leg.instructions) &&
              leg.instructions.every(text) &&
              Array.isArray(leg.polylines) &&
              leg.polylines.length <= 500 &&
              leg.polylines.every(
                (line: unknown) =>
                  Array.isArray(line) &&
                  line.length <= 10000 &&
                  line.every(
                    (p) =>
                      object(p) &&
                      numbers(p, ["lat", "lng"]) &&
                      Math.abs(Number(p.lat)) <= 90 &&
                      Math.abs(Number(p.lng)) <= 180,
                  ),
              ),
          ))),
  );
}
