import type { Hotel } from "../src/planning/types";
export function factHotelReason(hotel: Hotel): string;
export function getHotelHighlights(
  items: Hotel[],
  recommendedId?: string,
): { hotel: Hotel; label: string; reason: string }[];
