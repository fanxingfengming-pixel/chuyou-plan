import fs from 'node:fs/promises';
import {runFlyai,normalizeHotel} from '../server/flyai.js';
import {hotelImage} from '../server/image-sources.js';
import {imageCache} from '../server/image-cache.js';
const result=await runFlyai('search-hotel',['--dest-name','杭州','--check-in-date','2026-10-18','--check-out-date','2026-10-21','--sort','rate_desc','--poi-name','杭州西湖风景名胜区'],AbortSignal.timeout(65000));
const evidence={checkedAt:new Date().toISOString(),hotels:[]};
for(const item of result.data.itemList){
 const hotel=normalizeHotel(item,'杭州',new Date().toISOString());
 if(!hotel)continue;
 const record={id:hotel.id,name:hotel.name,...await hotelImage(hotel,AbortSignal.timeout(18000))};
 evidence.hotels.push(record);console.log(JSON.stringify(record));
}
evidence.cacheStats={...imageCache.stats};
await fs.writeFile('artifacts/integration/hangzhou-hotels-images.json',JSON.stringify(evidence,null,2));
