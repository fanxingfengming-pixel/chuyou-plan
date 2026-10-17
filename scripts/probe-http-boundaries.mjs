import fs from 'node:fs'
const paths=['/.env.server','/.env.local','/server/config.js','/server/managed-agent.js','/artifacts/integration/config-audit.json','/@fs/D:/aaa飞猪/.env.server']
const result=[]
for(const path of paths){
 const response=await fetch('http://127.0.0.1:5173'+path)
 await response.body?.cancel()
 result.push({path,status:response.status})
}
const health=await(await fetch('http://127.0.0.1:5173/api/travel/health')).json()
fs.writeFileSync('artifacts/integration/http-boundaries.json',JSON.stringify({checkedAt:new Date().toISOString(),paths:result,health},null,2))
console.log(JSON.stringify({paths:result,health}))
