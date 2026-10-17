import fs from 'node:fs'
const base='http://127.0.0.1:5173/api/travel',evidence={checkedAt:new Date().toISOString(),checks:[]}
async function call(name,payload){
 const start=Date.now(),r=await fetch(base+'/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(180000)}),data=await r.json()
 evidence.checks.push({service:name,status:r.status,elapsedMs:Date.now()-start,data})
 fs.writeFileSync('artifacts/integration/live-api-acceptance.json',JSON.stringify(evidence,null,2))
 return {status:r.status,data}
}
const primary=JSON.parse(fs.readFileSync('artifacts/integration/amap-normalized.json'))[0]
const filters={priceRange:[0,2000],minRenovationYear:0,overallRating:0,subwayDistance:999999,selectedDistricts:['东城区'],starLevel:0,reviewCount:0,userScore:0,facilities:[]}
const payload={...filters,destinationCity:'北京',originCity:'长沙',dateMode:'exact',departureDate:'2026-10-18',returnDate:'2026-10-21',tripDays:4,adults:2,children:0,selectedPlaces:[primary],primaryPlace:primary,recommendedDistricts:['东城区'],brandPreference:[],selectedTransportMode:'rail'}
const hotel=await call('flyai/search-hotels',payload)
console.log(JSON.stringify({service:'live-hotels',status:hotel.status,count:Array.isArray(hotel.data)?hotel.data.length:0,hotels:Array.isArray(hotel.data)?hotel.data.map(h=>({name:h.name,district:h.district,coreDistance:h.coreDistance,source:h.source,hasBooking:!!h.bookingUrl})):hotel.data}))
await call('hotels/relaxation-advice',{filters:{...filters,subwayDistance:500}})
const draft={destinationCity:'北京',tripDays:4,tripPlaces:[primary]}
for(const instruction of ['删除故宫','把故宫换成天坛公园'])await call('route/edit-intent',{instruction,draft})
await call('transport/compare',{destinationCity:'北京',dateMode:'fuzzy',fuzzyDateText:'11月上旬'})
console.log(JSON.stringify(evidence.checks.map(c=>({service:c.service,status:c.status,elapsedMs:c.elapsedMs,result:Array.isArray(c.data)?c.data.length:c.data}))))
