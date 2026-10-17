import { createContext, useContext } from "react";
import type { HotelCapabilities } from "./types";
import { isLiveMode } from "./serviceClient";
const mockCapabilities: HotelCapabilities = {
  version: 1,
  provider: "模拟目录",
  hotelFilters: {
    priceRange: true,
    overallRating: true,
    minRenovationYear: true,
    userScore: true,
    selectedDistricts: true,
    brandPreference: true,
    starLevel: true,
    reviewCount: true,
    facilities: true,
  },
};
export interface ServiceStatusValue {
  state: "checking" | "online" | "offline" | "mock";
  capabilities: HotelCapabilities | null;
  check: () => Promise<void>;
}
export const ServiceStatusContext = createContext<ServiceStatusValue>({
  state: isLiveMode ? "checking" : "mock",
  capabilities: isLiveMode ? null : mockCapabilities,
  check: async () => {},
});
export const useServiceStatus = () => useContext(ServiceStatusContext);
