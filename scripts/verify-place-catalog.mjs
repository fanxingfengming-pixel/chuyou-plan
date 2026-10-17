
import {createTravelServer} from "../server/app.js";
import {placeDiagnostics,closeMcpClients,searchPlaces} from "../server/mcp.js";
import {getPlaceCatalog} from "../server/place-catalog.js";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
const results=[];
for(let run=0;run<2;run++){
 const server=createTravelServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port+"/api/travel";
 try{
  const before={...placeDiagnostics};
  for(const city of ["北京","上海","广州","深圳","杭州"]){
   const began=performance.now();
   const response=await fetch(base+"/area-recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({city})});
   const places=await response.json();
   assert.equal(response.status,200);assert.equal(places.length,6);assert.equal(places.filter(p=>p.type==="景点").length,3);assert.equal(places.filter(p=>p.type==="商圈").length,3);
   assert.equal(places.filter(p=>p.image&&!p.imageFallback).length,6);
   const elapsedMs=performance.now()-began;
   for(const p of places){const r=await fetch(base+p.image.replace("/api/travel",""));assert.equal(r.status,200);assert.match(r.headers.get("content-type"),/image/);}
   results.push({run,city,elapsedMs,places:places.length,allLocal:true});
  }
  assert.deepEqual(placeDiagnostics,before);
 }finally{await new Promise(resolve=>server.close(resolve));}
}
const db=getPlaceCatalog(),before={...placeDiagnostics};
await searchPlaces("天河城","广州",AbortSignal.timeout(2000));
assert.deepEqual(placeDiagnostics,before);
const query="广州图书馆";
const missedBefore=db.search("广州",query).length;
if(!missedBefore){
 const found=await searchPlaces(query,"广州",AbortSignal.timeout(60000),"景点",1);assert.ok(found.length);
 const calls={...placeDiagnostics};await searchPlaces(query,"广州",AbortSignal.timeout(2000));
 assert.deepEqual(placeDiagnostics,calls);
 results.push({uncatalogedQuery:query,wasMissing:true,found:found[0].name,secondReadNoSearch:true});
}else results.push({uncatalogedQuery:query,wasMissing:false,note:"previously collected by this acceptance; reused"});
await fs.writeFile("artifacts/warm-v3/catalog-verification.json",JSON.stringify({results,providerCalls:placeDiagnostics},null,2));
console.log(JSON.stringify({cacheRequests:10,maxCachedMs:Math.max(...results.filter(p=>p.elapsedMs).map(p=>p.elapsedMs)),providerCalls:placeDiagnostics,unknownQuery:results.at(-1)}));
await closeMcpClients();
