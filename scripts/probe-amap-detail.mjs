import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {loadConfig} from '../server/config.js'
const url=new URL('https://mcp.amap.com/mcp');url.searchParams.set('key',loadConfig().amapKey)
const client=new Client({name:'chuyou-v2-detail-probe',version:'2.0.0'})
try{
 await client.connect(new StreamableHTTPClientTransport(url))
 const result=await client.callTool({name:'maps_search_detail',arguments:{id:'B000A8UIN8'}})
 const texts=result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');console.log(texts)
}finally{await client.close().catch(()=>{})}
