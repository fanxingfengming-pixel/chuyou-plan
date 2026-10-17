import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { DEFAULT_PROMPT, hotels } from '../data/mock'
import type { TripState } from '../types'

export const initialTrip:TripState = {prompt:DEFAULT_PROMPT,areaId:null,hotelId:null,attractionIds:[],transportId:null,budgetEnabled:false,budget:16000,strategy:'area'}
export type TripAction =
  | {type:'prompt';value:string} | {type:'strategy';value:'area'|'hotel'}
  | {type:'area';value:string} | {type:'hotel';value:string}
  | {type:'toggleAttraction';value:string} | {type:'transport';value:string}
  | {type:'budgetEnabled';value:boolean} | {type:'budget';value:number} | {type:'reset'}
export function tripReducer(state:TripState,action:TripAction):TripState {
  switch(action.type) {
    case 'prompt': return {...state,prompt:action.value}
    case 'strategy': return {...state,strategy:action.value}
    case 'area': return {...state,areaId:action.value,hotelId:hotels.find(h=>h.id===state.hotelId)?.areaId===action.value?state.hotelId:null,transportId:null}
    case 'hotel': { const hotel=hotels.find(h=>h.id===action.value); return hotel?{...state,hotelId:hotel.id,areaId:hotel.areaId,transportId:null}:state }
    case 'toggleAttraction': return {...state,attractionIds:state.attractionIds.includes(action.value)?state.attractionIds.filter(id=>id!==action.value):[...state.attractionIds,action.value]}
    case 'transport': return {...state,transportId:action.value}
    case 'budgetEnabled': return {...state,budgetEnabled:action.value}
    case 'budget': return Number.isFinite(action.value)&&action.value>0?{...state,budget:action.value}:state
    case 'reset': return {...initialTrip}
  }
}
const TripContext=createContext<{state:TripState;dispatch:Dispatch<TripAction>}|null>(null)
export function TripProvider({children}:{children:ReactNode}) {const [state,dispatch]=useReducer(tripReducer,initialTrip);return <TripContext.Provider value={{state,dispatch}}>{children}</TripContext.Provider>}
export function useTrip(){const context=useContext(TripContext);if(!context)throw new Error('TripProvider missing');return context}
