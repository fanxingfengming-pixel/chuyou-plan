import fs from 'node:fs'
import {searchPlaces,closeMcpClients} from '../server/mcp.js'
import {imageCache,createImageCache} from '../server/image-cache.js'
const evidence={checkedAt:new Date().toISOString(),city:'杭州',places:[]}
try{
 for(const query of ['西湖风景名胜区','灵隐寺','西溪国家湿地公园']){
  const places=await searchPlaces(query,'杭州',AbortSignal.timeout(60000))
  evidence.places.push(...places.slice(0,1))
  console.log(JSON.stringify({query,place:places[0]?.name,image:places[0]?.image,imageSource:places[0]?.imageSource,generic:places[0]?.imageFallback}))
 }
 evidence.cacheStats={...imageCache.stats}
 const restarted=createImageCache()
 const before=Date.now()
 evidence.persistedImage=await restarted.resolve('amap:'+evidence.places[0].id,async()=>{throw new Error('should never fetch again')})
 evidence.cacheReloadMs=Date.now()-before
 fs.writeFileSync('artifacts/integration/hangzhou-images.json',JSON.stringify(evidence,null,2))
 console.log(JSON.stringify({cacheStats:evidence.cacheStats,persistedImage:evidence.persistedImage,cacheReloadMs:evidence.cacheReloadMs}))
} finally{await closeMcpClients()}
