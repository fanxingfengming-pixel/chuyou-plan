import fs from 'node:fs'
import {searchPlaces,closeMcpClients} from '../server/mcp.js'
try {
 const result=await searchPlaces('故宫博物院','北京',AbortSignal.timeout(60000))
 fs.writeFileSync('artifacts/integration/amap-normalized.json',JSON.stringify(result,null,2))
 console.log(JSON.stringify({count:result.length,places:result.map(p=>({name:p.name,district:p.district,lat:p.lat,lng:p.lng}))}))
} catch(e) {console.log(JSON.stringify({code:e.code,message:e.message}))}
finally {await closeMcpClients()}
