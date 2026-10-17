import fs from 'node:fs';
import assert from 'node:assert/strict';
import {planRealRoute,searchHotelPois} from '../server/route-planning.js';
import {searchHotelByName} from '../server/travel-api.js';
import {closeMcpClients} from '../server/mcp.js';
import {getPlaceCatalog} from '../server/place-catalog.js';
const evidence={checkedAt:new Date().toISOString(),source:'real providers',checks:[]};
const save=()=>fs.writeFileSync('artifacts/v21/live-verification.json',JSON.stringify(evidence,null,2));
try{
 const trip={destinationCity:'杭州',dateMode:'exact',departureDate:'2026-10-20',returnDate:'2026-10-22',tripDays:3};
 let found;try{found=await searchHotelByName({query:'杭州友好饭店',trip},AbortSignal.timeout(90000));evidence.checks.push({name:'飞猪名称搜索',ok:true,count:found.hotels.length,provider:found.provider,hotels:found.hotels});}catch(e){evidence.checks.push({name:'飞猪名称搜索',ok:false,code:e.code,message:e.message});}save();
 const locations=await searchHotelPois('杭州友好饭店','杭州',AbortSignal.timeout(40000));assert.ok(locations.length);const selected=locations.find(h=>h.name==='杭州友好饭店');assert.ok(selected);evidence.checks.push({name:'高德酒店位置搜索',ok:true,count:locations.length,hotel:selected});save();
 const placeList=getPlaceCatalog().areas('杭州').filter(p=>p.type==='景点').slice(0,3);assert.equal(placeList.length,3);
 const days=[{day:1,stops:placeList.slice(0,2).map((p,i)=>({id:p.id,placeId:p.id,name:p.name,kind:'place',period:i?'下午':'早上'}))},{day:2,stops:placeList.slice(2).map(p=>({id:p.id,placeId:p.id,name:p.name,kind:'place',period:'下午'}))}];
 const route=await planRealRoute({city:'杭州',hotel:selected,places:placeList,days,preference:'公共交通'},AbortSignal.timeout(180000),p=>console.log(JSON.stringify(p)));
 assert.equal(route.status,'ready');for(const day of route.days){assert.equal(day.legs.length,day.stops.length+1);assert.equal(day.legs[0].from.id,route.hotelAnchor.id);assert.equal(day.legs.at(-1).to.id,route.hotelAnchor.id);assert.ok(day.legs.every(l=>l.source==='live'&&l.distanceMeters>0&&l.durationSeconds>0));}
 evidence.checks.push({name:'高德两日真实往返路线',ok:true,route});save();
 const named=found?.hotels.find(h=>h.name==='杭州友好饭店');
 fs.writeFileSync('artifacts/v21/live-fixture.json',JSON.stringify({hotel:{...(named||selected),amapPoiId:selected.amapPoiId,address:selected.address},hotelSearch:found?.hotels||[],places:placeList,route},null,2));
 console.log(JSON.stringify({ok:true,provider:'高德地图MCP',days:route.days.length,legs:route.days.reduce((n,d)=>n+d.legs.length,0),geometryLegs:route.days.flatMap(d=>d.legs).filter(l=>l.polylines.length).length,modes:[...new Set(route.days.flatMap(d=>d.legs).map(l=>l.mode))]}));
} catch(e){evidence.failure={code:e.code||e.name,message:/[\u4e00-\u9fff]/.test(e.message)?e.message:'验证未完成'};save();console.log(JSON.stringify({ok:false,...evidence.failure}));process.exitCode=1;}finally{await closeMcpClients();}
