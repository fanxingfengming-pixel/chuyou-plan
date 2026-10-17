import fs from "node:fs";
import { loadConfig } from "../server/config.js";
import { ManagedAgentClient } from "../server/managed-agent.js";
process.loadEnvFile(".env.server");
const config = loadConfig({ ...process.env, PORT: "3001" });
const client = new ManagedAgentClient(config);
const agent = await (
  await client.request(
    "/agents/" + config.agentId + "?version=" + config.agentVersion,
    { signal: AbortSignal.timeout(30000) },
  )
).json();
const env = await (
  await client.request("/environments/" + config.environmentId, {
    signal: AbortSignal.timeout(30000),
  })
).json();
const summary = {
  checkedAt: new Date().toISOString(),
  agent: {
    reachable: true,
    model: agent.model?.id || agent.model,
    version: agent.version,
    toolNames: (agent.tools || []).map((t) =>
      typeof t === "string" ? t : t.name || t.type,
    ),
    skillCount: (agent.skills || []).length,
    mcpServerNames: Object.keys(agent.mcp_servers || {}),
  },
  environment: {
    reachable: true,
    packageNames: Object.keys(env.config?.packages || {}),
  },
  local: {
    amapConfigured: !!process.env.AMAP_MAPS_API_KEY,
    flyaiKeyConfigured: (() => {
      try {
        return !!JSON.parse(
          fs.readFileSync(process.env.USERPROFILE + "/.flyai/config.json"),
        ).FLYAI_API_KEY;
      } catch {
        return false;
      }
    })(),
  },
};
fs.writeFileSync(
  "artifacts/integration/config-audit.json",
  JSON.stringify(summary, null, 2),
);
console.log(JSON.stringify(summary));
