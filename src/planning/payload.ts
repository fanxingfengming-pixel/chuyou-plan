import { withoutSubwayFilter } from "./model";
import type { HotelSearchPayload, TripDraft } from "./types";
export const hotelPayload = (d: TripDraft): HotelSearchPayload => ({
  ...withoutSubwayFilter(d.hotelFilters),
  destinationCity: d.destinationCity,
  originCity: d.originCity,
  dateMode: d.dateMode,
  departureDate: d.departureDate,
  returnDate: d.returnDate,
  fuzzyDateText: d.fuzzyDateText,
  tripDays: d.tripDays,
  adults: d.adults,
  children: d.children,
  selectedPlaces: d.selectedPlaces,
  primaryPlace: d.primaryPlace,
  recommendedDistricts: d.recommendedDistricts,
  brandPreference: d.brandPreference,
  selectedTransportMode: d.selectedTransportMode,
});
