import type {Hotel, HotelSearchPayload, TripDraft} from "./types";
type TripContext = Pick<TripDraft,"destinationCity"|"dateMode"|"departureDate"|"returnDate"|"fuzzyDateText"|"tripDays"|"adults"|"children">;
export function hotelContextSignature(d: TripContext) {return JSON.stringify([d.destinationCity.trim(),d.dateMode,d.departureDate,d.returnDate,d.fuzzyDateText,d.tripDays,d.adults,d.children]);}
export function transportContextSignature(d: TripDraft) {return JSON.stringify([hotelContextSignature(d),d.originCity.trim(),d.intercityTransportPreference]);}
export const hotelQuoteCurrent = (hotel: Hotel, d: TripContext) => hotel.queryContextSignature === hotelContextSignature(d);
export function currentHotelQuote(hotel:Hotel, d:TripContext):Hotel {return hotelQuoteCurrent(hotel,d) ? hotel : {...hotel,price:null,queriedAt:undefined,reason:"原报价已失效，请重新查询；酒店选择仍保留。"};}
export const quoteScopeLabel = "供应方起价；房型及人数适用性待核实";
export function transportSummaryLines(d:TripDraft):string[] {
  const names={rail:"高铁 / 火车",flight:"飞机",drive:"自驾"};
  const lines=["出发 / 目的地："+d.originCity+" → "+d.destinationCity,"城际交通："+(d.selectedTransportMode ? names[d.selectedTransportMode] : "待选择")+"（出行方式选择，不代表订票）"];
  const option=d.transportOptions.find(o=>o.mode===d.selectedTransportMode && o.queryContextSignature===transportContextSignature(d));
  if(option){lines.push("交通查询参考："+option.title+" · "+option.duration+" · "+option.priceLabel, "来源："+(option.source==="mock" ? "显式模拟数据" : option.provider || "供应方查询")+" · 查询于 "+(option.queriedAt ? new Date(option.queriedAt).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:false}) : "时间待核实"));}
  else if(d.selectedTransportMode) lines.push("方式已选，班次与报价待重新查询");
  return lines;
}
export const stampHotels = (hotels:Hotel[], d:TripContext|HotelSearchPayload) => hotels.map(h=>({...h,queryContextSignature:hotelContextSignature(d)}));
