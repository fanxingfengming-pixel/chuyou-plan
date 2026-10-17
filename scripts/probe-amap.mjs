import fs from 'node:fs'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {loadConfig} from '../server/config.js'
const config=loadConfig()
if(!config.amapKey){console.log(JSON.stringify({configured:false}));process.exit(1)}
const url=new URL('https://mcp.amap.com/mcp');url.searchParams.set('key',config.amapKey)
const client=new Client({name:'chuyou-v2-probe',version:'2.0.0'})
try{
 await client.connect(new StreamableHTTPClientTransport(url),{timeout:30000})
 const tools=await client.listTools()
 fs.writeFileSync('artifacts/integration/amap-tools.json',JSON.stringify(tools.tools.map(t=>({name:t.name,inputSchema:t.inputSchema})),null,2))
 const search=tools.tools.find(t=>/text_search/.test(t.name))
 const args={keywords:'故宫博物院',city:'北京'}
 const props=search.inputSchema.properties
 if(props.citylimit)args.citylimit=props.citylimit.type==='boolean'?true:'true'
 const result=await client.callTool({name:search.name,arguments:args},undefined,{timeout:30000})
 const texts=(result.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n')
 let data;try{data=JSON.parse(texts)}catch{}
 const evidence={checkedAt:new Date().toISOString(),provider:'Amap official MCP',configured:true,tools:tools.tools.map(t=>t.name),operation:search.name,result:data||texts.slice(0,500)}
 fs.writeFileSync('artifacts/integration/amap-live-query.json',JSON.stringify(evidence,null,2))
 console.log(JSON.stringify(evidence))
}catch(e){console.log(JSON.stringify({provider:'Amap official MCP',configured:true,ok:false,code:e.code||e.name,message:'高德 MCP 连接或查询未完成'}));process.exitCode=1}finally{await client.close().catch(()=>{})}
