import fs from 'node:fs'
const base='http://127.0.0.1:3001/api/travel'
const started=Date.now()
const response=await fetch(base+'/area-recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:'北京'}),signal:AbortSignal.timeout(180000)})
const data=await response.json()
fs.writeFileSync('artifacts/integration/area-live.json',JSON.stringify({status:response.status,elapsedMs:Date.now()-started,data},null,2))
console.log(JSON.stringify({status:response.status,elapsedMs:Date.now()-started,count:Array.isArray(data)?data.length:0,data:Array.isArray(data)?data.map(p=>({name:p.name,type:p.type,district:p.district})):data}))
