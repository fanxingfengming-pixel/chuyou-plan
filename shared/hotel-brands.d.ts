export const HOTEL_BRANDS: readonly string[];
export function matchesHotelBrand(
  hotel: { name: string; brand: string },
  preferences: readonly string[],
): boolean;
