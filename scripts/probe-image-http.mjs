import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const evidence={checkedAt:new Date().toISOString(),checks:[]};
const index=JSON.parse(await fs.readFile('data/image-cache/index.json','utf8'));
const files=[...new Set(Object.values(index.entries).filter(x=>x.status==='ready').map(x=>x.file))];
for(const file of files){
 const response=await fetch('http://127.0.0.1:5173/api/travel/media/'+file);
 const bytes=(await response.arrayBuffer()).byteLength;
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.ok(bytes>0);
 evidence.checks.push({file,status:response.status,bytes,cacheControl:response.headers.get('cache-control')});
}
for(const [url,expected] of [['/images/fallback-landscape.webp',200],['/data/image-cache/index.json',403],['/.env.server',403],['/api/travel/media/%2e%2e%2findex.json',404]]){
 const response=await fetch('http://127.0.0.1:5173'+url);await response.body?.cancel();assert.equal(response.status,expected);evidence.checks.push({url,status:response.status});
}
evidence.health=await (await fetch('http://127.0.0.1:5173/api/travel/health')).json();
evidence.cachedPlaceCount=Object.keys(index.entries).filter(x=>x.startsWith('amap:')).length;
evidence.cachedHotelCount=Object.keys(index.entries).filter(x=>x.startsWith('flyai:')).length;
await fs.writeFile('artifacts/integration/image-http-checks.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify({imageCount:files.length,passed:true,flyai:evidence.health.flyai}));
