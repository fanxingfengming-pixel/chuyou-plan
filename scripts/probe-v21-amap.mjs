import fs from 'node:fs';
import {amap,closeMcpClients} from '../server/mcp.js';
const result={checkedAt:new Date().toISOString(),provider:'高德官方MCP',checks:[]};
try{
for(const [tool,args] of [
 ['maps_text_search',{keywords:'杭州友好饭店',city:'杭州',citylimit:true}],
 ['maps_direction_walking',{origin:'120.166586,30.250113',destination:'120.155070,30.247934'}],
 ['maps_direction_transit_integrated',{origin:'120.166586,30.250113',destination:'120.155070,30.247934',city:'杭州',cityd:'杭州'}],
 ['maps_direction_driving',{origin:'120.166586,30.250113',destination:'120.155070,30.247934'}]
]){
 const began=Date.now();try{const data=await amap(tool,args,AbortSignal.timeout(35000));result.checks.push({tool,args,elapsedMs:Date.now()-began,data});console.log(JSON.stringify({tool,ok:true,keys:Object.keys(data),preview:JSON.stringify(data).slice(0,2200)}));}catch(e){result.checks.push({tool,ok:false,code:e.code});console.log(JSON.stringify({tool,ok:false,code:e.code}));}
 fs.writeFileSync('artifacts/v21/amap-probe.json',JSON.stringify(result,null,2));
}
}finally{await closeMcpClients();}
