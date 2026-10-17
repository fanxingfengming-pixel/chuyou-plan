import fs from 'node:fs'
process.loadEnvFile('.env.server')
const base='https://'+process.env.BAILIAN_WORKSPACE_ID+'.'+process.env.BAILIAN_REGION+'.maas.aliyuncs.com/api/v1/agentstudio'
const response=await fetch(base+'/agents/'+process.env.BAILIAN_AGENT_ID+'?version='+process.env.BAILIAN_AGENT_VERSION,{headers:{Authorization:'Bearer '+process.env.DASHSCOPE_API_KEY},signal:AbortSignal.timeout(30000)})
const agent=await response.json()
const safe={
 status:response.status,model:agent.model?.id,version:agent.version,
 tools:(agent.tools||[]).map(t=>({type:t.type,name:t.name,keys:Object.keys(t),serverName:t.server_name,toolNames:t.tools})),
 mcpServers:(Array.isArray(agent.mcp_servers)?agent.mcp_servers:[]).map(s=>({name:s.name,type:s.type,keys:Object.keys(s),urlHost:(()=>{try{return new URL(s.url).hostname}catch{return ''}})()})),
 skills:(agent.skills||[]).map(s=>({type:s.type,version:s.version,keys:Object.keys(s)}))
}
console.log(JSON.stringify(safe))
fs.writeFileSync('artifacts/integration/cloud-capabilities.json',JSON.stringify(safe,null,2))
