import { expect, it } from "vitest";
import { priceBounds } from "../shared/price-bounds.js";
import { filterHotelCatalog } from "../src/planning/services";
import { initialDraft } from "../src/planning/model";
import { hotelPayload } from "../src/planning/payload";
import type { Hotel, HotelSearchPayload } from "../src/planning/types";
it("价格两端按档位过滤：低端为最高200，高端不截断", () => {
  const hotels: Hotel[] = [100, 200, 201, 2500].map((price) => ({
    id: String(price),
    name: "测试酒店",
    city: "杭州",
    district: "西湖区",
    brand: "",
    lat: null,
    lng: null,
    reason: "测试数据",
    source: "mock",
    price,
    overallRating: 8,
    subwayDistance: 100,
    renovationYear: 2020,
    starLevel: 3,
    reviewCount: 100,
    userScore: 4,
    facilities: [],
    coreDistance: null,
  }));
  const filters: HotelSearchPayload = {
    ...hotelPayload(initialDraft()),
    priceRange: [0, 0],
    overallRating: 0,
    minRenovationYear: 0,
    starLevel: 0,
    reviewCount: 0,
    userScore: 0,
    selectedDistricts: [],
    brandPreference: [],
    facilities: [],
    primaryPlace: null,
  };
  expect(priceBounds([0, 0])).toEqual({ min: 0, max: 200 });
  expect(filterHotelCatalog(hotels, filters).map((h) => h.price)).toEqual([
    100, 200,
  ]);
  expect(
    filterHotelCatalog(hotels, { ...filters, priceRange: [2000, 2000] }).map(
      (h) => h.price,
    ),
  ).toEqual([2500]);
});
