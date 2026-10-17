import fs from 'node:fs'
import {parseTripWithAgent} from '../server/agent-tasks.js'
try{
 const start=Date.now(),result=await parseTripWithAgent('11月上旬从长沙去北京玩4天，两位成人',AbortSignal.timeout(180000))
 const evidence={checkedAt:new Date().toISOString(),provider:'Bailian Managed Agent',model:'deepseek-v4-flash-0731',version:11,completion:'SSE idle/end_turn',elapsedMs:Date.now()-start,result}
 fs.writeFileSync('artifacts/integration/agent-live-parse.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
}catch(e){const evidence={ok:false,code:e.code||'UNKNOWN',message:e.code?e.message:'连接或响应未完成'};fs.writeFileSync('artifacts/integration/agent-live-parse.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));process.exitCode=1}
