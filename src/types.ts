export interface Area {
  id: string; name: string; displayName: string; image: string; mood: string
  audience: string; transport: string; price: string; distance: string; reason: string
}
export interface Hotel {
  id: string; name: string; areaId: string; tagline: string; image: string
  stars: number; score: number; userRating: number; reviews: number
  subway: number; renovated: number; landmarkDistance: string; price: number
  features: string[]; description: string; source: 'mock'; externalUrl?: string
}
export interface Attraction {
  id: string; name: string; displayName: string; image: string; duration: string
  hours: string; ticket: number; distance: string; reason: string; officialUrl: string
}
export type TransportMode = 'train' | 'flight' | 'transit'
export type TransportPriority = 'fastest' | 'value' | 'comfort'
export interface TransportOption {
  id: string; mode: TransportMode; priority: TransportPriority; title: string
  origin: string; destination: string; departure: string; arrival: string
  duration: string; transfers: string; hotelAccess: string; convenience: string; price: number
}
export interface HotelFilters {
  maxPrice: number; minScore: number; stars: number; maxSubway: number
  minRenovated: number; minUserRating: number; minReviews: number
}
export interface TripState {
  prompt: string; areaId: string | null; hotelId: string | null; attractionIds: string[]
  transportId: string | null; budgetEnabled: boolean; budget: number; strategy: 'area' | 'hotel'
}
