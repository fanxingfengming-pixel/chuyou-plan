import fs from 'node:fs/promises';
import {createImageCache} from '../server/image-cache.js';
const source=JSON.parse(await fs.readFile('artifacts/integration/hangzhou-hotels-images.json','utf8'));
const cache=createImageCache();
const evidence={checkedAt:new Date().toISOString(),hotels:[]};
for(const hotel of source.hotels){
 const media=await cache.resolve('flyai:'+hotel.id,async()=>{throw new Error('Must reuse persistent image');});
 evidence.hotels.push({id:hotel.id,name:hotel.name,...media});
}
evidence.cacheStats=cache.stats;
await fs.writeFile('artifacts/integration/hangzhou-hotels-images.json',JSON.stringify(evidence,null,2));
if(evidence.hotels.some(h=>h.imageFallback))throw new Error('Persistent image missing');
console.log(JSON.stringify({hotels:evidence.hotels.length,stats:cache.stats}));
