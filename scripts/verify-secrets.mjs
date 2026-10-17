import fs from 'node:fs'
import path from 'node:path'
import {loadConfig} from '../server/config.js'
const config=loadConfig(),secrets=[config.apiKey,config.amapKey]
try{const fly=JSON.parse(fs.readFileSync(process.env.USERPROFILE+'/.flyai/config.json','utf8'));secrets.push(fly.FLYAI_API_KEY,fly.FLYAI_SIGN_SECRET)}catch{}
const needles=secrets.filter(x=>typeof x==='string'&&x.length>=8),matches=[]
let checkedFiles=0
function scan(directory){
 for(const item of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,item.name)
  if(item.isDirectory())scan(file)
  else if(/\.(js|mjs|cjs|ts|tsx|json|html|css|md|txt)$/i.test(file)&&fs.statSync(file).size<10*1024*1024){
   checkedFiles++
   const content=fs.readFileSync(file,'utf8')
   if(needles.some(value=>content.includes(value)))matches.push(file)
  }
 }
}
for(const directory of ['src','public','server','shared','dist','docs','scripts','artifacts','data'])if(fs.existsSync(directory))scan(directory)
const result={checkedAt:new Date().toISOString(),checkedFiles,matchingFiles:matches,passed:matches.length===0}
fs.writeFileSync('artifacts/integration/secret-scan.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({checkedFiles,matchingFileCount:matches.length,passed:result.passed}))
if(matches.length)process.exitCode=1
