import { defaultFilters, hotels, planningStages } from '../data/mock'
import type { Hotel, HotelFilters, TripState } from '../types'

// Future providers implement these contracts server-side. No secrets or network API in V1.
export interface TravelGateway {
  plan(prompt: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<{ destination: string; source: 'mock' | 'live' }>
  searchHotels(filters: HotelFilters): Promise<Hotel[]>
}
export interface FutureIntegrations {
  agent: { endpoint: string }
  map: { provider: string; routeEndpoint: string }
  hotels: { searchEndpoint: string; availabilityEndpoint: string; outboundLinkEndpoint: string }
  attractions: { officialLinkEndpoint: string; reservationEndpoint: string }
  transport: { flightEndpoint: string; trainEndpoint: string; transitEndpoint: string }
}
export function requestsBudget(input:string):boolean {
  if(!/预算/.test(input))return false
  if(/(?:不需要|不要|无需|不用|先不|暂不|别|不想|不考虑|不算|不做|不看|不谈|不提)[^，。；！？!?]{0,10}预算|预算[^，。；！？!?]{0,4}(?:不用|不要|不需要|不考虑|不算)/.test(input))return false
  return /估算|帮我算|计算|查看|打开|展示|控制|限制|上限|多少|总预算|想(?:要|看|了解|知道)[^，。；]{0,12}预算/.test(input)||/预算\s*[:：]?\s*[¥￥]?\s*\d/.test(input)||input.trim()==='预算'
}
export function filterHotels(items: Hotel[], filters: HotelFilters, areaId?: string | null) {
  return items.filter(h => (!areaId || h.areaId === areaId) && h.price <= filters.maxPrice && h.score >= filters.minScore && h.stars >= filters.stars && h.subway <= filters.maxSubway && h.renovated >= filters.minRenovated && h.userRating >= filters.minUserRating && h.reviews >= filters.minReviews)
}
export function parseHotelQuery(input: string): {filters:HotelFilters; recognized:boolean} {
  const filters = {...defaultFilters}
  const price = input.match(/(?:预算|价格|每晚)?\s*[¥￥]?\s*(\d{3,5})\s*(?:元|块)?\s*(?:以内|以下|左右|预算|\/晚)/)
  const score = input.match(/(?:评分|综合评分)\s*(\d(?:\.\d)?)\s*(?:以上|分)?/)
  const subway = input.match(/(?:地铁|车站)[^\d]{0,8}(\d{2,4})\s*(?:米|m)/i)
  const year = input.match(/(20\d{2})\s*年?\s*(?:后|以后|装修|翻新)/)
  const reviews = input.match(/(?:评论|评价)\s*(\d+)\s*(?:条|以上)?/)
  const user = input.match(/用户评分\s*(\d(?:\.\d)?)/)
  if (price) filters.maxPrice = Number(price[1])
  if (score && !input.includes('用户评分')) filters.minScore = Number(score[1])
  if (subway) filters.maxSubway = Number(subway[1])
  if (year) filters.minRenovated = Number(year[1])
  if (reviews) filters.minReviews = Number(reviews[1])
  if (user) filters.minUserRating = Number(user[1])
  if (/五星|5\s*星/.test(input)) filters.stars = 5
  else if (/四星|4\s*星/.test(input)) filters.stars = 4
  return { filters, recognized: !!(price || score || subway || year || reviews || user || filters.stars) }
}
const pause = (ms:number, signal:AbortSignal) => new Promise<void>((resolve,reject)=>{
  if (signal.aborted) { reject(new DOMException('Cancelled','AbortError')); return }
  const cancel = () => { clearTimeout(timer); reject(new DOMException('Cancelled','AbortError')) }
  const timer = setTimeout(()=>{ signal.removeEventListener('abort',cancel); resolve() },ms)
  signal.addEventListener('abort',cancel,{once:true})
})
export const mockGateway: TravelGateway = {
  async plan(_prompt,signal,onStage) {
    for (const stage of planningStages) { onStage(stage); await pause(650,signal) }
    return {destination:'Tokyo',source:'mock'}
  },
  async searchHotels(filters) { return filterHotels(hotels,filters) },
}
export function budgetBreakdown(state:TripState) {
  const hotel = hotels.find(h=>h.id===state.hotelId)
  // Assumptions: two travelers, four room nights. Transport includes an illustrative two-person flight allowance.
  return { Hotel:hotel ? hotel.price*4 : 0,Transport:4400,Food:1500,Tickets:state.attractionIds.reduce((sum,id)=>sum+({nezu:80,teamlab:230,tnm:50}[id]??0)*2,0),Other:500 }
}
