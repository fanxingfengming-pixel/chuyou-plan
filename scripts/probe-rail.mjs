import fs from 'node:fs'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
const transport=new StdioClientTransport({command:process.execPath,args:['node_modules/12306-mcp/build/index.js'],cwd:process.cwd(),stderr:'ignore',env})
const client=new Client({name:'chuyou-v2-probe',version:'2.0.0'})
try{
 await client.connect(transport,{timeout:45000})
 const listed=await client.listTools()
 fs.writeFileSync('artifacts/integration/rail-tools.json',JSON.stringify(listed.tools.map(t=>({name:t.name,inputSchema:t.inputSchema})),null,2))
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+2*86400000))
 const response=await client.callTool({name:'get-tickets',arguments:{date,fromStation:'长沙',toStation:'北京',trainFilterFlags:'GD',sortFlag:'duration',limitedNum:5,format:'json'}},undefined,{timeout:45000})
 const text=(response.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')
 let tickets;try{tickets=JSON.parse(text)}catch{}
 const evidence={checkedAt:new Date().toISOString(),provider:'12306 MCP',tools:listed.tools.map(t=>t.name),date,ok:Array.isArray(tickets),ticketCount:tickets?.length,firstTicket:tickets?.[0],error:Array.isArray(tickets)?undefined:text.slice(0,200)}
 fs.writeFileSync('artifacts/integration/rail-live-query.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence))
}catch(e){console.log(JSON.stringify({ok:false,provider:'12306 MCP',message:'MCP 连接或查询没有完成',code:e.code||e.name}))}finally{await client.close().catch(()=>{})}
