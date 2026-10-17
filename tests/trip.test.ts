import { describe,it,expect } from 'vitest'
import { initialTrip,tripReducer } from '../src/state/TripContext'
import { defaultFilters,hotels } from '../src/data/mock'
import { budgetBreakdown,filterHotels,parseHotelQuery,requestsBudget } from '../src/services/travelGateway'

describe('user-controlled travel decisions',()=>{
 it('starts without chosen accommodation, added attractions or budget',()=>{expect(initialTrip.hotelId).toBeNull();expect(initialTrip.areaId).toBeNull();expect(initialTrip.attractionIds).toEqual([]);expect(initialTrip.budgetEnabled).toBe(false)})
 it('requires explicit action to add and remove attractions',()=>{const added=tripReducer(initialTrip,{type:'toggleAttraction',value:'nezu'});expect(added.attractionIds).toEqual(['nezu']);expect(initialTrip.attractionIds).toEqual([]);expect(tripReducer(added,{type:'toggleAttraction',value:'nezu'}).attractionIds).toEqual([])})
 it('selecting a hotel confirms its area and invalidates old transport',()=>{const state=tripReducer({...initialTrip,transportId:'train-fast'},{type:'hotel',value:'aoyama-house'});expect(state.hotelId).toBe('aoyama-house');expect(state.areaId).toBe('aoyama');expect(state.transportId).toBeNull()})
 it('changing area invalidates mismatched accommodation and keeps chosen attractions',()=>{const state=tripReducer({...initialTrip,hotelId:'aoyama-house',areaId:'aoyama',attractionIds:['nezu'],transportId:'train-fast'},{type:'area',value:'nihonbashi'});expect(state.hotelId).toBeNull();expect(state.transportId).toBeNull();expect(state.attractionIds).toEqual(['nezu'])})
 it('retains accommodation when confirming the same area',()=>{expect(tripReducer({...initialTrip,hotelId:'aoyama-house',areaId:'aoyama'},{type:'area',value:'aoyama'}).hotelId).toBe('aoyama-house')})
 it('does not accept an unknown hotel',()=>{expect(tripReducer(initialTrip,{type:'hotel',value:'missing'})).toEqual(initialTrip)})
})
describe('hotel filtering and natural language demo',()=>{
 it('combines every filter and selected area',()=>{const f={...defaultFilters,maxPrice:1500,minScore:9,stars:4,maxSubway:500,minRenovated:2023,minUserRating:4.7,minReviews:1000};expect(filterHotels(hotels,f).map(h=>h.id)).toEqual(['kura-nihonbashi']);expect(filterHotels(hotels,f,'aoyama')).toEqual([])})
 it('extracts price score and subway distance from Chinese',()=>{const result=parseHotelQuery('1500 元以内，评分 9 分以上，地铁 500 米以内');expect(result.recognized).toBe(true);expect(result.filters.maxPrice).toBe(1500);expect(result.filters.minScore).toBe(9);expect(result.filters.maxSubway).toBe(500)})
 it('does not pretend to understand unsupported preferences',()=>{expect(parseHotelQuery('靠近一片漂亮的森林').recognized).toBe(false)})
 it('can legitimately return no result',()=>expect(filterHotels(hotels,{...defaultFilters,maxPrice:100})).toEqual([]))
})
describe('optional budget estimate',()=>{
 it('opens only for an explicit positive budget request',()=>{expect(requestsBudget('东京 5 天，预算 8000 元')).toBe(true);expect(requestsBudget('帮我估算一下总预算')).toBe(true);expect(requestsBudget('我想了解预算')).toBe(true)})
 it('does not open for negated budget requests',()=>{expect(requestsBudget('东京旅行，不要预算')).toBe(false);expect(requestsBudget('先不考虑预算')).toBe(false);expect(requestsBudget('预算不用算')).toBe(false);expect(requestsBudget('不用帮我计算预算')).toBe(false);expect(requestsBudget('暂时不算预算')).toBe(false);expect(requestsBudget('暂时不算预算 8000 元')).toBe(false)})
 it('does not open for a mere mention or an unrelated request',()=>{expect(requestsBudget('预算不是问题，帮我推荐酒店')).toBe(false);expect(requestsBudget('东京 5 天，喜欢博物馆')).toBe(false)})
 it('counts four room nights and two travelers, only added tickets',()=>{const costs=budgetBreakdown({...initialTrip,hotelId:'aoyama-house',attractionIds:['nezu']});expect(costs.Hotel).toBe(5920);expect(costs.Tickets).toBe(160)})
 it('never includes unselected hotels or tickets',()=>{const costs=budgetBreakdown(initialTrip);expect(costs.Hotel).toBe(0);expect(costs.Tickets).toBe(0)})
})
