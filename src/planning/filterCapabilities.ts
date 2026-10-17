import type { HotelCapabilities, HotelFilters } from "./types";
export function unsupportedFilterNames(
  f: HotelFilters,
  caps: HotelCapabilities,
) {
  return [
    [!caps.hotelFilters.starLevel && f.starLevel > 0, "数字星级"],
    [!caps.hotelFilters.reviewCount && f.reviewCount > 0, "评论数量"],
    [!caps.hotelFilters.facilities && f.facilities.length > 0, "设施"],
  ]
    .filter(([active]) => active)
    .map(([, label]) => String(label));
}
export function clearUnsupportedFilters(
  f: HotelFilters,
  caps: HotelCapabilities,
): HotelFilters {
  return {
    ...f,
    ...(!caps.hotelFilters.starLevel ? { starLevel: 0 } : {}),
    ...(!caps.hotelFilters.reviewCount ? { reviewCount: 0 } : {}),
    ...(!caps.hotelFilters.facilities ? { facilities: [] } : {}),
  };
}
